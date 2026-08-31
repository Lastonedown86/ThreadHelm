//! Win32 boundary tests (T013).
//!
//! These run against the real kernel objects — a fake Job Object proves
//! nothing. Each test cleans up its own job token and child processes.

use std::process::{Child, Command};
use std::time::{Duration, Instant};
use std::{env, fs};

use crate::error::Code;
use crate::identity::{check_supported, display_form, drive_type_name, resolve_directory};
use crate::job::{
    assign_process, close_job, create_kill_on_close_job, inspect_job, terminate_job,
    verify_process_in_job,
};

const DRIVE_FIXED: u32 = 3;
const DRIVE_REMOTE: u32 = 4;
const DRIVE_REMOVABLE: u32 = 2;

/// A directory that deletes itself on drop, named with a space and non-ASCII
/// characters because those are the paths that break naive quoting.
struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(tag: &str) -> Self {
        let unique = format!(
            "threadhelm test {tag} ünïcode {}",
            std::process::id() as u64 + Instant::now().elapsed().as_nanos() as u64
        );
        let path = env::temp_dir().join(unique);
        fs::create_dir_all(&path).expect("temp dir");
        Self(path)
    }

    fn as_str(&self) -> String {
        self.0.to_string_lossy().into_owned()
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// A child that outlives the test only if the test fails; killed on drop.
struct Doomed(Child);

impl Drop for Doomed {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

/// Long-lived, quiet, and available on every Windows install.
fn spawn_sleeper() -> Doomed {
    let child = Command::new("cmd.exe")
        .args(["/c", "ping -n 30 127.0.0.1 > nul"])
        .spawn()
        .expect("spawn sleeper");
    Doomed(child)
}

fn wait_until(deadline: Duration, mut done: impl FnMut() -> bool) -> bool {
    let start = Instant::now();
    while start.elapsed() < deadline {
        if done() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    done()
}

#[test]
fn named_session_scope_reports_missing_empty_live_and_closed_without_reattachment() {
    let id = format!("{:08x}-0000-4000-8000-000000000001", std::process::id());
    assert!(crate::job::inspect_session_scope(&id).unwrap().is_empty());
    let token = crate::job::create_named_session_job(&id).unwrap();
    assert!(crate::job::inspect_session_scope(&id).unwrap().is_empty());
    let mut child = spawn_sleeper();
    assign_process(token, child.0.id()).unwrap();
    assert!(
        crate::job::inspect_session_scope(&id)
            .unwrap()
            .active_process_count
            >= 1
    );
    close_job(token).unwrap();
    assert!(wait_until(Duration::from_secs(5), || child
        .0
        .try_wait()
        .unwrap()
        .is_some()));
    assert!(wait_until(Duration::from_secs(5), || {
        crate::job::inspect_session_scope(&id).unwrap().is_empty()
    }));
}

#[test]
fn named_session_scope_collision_and_arbitrary_names_fail_closed() {
    let id = format!("{:08x}-0000-4000-8000-000000000002", std::process::id());
    let token = crate::job::create_named_session_job(&id).unwrap();
    assert_eq!(
        crate::job::create_named_session_job(&id).unwrap_err().code,
        Code::JobCreateFailed
    );
    assert!(inspect_job(token).unwrap().is_empty());
    close_job(token).unwrap();
    for invalid in [
        "",
        "Global\\arbitrary",
        "00000000-0000-4000-8000-00000000000z",
        "0000000000000400080000000000000000001",
    ] {
        assert!(crate::job::create_named_session_job(invalid).is_err());
        assert!(crate::job::inspect_session_scope(invalid).is_err());
    }
}

#[test]
fn retaining_a_named_query_handle_cannot_defeat_containment_cleanup() {
    use windows_sys::Win32::Foundation::{CloseHandle, FALSE};
    use windows_sys::Win32::System::JobObjects::OpenJobObjectW;
    use windows_sys::Win32::System::SystemServices::JOB_OBJECT_QUERY;

    let id = format!("{:08x}-0000-4000-8000-000000000003", std::process::id());
    let token = crate::job::create_named_session_job(&id).unwrap();
    let mut child = spawn_sleeper();
    assign_process(token, child.0.id()).unwrap();
    assert!(verify_process_in_job(token, child.0.id()).unwrap());
    let name: Vec<u16> = format!("Local\\ThreadHelm.session.{id}\0")
        .encode_utf16()
        .collect();
    // This is the same access available to a same-user child. Merely opening a
    // query handle must never keep the actual containment job alive.
    let held_query = unsafe { OpenJobObjectW(JOB_OBJECT_QUERY, FALSE, name.as_ptr()) };
    assert!(!held_query.is_null());
    close_job(token).unwrap();
    let exited = wait_until(Duration::from_secs(3), || {
        child.0.try_wait().unwrap().is_some()
    });
    let empty = crate::job::inspect_session_scope(&id).unwrap().is_empty();
    unsafe { CloseHandle(held_query) };
    assert!(
        exited,
        "process survived because a named query handle retained its containment job"
    );
    assert!(
        empty,
        "the tracking scope must prove empty after containment cleanup"
    );
}

// --- identity -----------------------------------------------------------

#[test]
fn resolves_directory_with_spaces_and_unicode() {
    let dir = TempDir::new("resolve");
    let id = resolve_directory(&dir.as_str()).expect("resolve");

    assert!(id.canonical_path.starts_with(r"\\?\"));
    assert!(!id.display_path.starts_with(r"\\?\"));
    assert_eq!(id.drive_type, "fixed");
    assert_eq!(id.file_id.len(), 32, "128-bit file id as hex");
    assert_eq!(id.volume_serial.len(), 16);
    assert!(!id.is_reparse_point);
}

#[test]
fn aliased_paths_share_one_identity() {
    let dir = TempDir::new("alias");
    let direct = resolve_directory(&dir.as_str()).expect("direct");

    // Same directory, different spelling: trailing separator plus a `.` hop.
    let aliased_path = format!("{}\\.\\", dir.as_str());
    let aliased = resolve_directory(&aliased_path).expect("aliased");

    assert_eq!(direct.volume_serial, aliased.volume_serial);
    assert_eq!(direct.file_id, aliased.file_id);
    assert_ne!(direct.selected_path, aliased.selected_path);
}

#[test]
fn junction_resolves_to_target_identity_and_is_observed() {
    let target = TempDir::new("junction-target");
    let link_path = env::temp_dir().join(format!("threadhelm junction {}", std::process::id()));
    let _ = fs::remove_dir(&link_path);
    let status = Command::new("cmd.exe")
        .args([
            "/c",
            "mklink",
            "/J",
            &link_path.to_string_lossy(),
            &target.as_str(),
        ])
        .status()
        .expect("mklink");
    assert!(status.success(), "junction creation needs no elevation");

    let direct = resolve_directory(&target.as_str()).expect("target");
    let via_link = resolve_directory(&link_path.to_string_lossy()).expect("junction");
    let _ = fs::remove_dir(&link_path);

    assert_eq!(direct.file_id, via_link.file_id, "same effective directory");
    assert_eq!(direct.volume_serial, via_link.volume_serial);
    assert!(!direct.is_reparse_point);
    assert!(
        via_link.is_reparse_point,
        "the selected path was a junction"
    );
    assert_eq!(via_link.canonical_path, direct.canonical_path);
}

#[test]
fn missing_directory_is_not_found() {
    let dir = TempDir::new("missing");
    let missing = format!("{}\\does-not-exist", dir.as_str());
    let err = resolve_directory(&missing).expect_err("must fail");
    assert_eq!(err.code, Code::DirectoryNotFound);
}

#[test]
fn a_file_is_not_a_directory() {
    let dir = TempDir::new("file");
    let file = dir.0.join("not-a-dir.txt");
    fs::write(&file, b"x").expect("write");
    let err = resolve_directory(&file.to_string_lossy()).expect_err("must fail");
    assert_eq!(err.code, Code::DirectoryNotFound);
}

#[test]
fn deleted_directory_is_rejected() {
    let path = {
        let dir = TempDir::new("deleted");
        dir.as_str()
    }; // dropped, so removed
    let err = resolve_directory(&path).expect_err("must fail");
    assert_eq!(err.code, Code::DirectoryNotFound);
}

#[test]
fn empty_and_embedded_nul_paths_are_rejected() {
    assert_eq!(
        resolve_directory("").expect_err("empty").code,
        Code::DirectoryNotFound
    );
    assert_eq!(
        resolve_directory("C:\\te\0st").expect_err("nul").code,
        Code::DirectoryNotFound
    );
}

#[test]
fn unsupported_volumes_fail_closed() {
    assert!(check_supported(r"\\?\C:\projects", DRIVE_FIXED).is_ok());

    for (path, drive) in [
        (r"\\?\UNC\server\share", DRIVE_REMOTE),
        (r"\\.\PhysicalDrive0", DRIVE_FIXED),
        (r"\\?\E:\usb", DRIVE_REMOVABLE),
        (r"\\?\Z:\mapped", DRIVE_REMOTE),
    ] {
        let err = check_supported(path, drive).expect_err(path);
        assert_eq!(err.code, Code::DirectoryUnsupported, "{path}");
    }
}

#[test]
fn display_form_strips_only_the_prefix() {
    assert_eq!(display_form(r"\\?\C:\a b"), r"C:\a b");
    assert_eq!(display_form(r"\\?\UNC\host\share"), r"\\host\share");
    assert_eq!(display_form(r"C:\plain"), r"C:\plain");
    assert_eq!(drive_type_name(DRIVE_FIXED), "fixed");
    assert_eq!(drive_type_name(99), "unknown");
}

// --- job objects --------------------------------------------------------

#[test]
fn assigns_verifies_and_terminates_a_process() {
    let token = create_kill_on_close_job().expect("create job");
    let child = spawn_sleeper();
    let pid = child.0.id();

    assign_process(token, pid).expect("assign");
    assert!(verify_process_in_job(token, pid).expect("verify"));

    let before = inspect_job(token).expect("inspect");
    assert!(before.active_process_count >= 1);
    assert!(before.process_ids.contains(&pid));
    assert!(!before.truncated);

    let after = terminate_job(token, 1).expect("terminate");
    assert!(after.is_empty(), "scope must be proven empty");
    assert!(after.process_ids.is_empty());

    close_job(token).expect("close");
}

#[test]
fn descendants_are_contained_and_terminated() {
    let token = create_kill_on_close_job().expect("create job");
    // cmd.exe spawns ping as a child; both must land in the job.
    let child = spawn_sleeper();
    assign_process(token, child.0.id()).expect("assign");

    let saw_descendant = wait_until(Duration::from_secs(5), || {
        inspect_job(token)
            .map(|s| s.active_process_count >= 2)
            .unwrap_or(false)
    });
    assert!(saw_descendant, "descendant never joined the job");

    let after = terminate_job(token, 1).expect("terminate");
    assert!(after.is_empty());
    close_job(token).expect("close");
}

#[test]
fn closing_the_job_kills_the_scope() {
    // This is the containment guarantee: if the coordinator dies, Windows
    // closes the handle and the tree goes with it.
    let token = create_kill_on_close_job().expect("create job");
    let mut child = spawn_sleeper();
    assign_process(token, child.0.id()).expect("assign");
    assert!(verify_process_in_job(token, child.0.id()).expect("verify"));

    close_job(token).expect("close");

    let exited = wait_until(Duration::from_secs(5), || {
        matches!(child.0.try_wait(), Ok(Some(_)))
    });
    assert!(exited, "process survived job handle closure");
}

#[test]
fn unassigned_process_is_not_in_job() {
    let token = create_kill_on_close_job().expect("create job");
    let child = spawn_sleeper();
    assert!(!verify_process_in_job(token, child.0.id()).expect("verify"));
    close_job(token).expect("close");
}

#[test]
fn invalid_tokens_are_rejected() {
    let bogus = u32::MAX;
    assert_eq!(
        assign_process(bogus, 4).expect_err("assign").code,
        Code::InvalidNativeToken
    );
    assert_eq!(
        inspect_job(bogus).expect_err("inspect").code,
        Code::InvalidNativeToken
    );
    assert_eq!(
        close_job(bogus).expect_err("close").code,
        Code::InvalidNativeToken
    );
}

#[test]
fn closing_twice_is_rejected_not_double_freed() {
    let token = create_kill_on_close_job().expect("create job");
    close_job(token).expect("first close");
    assert_eq!(
        close_job(token).expect_err("second close").code,
        Code::InvalidNativeToken
    );
}

#[test]
fn invalid_pids_fail_closed() {
    let token = create_kill_on_close_job().expect("create job");
    assert_eq!(
        assign_process(token, 0).expect_err("pid 0").code,
        Code::ProcessAssignFailed
    );
    // A pid that cannot be opened must not be reported as contained.
    assert!(assign_process(token, u32::MAX - 1).is_err());
    close_job(token).expect("close");
}

#[test]
fn concurrent_jobs_stay_isolated() {
    let first = create_kill_on_close_job().expect("first");
    let second = create_kill_on_close_job().expect("second");
    assert_ne!(first, second);

    let child = spawn_sleeper();
    assign_process(first, child.0.id()).expect("assign");

    assert!(verify_process_in_job(first, child.0.id()).expect("in first"));
    assert!(!verify_process_in_job(second, child.0.id()).expect("not in second"));
    assert_eq!(
        inspect_job(second).expect("inspect").active_process_count,
        0
    );

    terminate_job(first, 1).expect("terminate");
    close_job(first).expect("close first");
    close_job(second).expect("close second");
}
