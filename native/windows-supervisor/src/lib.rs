//! ThreadHelm Windows supervisor.
//!
//! Deliberately narrow: Job Object lifetime and directory identity. No provider
//! logic, no UI state, no network, no general filesystem access. Everything
//! `unsafe` lives in `identity` and `job`, both of which are plain Rust and
//! unit-testable without Node.

mod error;
mod identity;
mod job;

// The Node-API surface links against Node symbols, so it is excluded from the
// `cargo test` harness. `cargo test` exercises the Win32 modules directly.
#[cfg(not(test))]
mod bindings;

#[cfg(test)]
mod tests;

pub use error::{Code, SupervisorError};
pub use identity::{resolve_directory, DirectoryIdentity};
pub use job::{
    assign_process, close_job, create_kill_on_close_job, inspect_job, terminate_job,
    verify_process_in_job, JobSnapshot,
};
