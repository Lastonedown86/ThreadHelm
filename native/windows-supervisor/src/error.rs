//! Stable error codes for the native boundary.
//!
//! Errors carry a code from `contracts/windows-supervisor.md` and, at most, a
//! raw Win32 code for diagnostics. Never a native error string, never path
//! contents: main is responsible for disclosure and durable logging.

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Code {
    DirectoryNotFound,
    DirectoryAccessDenied,
    DirectoryUnsupported,
    DirectoryAmbiguous,
    JobCreateFailed,
    JobLimitFailed,
    ProcessAssignFailed,
    ProcessNotInJob,
    JobInspectionFailed,
    JobTerminationFailed,
    JobNotEmpty,
    InvalidNativeToken,
}

impl Code {
    pub const fn as_str(self) -> &'static str {
        match self {
            Code::DirectoryNotFound => "DIRECTORY_NOT_FOUND",
            Code::DirectoryAccessDenied => "DIRECTORY_ACCESS_DENIED",
            Code::DirectoryUnsupported => "DIRECTORY_UNSUPPORTED",
            Code::DirectoryAmbiguous => "DIRECTORY_AMBIGUOUS",
            Code::JobCreateFailed => "JOB_CREATE_FAILED",
            Code::JobLimitFailed => "JOB_LIMIT_FAILED",
            Code::ProcessAssignFailed => "PROCESS_ASSIGN_FAILED",
            Code::ProcessNotInJob => "PROCESS_NOT_IN_JOB",
            Code::JobInspectionFailed => "JOB_INSPECTION_FAILED",
            Code::JobTerminationFailed => "JOB_TERMINATION_FAILED",
            Code::JobNotEmpty => "JOB_NOT_EMPTY",
            Code::InvalidNativeToken => "INVALID_NATIVE_TOKEN",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SupervisorError {
    pub code: Code,
    pub win32: Option<u32>,
}

impl SupervisorError {
    pub const fn new(code: Code) -> Self {
        Self { code, win32: None }
    }

    pub const fn with_win32(code: Code, win32: u32) -> Self {
        Self {
            code,
            win32: Some(win32),
        }
    }
}

impl fmt::Display for SupervisorError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.win32 {
            Some(code) => write!(f, "{} (win32={})", self.code.as_str(), code),
            None => f.write_str(self.code.as_str()),
        }
    }
}

impl std::error::Error for SupervisorError {}

pub type Result<T> = std::result::Result<T, SupervisorError>;
