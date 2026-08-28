//! Job Object supervision.
//!
//! Every session gets one unnamed Job Object with
//! `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. Main holds the token for the session
//! lifetime, so if the coordinator dies for any reason Windows closes the
//! handle and tears down the whole supervised tree. That is the containment
//! guarantee — not a best-effort kill loop.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Mutex, OnceLock};
use std::{mem, ptr};

use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, FALSE, HANDLE};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, IsProcessInJob, JobObjectBasicProcessIdList,
    JobObjectExtendedLimitInformation, QueryInformationJobObject, SetInformationJobObject,
    TerminateJobObject, JOBOBJECT_BASIC_PROCESS_ID_LIST, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
use windows_sys::Win32::System::Threading::{
    OpenProcess, Sleep, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_QUOTA, PROCESS_TERMINATE,
};

use crate::error::{Code, Result, SupervisorError};

/// Bounded diagnostics only. A session that somehow holds more than this many
/// processes is reported as truncated rather than growing an unbounded buffer.
const MAX_REPORTED_PIDS: usize = 256;
/// Force-stop verification budget: 40 * 25ms = 1s.
const EMPTY_POLL_ATTEMPTS: u32 = 40;
const EMPTY_POLL_INTERVAL_MS: u32 = 25;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JobSnapshot {
    pub active_process_count: u32,
    pub process_ids: Vec<u32>,
    /// True when the job holds more processes than `process_ids` reports.
    pub truncated: bool,
}

impl JobSnapshot {
    pub fn is_empty(&self) -> bool {
        self.active_process_count == 0
    }
}

/// Owns a Job Object handle. Dropping it closes the handle, which — because of
/// KILL_ON_JOB_CLOSE — terminates every process still inside.
struct OwnedJob(HANDLE);

// SAFETY: a Job Object HANDLE is a process-wide kernel handle; it is valid from
// any thread and this type gives out no interior references.
unsafe impl Send for OwnedJob {}

impl Drop for OwnedJob {
    fn drop(&mut self) {
        // SAFETY: self.0 came from CreateJobObjectW and is closed once, here.
        unsafe {
            CloseHandle(self.0);
        }
    }
}

// ponytail: a process-global registry keyed by u32 rather than napi External.
// Tokens are process-local, unforgeable in practice, and explicitly
// invalidated by close_job — no GC ordering to reason about. If a future
// multi-coordinator design needs isolated registries, this is the seam.
static REGISTRY: OnceLock<Mutex<HashMap<u32, OwnedJob>>> = OnceLock::new();
static NEXT_TOKEN: AtomicU32 = AtomicU32::new(1);

fn registry() -> &'static Mutex<HashMap<u32, OwnedJob>> {
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn last_error() -> u32 {
    // SAFETY: GetLastError has no preconditions.
    unsafe { GetLastError() }
}

/// Run `f` with the raw handle for `token`, or fail with INVALID_NATIVE_TOKEN.
fn with_job<T>(token: u32, f: impl FnOnce(HANDLE) -> Result<T>) -> Result<T> {
    let guard = registry()
        .lock()
        .map_err(|_| SupervisorError::new(Code::InvalidNativeToken))?;
    let job = guard
        .get(&token)
        .ok_or_else(|| SupervisorError::new(Code::InvalidNativeToken))?;
    let handle = job.0;
    drop(guard);
    f(handle)
}

pub fn create_kill_on_close_job() -> Result<u32> {
    // SAFETY: null name and null security attributes create an unnamed job.
    let handle = unsafe { CreateJobObjectW(ptr::null(), ptr::null()) };
    if handle.is_null() {
        return Err(SupervisorError::with_win32(
            Code::JobCreateFailed,
            last_error(),
        ));
    }
    let job = OwnedJob(handle);

    let mut limits = unsafe { mem::zeroed::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() };
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    // SAFETY: `limits` is a correctly sized JOBOBJECT_EXTENDED_LIMIT_INFORMATION.
    let ok = unsafe {
        SetInformationJobObject(
            job.0,
            JobObjectExtendedLimitInformation,
            (&raw const limits).cast(),
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        )
    };
    if ok == 0 {
        // `job` drops here and closes the handle: no leak on the failure path.
        return Err(SupervisorError::with_win32(
            Code::JobLimitFailed,
            last_error(),
        ));
    }

    let token = NEXT_TOKEN.fetch_add(1, Ordering::Relaxed);
    registry()
        .lock()
        .map_err(|_| SupervisorError::new(Code::JobCreateFailed))?
        .insert(token, job);
    Ok(token)
}

/// Open a process handle with exactly the rights the caller needs.
fn open_process(pid: u32, access: u32) -> Result<crate::job::OwnedProcess> {
    if pid == 0 {
        return Err(SupervisorError::new(Code::ProcessAssignFailed));
    }
    // SAFETY: OpenProcess validates the pid; a null return is the failure path.
    let handle = unsafe { OpenProcess(access, FALSE, pid) };
    if handle.is_null() {
        return Err(SupervisorError::with_win32(
            Code::ProcessAssignFailed,
            last_error(),
        ));
    }
    Ok(OwnedProcess(handle))
}

pub struct OwnedProcess(HANDLE);

impl Drop for OwnedProcess {
    fn drop(&mut self) {
        // SAFETY: self.0 came from OpenProcess and is closed once, here.
        unsafe {
            CloseHandle(self.0);
        }
    }
}

pub fn assign_process(token: u32, pid: u32) -> Result<()> {
    with_job(token, |job| {
        let process = open_process(pid, PROCESS_SET_QUOTA | PROCESS_TERMINATE)?;
        // SAFETY: both handles are live and owned for the duration of the call.
        let ok = unsafe { AssignProcessToJobObject(job, process.0) };
        if ok == 0 {
            // Nested-job rejection, access denied, and stale pids all land
            // here. Fail closed: the caller must not launch a provider.
            return Err(SupervisorError::with_win32(
                Code::ProcessAssignFailed,
                last_error(),
            ));
        }
        Ok(())
    })
}

/// Mandatory before main sends a launch descriptor.
pub fn verify_process_in_job(token: u32, pid: u32) -> Result<bool> {
    with_job(token, |job| {
        let process = open_process(pid, PROCESS_QUERY_LIMITED_INFORMATION)?;
        let mut in_job = 0i32;
        // SAFETY: both handles are live; `in_job` is a valid BOOL out-param.
        let ok = unsafe { IsProcessInJob(process.0, job, &raw mut in_job) };
        if ok == 0 {
            return Err(SupervisorError::with_win32(
                Code::ProcessNotInJob,
                last_error(),
            ));
        }
        Ok(in_job != 0)
    })
}

pub fn inspect_job(token: u32) -> Result<JobSnapshot> {
    with_job(token, inspect_handle)
}

fn inspect_handle(job: HANDLE) -> Result<JobSnapshot> {
    let header = size_of::<JOBOBJECT_BASIC_PROCESS_ID_LIST>();
    let bytes = header + MAX_REPORTED_PIDS * size_of::<usize>();
    let mut buffer = vec![0u8; bytes];

    // SAFETY: buffer is at least the size of the header plus the pid slots we
    // claim, and is aligned by Vec<u8> allocation for the usize reads below.
    let ok = unsafe {
        QueryInformationJobObject(
            job,
            JobObjectBasicProcessIdList,
            buffer.as_mut_ptr().cast(),
            bytes as u32,
            ptr::null_mut(),
        )
    };
    // A full buffer returns FALSE with ERROR_MORE_DATA (234) but still fills
    // the header and as many pids as fit, which is exactly what "truncated"
    // should report.
    let more_data = last_error() == 234;
    if ok == 0 && !more_data {
        return Err(SupervisorError::with_win32(
            Code::JobInspectionFailed,
            last_error(),
        ));
    }

    // SAFETY: the kernel filled `buffer` with a JOBOBJECT_BASIC_PROCESS_ID_LIST.
    let list = unsafe { &*buffer.as_ptr().cast::<JOBOBJECT_BASIC_PROCESS_ID_LIST>() };
    let assigned = list.NumberOfAssignedProcesses;
    let in_list = (list.NumberOfProcessIdsInList as usize).min(MAX_REPORTED_PIDS);

    let mut process_ids = Vec::with_capacity(in_list);
    // SAFETY: ProcessIdList is a trailing array of `in_list` ULONG_PTR values
    // inside the same buffer, bounded above by MAX_REPORTED_PIDS.
    unsafe {
        let first = (&raw const list.ProcessIdList).cast::<usize>();
        for index in 0..in_list {
            process_ids.push(*first.add(index) as u32);
        }
    }

    Ok(JobSnapshot {
        active_process_count: assigned,
        truncated: (assigned as usize) > process_ids.len(),
        process_ids,
    })
}

/// Force stop. Terminates, then proves the scope is actually empty rather than
/// trusting the call: a process that survives is reported, not hidden.
pub fn terminate_job(token: u32, exit_code: u32) -> Result<JobSnapshot> {
    with_job(token, |job| {
        // SAFETY: `job` is a live Job Object handle.
        let ok = unsafe { TerminateJobObject(job, exit_code) };
        if ok == 0 {
            return Err(SupervisorError::with_win32(
                Code::JobTerminationFailed,
                last_error(),
            ));
        }

        let mut snapshot = inspect_handle(job)?;
        let mut attempts = 0;
        while !snapshot.is_empty() && attempts < EMPTY_POLL_ATTEMPTS {
            // SAFETY: Sleep has no preconditions.
            unsafe { Sleep(EMPTY_POLL_INTERVAL_MS) };
            snapshot = inspect_handle(job)?;
            attempts += 1;
        }
        if !snapshot.is_empty() {
            return Err(SupervisorError::new(Code::JobNotEmpty));
        }
        Ok(snapshot)
    })
}

/// Invalidates the token even if Windows reports a cleanup problem.
pub fn close_job(token: u32) -> Result<()> {
    let removed = registry()
        .lock()
        .map_err(|_| SupervisorError::new(Code::InvalidNativeToken))?
        .remove(&token);
    match removed {
        // Drop closes the handle, which kills anything still inside.
        Some(_) => Ok(()),
        None => Err(SupervisorError::new(Code::InvalidNativeToken)),
    }
}
