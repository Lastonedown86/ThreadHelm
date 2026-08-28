//! Node-API surface. Callable only from Electron main.
//!
//! Every entrypoint is `catch_unwind`: a Rust panic must never unwind across
//! the ABI into V8. Errors cross as stable code strings from `error::Code`.

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::error::SupervisorError;
use crate::{identity, job};

fn to_napi(err: SupervisorError) -> Error {
    Error::new(Status::GenericFailure, err.to_string())
}

#[napi(object)]
pub struct DirectoryIdentity {
    pub selected_path: String,
    pub canonical_path: String,
    pub display_path: String,
    pub volume_serial: String,
    pub file_id: String,
    pub drive_type: String,
    pub is_reparse_point: bool,
}

#[napi(object)]
pub struct JobSnapshot {
    pub active_process_count: u32,
    pub process_ids: Vec<u32>,
    pub truncated: bool,
}

impl From<job::JobSnapshot> for JobSnapshot {
    fn from(value: job::JobSnapshot) -> Self {
        Self {
            active_process_count: value.active_process_count,
            process_ids: value.process_ids,
            truncated: value.truncated,
        }
    }
}

/// Resolve stable identity for a directory the user picked natively.
#[napi(catch_unwind)]
pub fn resolve_directory(selected_path: String) -> Result<DirectoryIdentity> {
    let id = identity::resolve_directory(&selected_path).map_err(to_napi)?;
    Ok(DirectoryIdentity {
        selected_path: id.selected_path,
        canonical_path: id.canonical_path,
        display_path: id.display_path,
        volume_serial: id.volume_serial,
        file_id: id.file_id,
        drive_type: id.drive_type,
        is_reparse_point: id.is_reparse_point,
    })
}

/// Create the session's containment scope. Main must retain the returned token
/// for the whole session lifetime.
#[napi(catch_unwind)]
pub fn create_kill_on_close_job() -> Result<u32> {
    job::create_kill_on_close_job().map_err(to_napi)
}

#[napi(catch_unwind)]
pub fn assign_process(token: u32, pid: u32) -> Result<()> {
    job::assign_process(token, pid).map_err(to_napi)
}

#[napi(catch_unwind)]
pub fn verify_process_in_job(token: u32, pid: u32) -> Result<bool> {
    job::verify_process_in_job(token, pid).map_err(to_napi)
}

#[napi(catch_unwind)]
pub fn inspect_job(token: u32) -> Result<JobSnapshot> {
    job::inspect_job(token).map(Into::into).map_err(to_napi)
}

#[napi(catch_unwind)]
pub fn terminate_job(token: u32, exit_code: u32) -> Result<JobSnapshot> {
    job::terminate_job(token, exit_code)
        .map(Into::into)
        .map_err(to_napi)
}

#[napi(catch_unwind)]
pub fn close_job(token: u32) -> Result<()> {
    job::close_job(token).map_err(to_napi)
}
