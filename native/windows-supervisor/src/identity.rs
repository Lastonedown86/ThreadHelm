//! Stable Windows directory identity.
//!
//! Identity comes from an *opened handle*, never from a path string. The
//! one-writer policy keys on (volume serial, file id), so two different path
//! spellings — junction, symlink, 8.3 alias, drive substitution — that land on
//! the same directory are the same workspace.

use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::ptr;

use windows_sys::Win32::Foundation::{
    CloseHandle, GetLastError, ERROR_ACCESS_DENIED, ERROR_FILE_NOT_FOUND, ERROR_PATH_NOT_FOUND,
    HANDLE, INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, FileBasicInfo, FileIdInfo, GetDriveTypeW, GetFileAttributesW,
    GetFileInformationByHandleEx, GetFinalPathNameByHandleW, FILE_ATTRIBUTE_DIRECTORY,
    FILE_ATTRIBUTE_REPARSE_POINT, FILE_BASIC_INFO, FILE_FLAG_BACKUP_SEMANTICS, FILE_ID_INFO,
    FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
    INVALID_FILE_ATTRIBUTES, OPEN_EXISTING, VOLUME_NAME_DOS,
};

use crate::error::{Code, Result, SupervisorError};

const DRIVE_UNKNOWN: u32 = 0;
const DRIVE_NO_ROOT_DIR: u32 = 1;
const DRIVE_REMOVABLE: u32 = 2;
const DRIVE_FIXED: u32 = 3;
const DRIVE_REMOTE: u32 = 4;
const DRIVE_CDROM: u32 = 5;
const DRIVE_RAMDISK: u32 = 6;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DirectoryIdentity {
    pub selected_path: String,
    /// `\\?\`-prefixed final path from the opened handle.
    pub canonical_path: String,
    /// Display form with the `\\?\` prefix removed; identity never depends on it.
    pub display_path: String,
    /// Hex, because a 64-bit serial does not survive a JS number.
    pub volume_serial: String,
    /// Hex of the 128-bit file id.
    pub file_id: String,
    pub drive_type: String,
    pub is_reparse_point: bool,
}

/// RAII wrapper. Every early return closes the handle.
struct OwnedHandle(HANDLE);

impl Drop for OwnedHandle {
    fn drop(&mut self) {
        // SAFETY: self.0 is a valid handle produced by CreateFileW and is
        // closed exactly once, here.
        unsafe {
            CloseHandle(self.0);
        }
    }
}

fn to_wide(value: &str) -> Vec<u16> {
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

fn last_error_as(code: Code) -> SupervisorError {
    // SAFETY: GetLastError has no preconditions.
    let win32 = unsafe { GetLastError() };
    match win32 {
        ERROR_FILE_NOT_FOUND | ERROR_PATH_NOT_FOUND => {
            SupervisorError::with_win32(Code::DirectoryNotFound, win32)
        }
        ERROR_ACCESS_DENIED => SupervisorError::with_win32(Code::DirectoryAccessDenied, win32),
        _ => SupervisorError::with_win32(code, win32),
    }
}

pub(crate) fn drive_type_name(value: u32) -> &'static str {
    match value {
        DRIVE_REMOVABLE => "removable",
        DRIVE_FIXED => "fixed",
        DRIVE_REMOTE => "remote",
        DRIVE_CDROM => "cdrom",
        DRIVE_RAMDISK => "ramdisk",
        DRIVE_NO_ROOT_DIR => "no-root-dir",
        DRIVE_UNKNOWN => "unknown",
        _ => "unknown",
    }
}

/// Strip the `\\?\` prefix for display only. UNC keeps its `\\` form.
pub(crate) fn display_form(canonical: &str) -> String {
    if let Some(rest) = canonical.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = canonical.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        canonical.to_string()
    }
}

/// MVP supports fixed local volumes only. Everything else fails closed: a
/// workspace whose boundary ThreadHelm cannot reason about is not approvable.
pub(crate) fn check_supported(canonical: &str, drive_type: u32) -> Result<()> {
    let is_unc = canonical.starts_with(r"\\?\UNC\") || canonical.starts_with(r"\\.\");
    if is_unc {
        return Err(SupervisorError::new(Code::DirectoryUnsupported));
    }
    if drive_type != DRIVE_FIXED {
        return Err(SupervisorError::new(Code::DirectoryUnsupported));
    }
    Ok(())
}

fn volume_root(canonical: &str) -> Result<Vec<u16>> {
    let stripped = canonical
        .strip_prefix(r"\\?\")
        .ok_or_else(|| SupervisorError::new(Code::DirectoryAmbiguous))?;
    let mut chars = stripped.chars();
    let letter = chars
        .next()
        .ok_or_else(|| SupervisorError::new(Code::DirectoryAmbiguous))?;
    if chars.next() != Some(':') || !letter.is_ascii_alphabetic() {
        return Err(SupervisorError::new(Code::DirectoryUnsupported));
    }
    Ok(to_wide(&format!("{letter}:\\")))
}

/// Open the directory, take its identity from the handle, and reject anything
/// outside the MVP boundary.
pub fn resolve_directory(selected_path: &str) -> Result<DirectoryIdentity> {
    if selected_path.is_empty() || selected_path.contains('\0') {
        return Err(SupervisorError::new(Code::DirectoryNotFound));
    }

    let wide = to_wide(selected_path);
    // FILE_FLAG_BACKUP_SEMANTICS is mandatory to open a directory handle.
    // The reparse point is deliberately followed: the effective directory is
    // the boundary the user is granting, and it is what the agent will see.
    // SAFETY: `wide` is a NUL-terminated UTF-16 buffer that outlives the call.
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE || handle.is_null() {
        return Err(last_error_as(Code::DirectoryNotFound));
    }
    let handle = OwnedHandle(handle);

    let basic = query_basic_info(handle.0)?;
    if basic.FileAttributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
        return Err(SupervisorError::new(Code::DirectoryNotFound));
    }
    // The handle above follows the link, so its attributes describe the
    // target. The selected path's own attributes (not followed) tell whether
    // the user picked a junction/symlink — surfaced so the UI can say so.
    // SAFETY: `wide` is a NUL-terminated UTF-16 buffer that outlives the call.
    let selected_attributes = unsafe { GetFileAttributesW(wide.as_ptr()) };
    let is_reparse_point = selected_attributes != INVALID_FILE_ATTRIBUTES
        && selected_attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0;

    let canonical_path = final_path(handle.0)?;
    let root = volume_root(&canonical_path)?;
    // SAFETY: `root` is a NUL-terminated UTF-16 volume root.
    let drive_type = unsafe { GetDriveTypeW(root.as_ptr()) };
    check_supported(&canonical_path, drive_type)?;

    let id = query_id_info(handle.0)?;

    Ok(DirectoryIdentity {
        selected_path: selected_path.to_string(),
        display_path: display_form(&canonical_path),
        canonical_path,
        volume_serial: format!("{:016x}", id.VolumeSerialNumber),
        file_id: id
            .FileId
            .Identifier
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect(),
        drive_type: drive_type_name(drive_type).to_string(),
        is_reparse_point,
    })
}

fn query_basic_info(handle: HANDLE) -> Result<FILE_BASIC_INFO> {
    let mut info = unsafe { std::mem::zeroed::<FILE_BASIC_INFO>() };
    // SAFETY: `info` is a correctly sized FILE_BASIC_INFO for FileBasicInfo.
    let ok = unsafe {
        GetFileInformationByHandleEx(
            handle,
            FileBasicInfo,
            (&raw mut info).cast(),
            size_of::<FILE_BASIC_INFO>() as u32,
        )
    };
    if ok == 0 {
        return Err(last_error_as(Code::DirectoryAmbiguous));
    }
    Ok(info)
}

fn query_id_info(handle: HANDLE) -> Result<FILE_ID_INFO> {
    let mut info = unsafe { std::mem::zeroed::<FILE_ID_INFO>() };
    // SAFETY: `info` is a correctly sized FILE_ID_INFO for FileIdInfo.
    let ok = unsafe {
        GetFileInformationByHandleEx(
            handle,
            FileIdInfo,
            (&raw mut info).cast(),
            size_of::<FILE_ID_INFO>() as u32,
        )
    };
    if ok == 0 {
        return Err(last_error_as(Code::DirectoryAmbiguous));
    }
    Ok(info)
}

fn final_path(handle: HANDLE) -> Result<String> {
    // Ask for the required length first: long paths are normal here.
    // SAFETY: a null buffer with length 0 is the documented probe form.
    let needed = unsafe { GetFinalPathNameByHandleW(handle, ptr::null_mut(), 0, VOLUME_NAME_DOS) };
    if needed == 0 {
        return Err(last_error_as(Code::DirectoryAmbiguous));
    }
    let mut buffer = vec![0u16; needed as usize];
    // SAFETY: buffer holds `needed` UTF-16 units, matching the reported need.
    let written =
        unsafe { GetFinalPathNameByHandleW(handle, buffer.as_mut_ptr(), needed, VOLUME_NAME_DOS) };
    if written == 0 || written >= needed {
        return Err(last_error_as(Code::DirectoryAmbiguous));
    }
    buffer.truncate(written as usize);
    String::from_utf16(&buffer).map_err(|_| SupervisorError::new(Code::DirectoryAmbiguous))
}
