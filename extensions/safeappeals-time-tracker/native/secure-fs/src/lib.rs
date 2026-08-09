// Copyright (c) Safe Appeals. All rights reserved.

#![deny(unsafe_op_in_unsafe_fn)]

#[cfg(not(target_os = "linux"))]
compile_error!("safeappeals-secure-fs supports Linux only; refusing an insecure fallback");

#[cfg(target_os = "linux")]
mod linux {
    use napi::bindgen_prelude::{Buffer, ClassInstance, JsObjectValue, ToNapiValue};
    use napi::{Env, Error, Status};
    use napi_derive::napi;
    use std::ffi::{CStr, CString, OsStr};
    use std::fs::File;
    use std::io::{self, Write};
    use std::mem::{size_of, MaybeUninit};
    use std::os::fd::{AsRawFd, FromRawFd, RawFd};
    use std::os::unix::ffi::OsStrExt;

    type FsResult<T> = std::result::Result<T, Error<String>>;

    const RENAME_NOREPLACE: libc::c_uint = 1;
    const RESOLVE_NO_SYMLINKS: u64 = 0x04;
    const RESOLVE_BENEATH: u64 = 0x08;
    const QUARANTINE_PREFIX: &str = ".safeappeals-tx-";

    #[repr(C)]
    struct OpenHow {
        flags: u64,
        mode: u64,
        resolve: u64,
    }

    struct DirectoryStream(*mut libc::DIR);

    impl Drop for DirectoryStream {
        fn drop(&mut self) {
            if !self.0.is_null() {
                // SAFETY: the stream is uniquely owned by this guard.
                unsafe { libc::closedir(self.0) };
            }
        }
    }

    impl DirectoryStream {
        fn close(mut self) -> FsResult<()> {
            let stream = self.0;
            self.0 = std::ptr::null_mut();
            // SAFETY: stream was valid and uniquely owned before being cleared.
            if unsafe { libc::closedir(stream) } != 0 {
                return Err(io_error(
                    "close directory enumeration",
                    io::Error::last_os_error(),
                ));
            }
            Ok(())
        }
    }

    fn coded(code: &str, message: impl std::fmt::Display) -> Error<String> {
        Error::new(code.to_owned(), message.to_string())
    }

    fn napi_result<T>(env: Env, result: FsResult<T>) -> napi::Result<T> {
        result.map_err(|error| {
            let mut object =
                match env.create_error(Error::new(Status::GenericFailure, error.reason)) {
                    Ok(object) => object,
                    Err(conversion_error) => return conversion_error,
                };
            if let Err(conversion_error) = object.set_named_property("code", error.status) {
                return conversion_error;
            }
            match object.into_unknown(&env) {
                Ok(unknown) => Error::from(unknown),
                Err(conversion_error) => conversion_error,
            }
        })
    }

    fn io_error(operation: &str, error: io::Error) -> Error<String> {
        let code = match error.raw_os_error() {
            Some(libc::EEXIST) => "SA_FS_EXISTS",
            Some(libc::ENOENT) => "SA_FS_NOT_FOUND",
            Some(libc::ELOOP) => "SA_FS_SYMLINK",
            Some(libc::EWOULDBLOCK) => "SA_FS_LOCKED",
            Some(libc::EPERM) | Some(libc::EACCES) => "SA_FS_PERMISSION",
            Some(libc::ENOTDIR) => "SA_FS_NOT_DIRECTORY",
            Some(libc::ENOSYS) => "SA_FS_UNSUPPORTED",
            Some(libc::EXDEV) => "SA_FS_OUTSIDE_ROOT",
            Some(libc::EINVAL) => "SA_FS_INVALID",
            _ => "SA_FS_IO",
        };
        coded(code, format!("{operation}: {error}"))
    }

    fn basename(name: &str) -> FsResult<CString> {
        if name.is_empty() || name == "." || name == ".." || name.as_bytes().contains(&b'/') {
            return Err(coded("SA_FS_INVALID_NAME", "expected one non-dot basename"));
        }
        CString::new(name).map_err(|_| coded("SA_FS_INVALID_NAME", "basename contains NUL"))
    }

    fn identity_from_stat(stat: libc::stat) -> FileIdentity {
        FileIdentity {
            device: stat.st_dev.to_string(),
            inode: stat.st_ino.to_string(),
            kind: match stat.st_mode & libc::S_IFMT {
                libc::S_IFREG => "file",
                libc::S_IFDIR => "directory",
                libc::S_IFLNK => "symlink",
                _ => "other",
            }
            .to_owned(),
            link_count: u32::try_from(stat.st_nlink).unwrap_or(u32::MAX),
        }
    }

    fn fstat(fd: RawFd) -> FsResult<libc::stat> {
        let mut stat = MaybeUninit::<libc::stat>::uninit();
        // SAFETY: stat is writable storage of the correct size and fd is borrowed.
        if unsafe { libc::fstat(fd, stat.as_mut_ptr()) } != 0 {
            return Err(io_error("fstat", io::Error::last_os_error()));
        }
        // SAFETY: successful fstat initialized the complete value.
        Ok(unsafe { stat.assume_init() })
    }

    fn fstatat(dirfd: RawFd, name: &CString) -> FsResult<libc::stat> {
        let mut stat = MaybeUninit::<libc::stat>::uninit();
        // SAFETY: pointers are valid and AT_SYMLINK_NOFOLLOW prevents child traversal.
        if unsafe {
            libc::fstatat(
                dirfd,
                name.as_ptr(),
                stat.as_mut_ptr(),
                libc::AT_SYMLINK_NOFOLLOW,
            )
        } != 0
        {
            return Err(io_error("inspect child", io::Error::last_os_error()));
        }
        // SAFETY: successful fstatat initialized the complete value.
        Ok(unsafe { stat.assume_init() })
    }

    fn same_identity(left: &libc::stat, right: &libc::stat) -> bool {
        left.st_dev == right.st_dev && left.st_ino == right.st_ino
    }

    fn require_regular_single_link(stat: &libc::stat) -> FsResult<()> {
        if stat.st_mode & libc::S_IFMT != libc::S_IFREG {
            return Err(coded("SA_FS_NOT_REGULAR", "child is not a regular file"));
        }
        if stat.st_nlink != 1 {
            return Err(coded(
                "SA_FS_LINK_COUNT",
                format!("expected one link, found {}", stat.st_nlink),
            ));
        }
        Ok(())
    }

    fn require_private_regular(stat: &libc::stat, role: &str) -> FsResult<()> {
        require_regular_single_link(stat)?;
        // SAFETY: geteuid has no preconditions.
        if stat.st_uid != unsafe { libc::geteuid() } || stat.st_mode & 0o777 != 0o600 {
            return Err(coded(
                "SA_FS_UNTRUSTED_FILE",
                format!("{role} must be effective-UID-owned and exact mode 0600"),
            ));
        }
        Ok(())
    }

    fn require_legacy_readonly_regular(stat: &libc::stat, role: &str) -> FsResult<()> {
        require_regular_single_link(stat)?;
        // SAFETY: geteuid has no preconditions.
        if stat.st_uid != unsafe { libc::geteuid() }
            || stat.st_mode & 0o400 == 0
            || stat.st_mode & 0o022 != 0
        {
            return Err(coded(
                "SA_FS_UNTRUSTED_FILE",
                format!("{role} must be same-UID, owner-readable, and not group/other writable"),
            ));
        }
        Ok(())
    }

    fn require_private_directory(stat: &libc::stat, code: &str, role: &str) -> FsResult<()> {
        // SAFETY: geteuid has no preconditions and does not dereference memory.
        let effective_uid = unsafe { libc::geteuid() };
        if stat.st_uid != effective_uid
            || stat.st_mode & libc::S_IFMT != libc::S_IFDIR
            || stat.st_mode & 0o777 != 0o700
            || stat.st_nlink < 2
        {
            return Err(coded(
                code,
                format!("{role} must be an effective-UID-owned mode-0700 directory"),
            ));
        }
        Ok(())
    }

    fn require_trusted_anchor(stat: &libc::stat, role: &str) -> FsResult<()> {
        // SAFETY: geteuid has no preconditions.
        let effective_uid = unsafe { libc::geteuid() };
        if stat.st_uid != effective_uid
            || stat.st_mode & libc::S_IFMT != libc::S_IFDIR
            || stat.st_mode & 0o022 != 0
            || stat.st_mode & 0o500 != 0o500
            || stat.st_nlink < 2
        {
            return Err(coded(
                "SA_FS_UNTRUSTED_ANCHOR",
                format!("{role} must be same-UID, owner-readable/searchable, and not group/other writable"),
            ));
        }
        Ok(())
    }

    fn open_child(dirfd: RawFd, name: &CString, writable: bool) -> FsResult<File> {
        let access = if writable {
            libc::O_RDWR
        } else {
            libc::O_RDONLY
        };
        // SAFETY: valid dirfd/name; O_NOFOLLOW prevents final-component traversal.
        let fd = unsafe {
            libc::openat(
                dirfd,
                name.as_ptr(),
                access | libc::O_NOFOLLOW | libc::O_CLOEXEC,
            )
        };
        if fd < 0 {
            return Err(io_error("open child", io::Error::last_os_error()));
        }
        // SAFETY: successful openat returned a newly owned descriptor.
        Ok(unsafe { File::from_raw_fd(fd) })
    }

    #[napi(object)]
    #[derive(Clone)]
    pub struct FileIdentity {
        pub device: String,
        pub inode: String,
        pub kind: String,
        #[napi(js_name = "linkCount")]
        pub link_count: u32,
    }

    #[napi(object)]
    pub struct ChildEntry {
        pub name: String,
        pub device: String,
        pub inode: String,
        pub kind: String,
        #[napi(js_name = "linkCount")]
        pub link_count: u32,
        pub mode: u32,
        pub uid: u32,
    }

    #[napi]
    pub struct SecureFile {
        file: Option<File>,
        identity: FileIdentity,
    }

    impl SecureFile {
        fn raw_fd(&self) -> FsResult<RawFd> {
            self.file
                .as_ref()
                .map(AsRawFd::as_raw_fd)
                .ok_or_else(|| coded("SA_FS_CLOSED", "file handle is closed"))
        }

        fn descriptor_path(&self) -> FsResult<String> {
            Ok(format!("/proc/self/fd/{}", self.raw_fd()?))
        }
    }

    #[napi]
    impl SecureFile {
        #[napi(getter)]
        pub fn identity(&self) -> FileIdentity {
            self.identity.clone()
        }

        #[napi(getter, js_name = "descriptorPath")]
        pub fn descriptor_path_napi(&self, env: Env) -> napi::Result<String> {
            napi_result(env, self.descriptor_path())
        }

        #[napi]
        pub fn fsync(&self, env: Env) -> napi::Result<()> {
            napi_result(
                env,
                (|| {
                    self.file
                        .as_ref()
                        .ok_or_else(|| coded("SA_FS_CLOSED", "file handle is closed"))?
                        .sync_all()
                        .map_err(|error| io_error("fsync file", error))
                })(),
            )
        }

        #[napi]
        pub fn close(&mut self) {
            self.file.take();
        }

        #[napi]
        pub fn dispose(&mut self) {
            self.close();
        }
    }

    #[napi]
    pub struct DirectoryLock {
        directory: Option<File>,
    }

    impl DirectoryLock {
        fn raw_fd(&self) -> FsResult<RawFd> {
            self.directory
                .as_ref()
                .map(AsRawFd::as_raw_fd)
                .ok_or_else(|| coded("SA_FS_CLOSED", "directory lock is closed"))
        }

        fn descriptor_path(&self) -> FsResult<String> {
            Ok(format!("/proc/self/fd/{}", self.raw_fd()?))
        }

        fn write_atomic_sealed(
            &self,
            exact_name: &str,
            temporary_prefix: &[u8],
            temporary_name: &str,
            bytes: &[u8],
            expected: Option<FileIdentity>,
        ) -> FsResult<FileIdentity> {
            let dirfd = self.raw_fd()?;
            let destination = basename(exact_name)?;
            let temporary = basename(temporary_name)?;
            if !temporary.to_bytes().starts_with(temporary_prefix) {
                return Err(coded(
                    "SA_FS_INVALID_STAGE",
                    "sealed temporary name is not owned",
                ));
            }
            // SAFETY: exact validated temp child, exclusive private creation.
            let fd = unsafe {
                libc::openat(
                    dirfd,
                    temporary.as_ptr(),
                    libc::O_WRONLY
                        | libc::O_CREAT
                        | libc::O_EXCL
                        | libc::O_NOFOLLOW
                        | libc::O_CLOEXEC,
                    0o600,
                )
            };
            if fd < 0 {
                return Err(io_error(
                    "create sealed temporary",
                    io::Error::last_os_error(),
                ));
            }
            // SAFETY: successful openat returned an owned descriptor.
            let mut file = unsafe { File::from_raw_fd(fd) };
            file.set_permissions(std::os::unix::fs::PermissionsExt::from_mode(0o600))
                .map_err(|error| io_error("set sealed file permissions", error))?;
            file.write_all(bytes)
                .map_err(|error| io_error("write sealed file", error))?;
            file.sync_all()
                .map_err(|error| io_error("fsync sealed file", error))?;
            let temp_stat = fstat(file.as_raw_fd())?;
            require_private_regular(&temp_stat, "sealed temporary")?;
            let flags = if let Some(expected) = expected {
                let current = fstatat(dirfd, &destination)?;
                require_private_regular(&current, "current sealed file")?;
                if current.st_dev.to_string() != expected.device
                    || current.st_ino.to_string() != expected.inode
                {
                    return Err(coded(
                        "SA_FS_IDENTITY_MISMATCH",
                        "sealed file version changed",
                    ));
                }
                libc::RENAME_EXCHANGE
            } else {
                RENAME_NOREPLACE
            };
            // SAFETY: exact allowlisted destination and owned temp names in locked directory.
            let result = unsafe {
                libc::syscall(
                    libc::SYS_renameat2,
                    dirfd,
                    temporary.as_ptr(),
                    dirfd,
                    destination.as_ptr(),
                    flags,
                )
            };
            if result != 0 {
                return Err(io_error("commit sealed file", io::Error::last_os_error()));
            }
            let directory = self
                .directory
                .as_ref()
                .ok_or_else(|| coded("SA_FS_CLOSED", "directory lock is closed"))?;
            directory
                .sync_all()
                .map_err(|error| io_error("fsync committed sealed directory", error))?;
            if flags == libc::RENAME_EXCHANGE {
                // SAFETY: exact owned temporary now names the old version.
                if unsafe { libc::unlinkat(dirfd, temporary.as_ptr(), 0) } != 0 {
                    return Err(io_error(
                        "remove old sealed version",
                        io::Error::last_os_error(),
                    ));
                }
            }
            directory
                .sync_all()
                .map_err(|error| io_error("fsync sealed directory", error))?;
            let committed = fstatat(dirfd, &destination)?;
            require_private_regular(&committed, "committed sealed file")?;
            if !same_identity(&temp_stat, &committed) {
                return Err(coded(
                    "SA_FS_POSTCONDITION",
                    "committed sealed identity mismatch",
                ));
            }
            Ok(identity_from_stat(committed))
        }
    }

    #[napi]
    impl DirectoryLock {
        #[napi(getter, js_name = "directoryPath")]
        pub fn directory_path(&self, env: Env) -> napi::Result<String> {
            napi_result(env, self.descriptor_path())
        }
        #[napi]
        pub fn close(&mut self) {
            self.directory.take();
        }

        #[napi]
        pub fn dispose(&mut self) {
            self.close();
        }

        #[napi(js_name = "activateStagedNoReplace")]
        pub fn activate_staged_no_replace(
            &self,
            env: Env,
            staging_name: String,
            expected: ClassInstance<SecureFile>,
            destination: String,
        ) -> napi::Result<()> {
            napi_result(
                env,
                (|| {
                    let dirfd = self.raw_fd()?;
                    let staging_name = basename(&staging_name)?;
                    let destination = basename(&destination)?;
                    if !staging_name
                        .to_bytes()
                        .starts_with(QUARANTINE_PREFIX.as_bytes())
                    {
                        return Err(coded(
                            "SA_FS_INVALID_STAGE",
                            "activation requires a manifest-owned staging name",
                        ));
                    }
                    let reopened = open_child(dirfd, &staging_name, false)?;
                    let reopened_stat = fstat(reopened.as_raw_fd())?;
                    let expected_stat = fstat(expected.raw_fd()?)?;
                    require_regular_single_link(&reopened_stat)?;
                    require_regular_single_link(&expected_stat)?;
                    if !same_identity(&reopened_stat, &expected_stat) {
                        return Err(coded(
                            "SA_FS_STAGING_MISMATCH",
                            "staging entry was replaced; activation refused",
                        ));
                    }
                    // SAFETY: both names are validated children of the exclusively locked directory.
                    let result = unsafe {
                        libc::syscall(
                            libc::SYS_renameat2,
                            dirfd,
                            staging_name.as_ptr(),
                            dirfd,
                            destination.as_ptr(),
                            RENAME_NOREPLACE,
                        )
                    };
                    if result != 0 {
                        return Err(io_error(
                            "activate staging no-replace",
                            io::Error::last_os_error(),
                        ));
                    }
                    let destination_stat = fstatat(dirfd, &destination)?;
                    require_regular_single_link(&destination_stat)?;
                    if !same_identity(&expected_stat, &destination_stat) {
                        return Err(coded(
                            "SA_FS_IDENTITY_MISMATCH",
                            "activated destination does not identify expected staging",
                        ));
                    }
                    Ok(())
                })(),
            )
        }

        #[napi(js_name = "quarantineCurrent")]
        pub fn quarantine_current(
            &self,
            env: Env,
            source_name: String,
            staging_name: String,
            expected: ClassInstance<SecureFile>,
        ) -> napi::Result<SecureFile> {
            napi_result(
                env,
                (|| {
                    let dirfd = self.raw_fd()?;
                    let source_name = basename(&source_name)?;
                    let staging_name = basename(&staging_name)?;
                    if !staging_name
                        .to_bytes()
                        .starts_with(QUARANTINE_PREFIX.as_bytes())
                    {
                        return Err(coded(
                            "SA_FS_INVALID_STAGE",
                            "staging name is not manifest-owned",
                        ));
                    }
                    let current = open_child(dirfd, &source_name, false)?;
                    let current_stat = fstat(current.as_raw_fd())?;
                    let expected_stat = fstat(expected.raw_fd()?)?;
                    require_regular_single_link(&current_stat)?;
                    require_regular_single_link(&expected_stat)?;
                    if !same_identity(&current_stat, &expected_stat) {
                        return Err(coded(
                            "SA_FS_STAGING_MISMATCH",
                            "current entry is not the held expected file; quarantine refused",
                        ));
                    }
                    // SAFETY: names are validated children of the held and exclusively locked directory.
                    let result = unsafe {
                        libc::syscall(
                            libc::SYS_renameat2,
                            dirfd,
                            source_name.as_ptr(),
                            dirfd,
                            staging_name.as_ptr(),
                            RENAME_NOREPLACE,
                        )
                    };
                    if result != 0 {
                        return Err(io_error(
                            "quarantine no-replace",
                            io::Error::last_os_error(),
                        ));
                    }
                    let staged = open_child(dirfd, &staging_name, true)?;
                    let staged_stat = fstat(staged.as_raw_fd())?;
                    let expected_stat = fstat(expected.raw_fd()?)?;
                    require_regular_single_link(&staged_stat)?;
                    require_regular_single_link(&expected_stat)?;
                    if !same_identity(&staged_stat, &expected_stat) {
                        return Err(coded(
                    "SA_FS_STAGING_MISMATCH",
                    "quarantined entry is not the held expected file; staging was preserved",
                ));
                    }
                    Ok(SecureFile {
                        file: Some(staged),
                        identity: identity_from_stat(staged_stat),
                    })
                })(),
            )
        }

        #[napi(js_name = "deleteQuarantine")]
        pub fn delete_quarantine(
            &self,
            env: Env,
            staging_name: String,
            expected: ClassInstance<SecureFile>,
        ) -> napi::Result<()> {
            napi_result(
                env,
                (|| {
                    let dirfd = self.raw_fd()?;
                    let staging_name = basename(&staging_name)?;
                    if !staging_name
                        .to_bytes()
                        .starts_with(QUARANTINE_PREFIX.as_bytes())
                    {
                        return Err(coded(
                            "SA_FS_INVALID_STAGE",
                            "deletion is restricted to manifest-owned quarantine names",
                        ));
                    }
                    let reopened = open_child(dirfd, &staging_name, false)?;
                    let reopened_stat = fstat(reopened.as_raw_fd())?;
                    let expected_stat = fstat(expected.raw_fd()?)?;
                    require_regular_single_link(&reopened_stat)?;
                    require_regular_single_link(&expected_stat)?;
                    if !same_identity(&reopened_stat, &expected_stat) {
                        return Err(coded(
                            "SA_FS_STAGING_MISMATCH",
                            "quarantine entry was replaced; deletion refused",
                        ));
                    }
                    // SAFETY: the manifest-owned basename is anchored to the locked directory.
                    if unsafe { libc::unlinkat(dirfd, staging_name.as_ptr(), 0) } != 0 {
                        return Err(io_error("delete quarantine", io::Error::last_os_error()));
                    }
                    let after = fstat(expected.raw_fd()?)?;
                    if !same_identity(&expected_stat, &after) || after.st_nlink != 0 {
                        return Err(coded(
                            "SA_FS_POSTCONDITION",
                            "quarantine name was removed but the inode remains linked; secure purge not established",
                        ));
                    }
                    Ok(())
                })(),
            )
        }

        #[napi(js_name = "createStagedFile")]
        pub fn create_staged_file(&self, env: Env, name: String) -> napi::Result<SecureFile> {
            napi_result(
                env,
                (|| {
                    let dirfd = self.raw_fd()?;
                    let name = basename(&name)?;
                    if !name.to_bytes().starts_with(QUARANTINE_PREFIX.as_bytes()) {
                        return Err(coded(
                            "SA_FS_INVALID_STAGE",
                            "candidate must use a manifest-owned staging name",
                        ));
                    }
                    // SAFETY: validated child, exclusive create, no-follow, private mode.
                    let fd = unsafe {
                        libc::openat(
                            dirfd,
                            name.as_ptr(),
                            libc::O_RDWR
                                | libc::O_CREAT
                                | libc::O_EXCL
                                | libc::O_NOFOLLOW
                                | libc::O_CLOEXEC,
                            0o600,
                        )
                    };
                    if fd < 0 {
                        return Err(io_error("reserve staged file", io::Error::last_os_error()));
                    }
                    // SAFETY: successful openat returned an owned descriptor.
                    let file = unsafe { File::from_raw_fd(fd) };
                    file.set_permissions(std::os::unix::fs::PermissionsExt::from_mode(0o600))
                        .map_err(|error| io_error("set staged file permissions", error))?;
                    let stat = fstat(file.as_raw_fd())?;
                    require_private_regular(&stat, "staged file")?;
                    Ok(SecureFile {
                        file: Some(file),
                        identity: identity_from_stat(stat),
                    })
                })(),
            )
        }

        #[napi(js_name = "validateStagedFile")]
        pub fn validate_staged_file(
            &self,
            env: Env,
            name: String,
            expected: ClassInstance<SecureFile>,
        ) -> napi::Result<FileIdentity> {
            napi_result(
                env,
                (|| {
                    let name = basename(&name)?;
                    let reopened = open_child(self.raw_fd()?, &name, true)?;
                    let actual = fstat(reopened.as_raw_fd())?;
                    let held = fstat(expected.raw_fd()?)?;
                    require_private_regular(&actual, "staged candidate")?;
                    require_private_regular(&held, "held staged candidate")?;
                    if !same_identity(&actual, &held) {
                        return Err(coded(
                            "SA_FS_IDENTITY_MISMATCH",
                            "staged candidate was replaced",
                        ));
                    }
                    Ok(identity_from_stat(actual))
                })(),
            )
        }

        #[napi(js_name = "writeEncryptedManifest")]
        pub fn write_encrypted_manifest(
            &self,
            env: Env,
            temporary_name: String,
            bytes: Buffer,
            expected: Option<FileIdentity>,
        ) -> napi::Result<FileIdentity> {
            napi_result(
                env,
                (|| {
                    let dirfd = self.raw_fd()?;
                    let manifest = basename(".timetracker-migration-v1.saenc")?;
                    let temporary = basename(&temporary_name)?;
                    if !temporary
                        .to_bytes()
                        .starts_with(b".safeappeals-tx-manifest-")
                    {
                        return Err(coded(
                            "SA_FS_INVALID_STAGE",
                            "manifest temporary name is not owned",
                        ));
                    }
                    // SAFETY: exact validated temp child, exclusive private creation.
                    let fd = unsafe {
                        libc::openat(
                            dirfd,
                            temporary.as_ptr(),
                            libc::O_WRONLY
                                | libc::O_CREAT
                                | libc::O_EXCL
                                | libc::O_NOFOLLOW
                                | libc::O_CLOEXEC,
                            0o600,
                        )
                    };
                    if fd < 0 {
                        return Err(io_error(
                            "create manifest temporary",
                            io::Error::last_os_error(),
                        ));
                    }
                    // SAFETY: successful openat returned an owned descriptor.
                    let mut file = unsafe { File::from_raw_fd(fd) };
                    file.set_permissions(std::os::unix::fs::PermissionsExt::from_mode(0o600))
                        .map_err(|error| io_error("set manifest permissions", error))?;
                    file.write_all(bytes.as_ref())
                        .map_err(|error| io_error("write manifest", error))?;
                    file.sync_all()
                        .map_err(|error| io_error("fsync manifest", error))?;
                    let temp_stat = fstat(file.as_raw_fd())?;
                    require_private_regular(&temp_stat, "manifest temporary")?;
                    let flags = if let Some(expected) = expected {
                        let current = fstatat(dirfd, &manifest)?;
                        require_private_regular(&current, "current manifest")?;
                        if current.st_dev.to_string() != expected.device
                            || current.st_ino.to_string() != expected.inode
                        {
                            return Err(coded(
                                "SA_FS_IDENTITY_MISMATCH",
                                "manifest version changed",
                            ));
                        }
                        libc::RENAME_EXCHANGE
                    } else {
                        RENAME_NOREPLACE
                    };
                    // SAFETY: exact manifest and owned temp names in locked directory.
                    let result = unsafe {
                        libc::syscall(
                            libc::SYS_renameat2,
                            dirfd,
                            temporary.as_ptr(),
                            dirfd,
                            manifest.as_ptr(),
                            flags,
                        )
                    };
                    if result != 0 {
                        return Err(io_error("commit manifest", io::Error::last_os_error()));
                    }
                    self.directory
                        .as_ref()
                        .ok_or_else(|| coded("SA_FS_CLOSED", "directory lock is closed"))?
                        .sync_all()
                        .map_err(|error| io_error("fsync committed manifest directory", error))?;
                    if flags == libc::RENAME_EXCHANGE {
                        // Old version is now the owned temp; failure leaves a recoverable crash artifact.
                        // SAFETY: exact owned temporary child.
                        if unsafe { libc::unlinkat(dirfd, temporary.as_ptr(), 0) } != 0 {
                            return Err(io_error(
                                "remove old manifest version",
                                io::Error::last_os_error(),
                            ));
                        }
                    }
                    self.directory
                        .as_ref()
                        .ok_or_else(|| coded("SA_FS_CLOSED", "directory lock is closed"))?
                        .sync_all()
                        .map_err(|error| io_error("fsync manifest directory", error))?;
                    let committed = fstatat(dirfd, &manifest)?;
                    require_private_regular(&committed, "committed manifest")?;
                    if !same_identity(&temp_stat, &committed) {
                        return Err(coded(
                            "SA_FS_POSTCONDITION",
                            "committed manifest identity mismatch",
                        ));
                    }
                    Ok(identity_from_stat(committed))
                })(),
            )
        }

        #[napi(js_name = "writeSensitiveState")]
        pub fn write_sensitive_state(
            &self,
            env: Env,
            temporary_name: String,
            bytes: Buffer,
            expected: Option<FileIdentity>,
        ) -> napi::Result<FileIdentity> {
            napi_result(
                env,
                self.write_atomic_sealed(
                    "sensitive-state.saenc",
                    b".safeappeals-tx-sensitive-state-",
                    &temporary_name,
                    bytes.as_ref(),
                    expected,
                ),
            )
        }

        #[napi(js_name = "fsyncDirectory")]
        pub fn fsync_directory(&self, env: Env) -> napi::Result<()> {
            napi_result(
                env,
                (|| {
                    self.directory
                        .as_ref()
                        .ok_or_else(|| coded("SA_FS_CLOSED", "directory lock is closed"))?
                        .sync_all()
                        .map_err(|error| io_error("fsync directory", error))
                })(),
            )
        }
    }

    #[napi]
    pub struct SecureDirectory {
        directory: Option<File>,
        root: Option<File>,
        relative_path: CString,
        identity: FileIdentity,
    }

    impl SecureDirectory {
        fn raw_fd(&self) -> FsResult<RawFd> {
            self.directory
                .as_ref()
                .map(AsRawFd::as_raw_fd)
                .ok_or_else(|| coded("SA_FS_CLOSED", "secure directory is closed"))
        }

        fn reopen_and_validate(&self) -> FsResult<()> {
            self.raw_fd()?;
            let root = self
                .root
                .as_ref()
                .ok_or_else(|| coded("SA_FS_CLOSED", "secure directory is closed"))?;
            let reopened = open_beneath(root.as_raw_fd(), &self.relative_path)?;
            let root_stat = fstat(root.as_raw_fd())?;
            require_trusted_anchor(&root_stat, "trusted anchor")?;
            let actual = fstat(reopened.as_raw_fd())?;
            require_private_directory(&actual, "SA_FS_UNTRUSTED_DIRECTORY", "resolved directory")?;
            if actual.st_dev.to_string() != self.identity.device
                || actual.st_ino.to_string() != self.identity.inode
            {
                return Err(coded(
                    "SA_FS_DIRECTORY_REPLACED",
                    "directory path no longer identifies the held directory",
                ));
            }
            Ok(())
        }

        fn enumerate(&self, limit: u32) -> FsResult<Vec<ChildEntry>> {
            if limit == 0 || limit > 4096 {
                return Err(coded(
                    "SA_FS_INVALID_LIMIT",
                    "enumeration limit must be 1..4096",
                ));
            }
            let fd = self.raw_fd()?;
            // SAFETY: fixed "." creates an independent open-file description, so enumeration
            // never shares or advances the SecureDirectory descriptor offset.
            let enumeration_fd = unsafe {
                libc::openat(
                    fd,
                    c".".as_ptr(),
                    libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC,
                )
            };
            if enumeration_fd < 0 {
                return Err(io_error(
                    "open independent directory enumeration",
                    io::Error::last_os_error(),
                ));
            }
            // SAFETY: enumeration_fd is an owned directory descriptor consumed by fdopendir.
            let raw_stream = unsafe { libc::fdopendir(enumeration_fd) };
            if raw_stream.is_null() {
                // SAFETY: fdopendir failed and did not consume enumeration_fd.
                unsafe { libc::close(enumeration_fd) };
                return Err(io_error(
                    "open directory enumeration",
                    io::Error::last_os_error(),
                ));
            }
            let stream = DirectoryStream(raw_stream);
            let mut entries = Vec::new();
            loop {
                // SAFETY: errno_location is valid for the current thread.
                unsafe { *libc::__errno_location() = 0 };
                // SAFETY: stream remains valid until closed below.
                let entry = unsafe { libc::readdir(stream.0) };
                if entry.is_null() {
                    // SAFETY: errno_location is valid for the current thread.
                    let error_number = unsafe { *libc::__errno_location() };
                    if error_number != 0 {
                        return Err(io_error(
                            "read directory enumeration",
                            io::Error::from_raw_os_error(error_number),
                        ));
                    }
                    break;
                }
                // SAFETY: d_name is NUL-terminated for a successful readdir entry.
                let name_bytes =
                    unsafe { std::ffi::CStr::from_ptr((*entry).d_name.as_ptr()) }.to_bytes();
                if name_bytes == b"." || name_bytes == b".." {
                    continue;
                }
                if entries.len() >= limit as usize {
                    return Err(coded(
                        "SA_FS_ENUM_LIMIT",
                        "directory contains more entries than allowed",
                    ));
                }
                let name = std::str::from_utf8(name_bytes)
                    .map_err(|_| coded("SA_FS_INVALID_NAME", "child basename is not UTF-8"))?;
                let c_name = basename(name)?;
                let stat = fstatat(fd, &c_name)?;
                let identity = identity_from_stat(stat);
                entries.push(ChildEntry {
                    name: name.to_owned(),
                    device: identity.device,
                    inode: identity.inode,
                    kind: identity.kind,
                    link_count: identity.link_count,
                    mode: stat.st_mode & 0o7777,
                    uid: stat.st_uid,
                });
            }
            stream.close()?;
            Ok(entries)
        }
    }

    fn open_beneath(rootfd: RawFd, relative: &CStr) -> FsResult<File> {
        let how = OpenHow {
            flags: (libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC) as u64,
            mode: 0,
            resolve: RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS,
        };
        // SAFETY: open_how and path pointers are valid; the kernel receives their exact sizes.
        let fd = unsafe {
            libc::syscall(
                libc::SYS_openat2,
                rootfd,
                relative.as_ptr(),
                &how,
                size_of::<OpenHow>(),
            )
        } as RawFd;
        if fd < 0 {
            return Err(io_error(
                "open directory beneath trusted root",
                io::Error::last_os_error(),
            ));
        }
        // SAFETY: successful openat2 returned a newly owned descriptor.
        Ok(unsafe { File::from_raw_fd(fd) })
    }

    #[napi]
    impl SecureDirectory {
        #[napi(constructor)]
        pub fn new(env: Env, trusted_root: String, relative_path: String) -> napi::Result<Self> {
            napi_result(
                env,
                (|| {
                    let root_path = CString::new(OsStr::new(&trusted_root).as_bytes())
                        .map_err(|_| coded("SA_FS_INVALID_PATH", "trusted root contains NUL"))?;
                    // SAFETY: root_path is valid and flags reject a symlink root.
                    let root_fd = unsafe {
                        libc::open(
                            root_path.as_ptr(),
                            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
                        )
                    };
                    if root_fd < 0 {
                        return Err(io_error("open trusted root", io::Error::last_os_error()));
                    }
                    // SAFETY: successful open returned a newly owned descriptor.
                    let root = unsafe { File::from_raw_fd(root_fd) };
                    let root_stat = fstat(root.as_raw_fd())?;
                    // A trusted root must be private and owned by the effective user.
                    require_trusted_anchor(&root_stat, "trusted anchor")?;
                    if relative_path.is_empty() || relative_path.starts_with('/') {
                        return Err(coded(
                            "SA_FS_INVALID_PATH",
                            "relative directory path is required",
                        ));
                    }
                    let relative_path = CString::new(relative_path)
                        .map_err(|_| coded("SA_FS_INVALID_PATH", "relative path contains NUL"))?;
                    let directory = open_beneath(root.as_raw_fd(), &relative_path)?;
                    let stat = fstat(directory.as_raw_fd())?;
                    require_private_directory(
                        &stat,
                        "SA_FS_UNTRUSTED_DIRECTORY",
                        "resolved directory",
                    )?;
                    Ok(Self {
                        directory: Some(directory),
                        root: Some(root),
                        relative_path,
                        identity: identity_from_stat(stat),
                    })
                })(),
            )
        }

        #[napi]
        pub fn inspect(&self, env: Env, name: String) -> napi::Result<FileIdentity> {
            napi_result(
                env,
                (|| {
                    Ok(identity_from_stat(fstatat(
                        self.raw_fd()?,
                        &basename(&name)?,
                    )?))
                })(),
            )
        }

        #[napi(js_name = "enumerateChildren")]
        pub fn enumerate_children(&self, env: Env, limit: u32) -> napi::Result<Vec<ChildEntry>> {
            napi_result(env, self.enumerate(limit))
        }

        #[napi(js_name = "openPrivateChild")]
        pub fn open_private_child(&self, env: Env, name: String) -> napi::Result<SecureDirectory> {
            napi_result(
                env,
                (|| {
                    let parent_fd = self.raw_fd()?;
                    let name = basename(&name)?;
                    let child = open_beneath(parent_fd, &name)?;
                    let stat = fstat(child.as_raw_fd())?;
                    require_private_directory(&stat, "SA_FS_UNTRUSTED_DIRECTORY", "private child")?;
                    // SAFETY: fixed "." creates an independent descriptor for the child anchor.
                    let root_fd = unsafe {
                        libc::openat(
                            parent_fd,
                            c".".as_ptr(),
                            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC,
                        )
                    };
                    if root_fd < 0 {
                        return Err(io_error(
                            "open private child anchor",
                            io::Error::last_os_error(),
                        ));
                    }
                    // SAFETY: successful openat returned an owned descriptor.
                    let root = unsafe { File::from_raw_fd(root_fd) };
                    Ok(SecureDirectory {
                        directory: Some(child),
                        root: Some(root),
                        relative_path: name,
                        identity: identity_from_stat(stat),
                    })
                })(),
            )
        }

        #[napi(js_name = "openRegularFile")]
        pub fn open_regular_file(
            &self,
            env: Env,
            name: String,
            writable: bool,
        ) -> napi::Result<SecureFile> {
            napi_result(
                env,
                (|| {
                    let file = open_child(self.raw_fd()?, &basename(&name)?, writable)?;
                    let stat = fstat(file.as_raw_fd())?;
                    require_regular_single_link(&stat)?;
                    Ok(SecureFile {
                        file: Some(file),
                        identity: identity_from_stat(stat),
                    })
                })(),
            )
        }

        #[napi(js_name = "acquireExclusiveLock")]
        pub fn acquire_exclusive_lock(&self, env: Env) -> napi::Result<DirectoryLock> {
            napi_result(
                env,
                (|| {
                    let fd = self.raw_fd()?;
                    // SAFETY: opening the fixed "." child creates an independent open-file
                    // description for flock while remaining anchored to the held directory.
                    let lock_fd = unsafe {
                        libc::openat(
                            fd,
                            c".".as_ptr(),
                            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC,
                        )
                    };
                    if lock_fd < 0 {
                        return Err(io_error(
                            "open directory lock descriptor",
                            io::Error::last_os_error(),
                        ));
                    }
                    // SAFETY: successful openat returned a newly owned descriptor.
                    let lock_file = unsafe { File::from_raw_fd(lock_fd) };
                    // SAFETY: lock_file remains owned for the complete token lifetime.
                    if unsafe { libc::flock(lock_file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) }
                        != 0
                    {
                        return Err(io_error(
                            "acquire directory lock",
                            io::Error::last_os_error(),
                        ));
                    }
                    self.reopen_and_validate()?;
                    Ok(DirectoryLock {
                        directory: Some(lock_file),
                    })
                })(),
            )
        }

        #[napi]
        pub fn close(&mut self) {
            self.directory.take();
            self.root.take();
        }

        #[napi]
        pub fn dispose(&mut self) {
            self.close();
        }
    }

    fn open_anchor(path: &str) -> FsResult<File> {
        let path = CString::new(OsStr::new(path).as_bytes())
            .map_err(|_| coded("SA_FS_INVALID_PATH", "anchor contains NUL"))?;
        // SAFETY: valid path; O_NOFOLLOW rejects a symlink anchor.
        let fd = unsafe {
            libc::open(
                path.as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
            )
        };
        if fd < 0 {
            return Err(io_error("open trusted anchor", io::Error::last_os_error()));
        }
        // SAFETY: successful open returned an owned descriptor.
        let file = unsafe { File::from_raw_fd(fd) };
        require_trusted_anchor(&fstat(file.as_raw_fd())?, "trusted anchor")?;
        Ok(file)
    }

    fn bootstrap(anchor_path: &str, components: &[String]) -> FsResult<SecureDirectory> {
        if components.is_empty() {
            return Err(coded(
                "SA_FS_INVALID_PATH",
                "private descendant chain is empty",
            ));
        }
        let root = open_anchor(anchor_path)?;
        let mut parent = open_beneath(root.as_raw_fd(), c".")?;
        let mut relative = Vec::new();
        for component in components {
            let component = basename(component)?;
            // SAFETY: exact validated child; EEXIST is handled by secure reopen/validation.
            let result = unsafe { libc::mkdirat(parent.as_raw_fd(), component.as_ptr(), 0o700) };
            if result != 0 && io::Error::last_os_error().raw_os_error() != Some(libc::EEXIST) {
                return Err(io_error(
                    "create private directory",
                    io::Error::last_os_error(),
                ));
            }
            let child = open_beneath(parent.as_raw_fd(), &component)?;
            require_private_directory(
                &fstat(child.as_raw_fd())?,
                "SA_FS_UNTRUSTED_DIRECTORY",
                "private descendant",
            )?;
            parent
                .sync_all()
                .map_err(|error| io_error("fsync private parent", error))?;
            relative.push(component.to_string_lossy().into_owned());
            parent = child;
        }
        let stat = fstat(parent.as_raw_fd())?;
        Ok(SecureDirectory {
            directory: Some(parent),
            root: Some(root),
            relative_path: CString::new(relative.join("/"))
                .map_err(|_| coded("SA_FS_INVALID_PATH", "invalid chain"))?,
            identity: identity_from_stat(stat),
        })
    }

    #[napi(js_name = "bootstrapPrivateDirectory")]
    pub fn bootstrap_private_directory(
        env: Env,
        anchor_path: String,
        components: Vec<String>,
    ) -> napi::Result<SecureDirectory> {
        napi_result(env, bootstrap(&anchor_path, &components))
    }

    #[napi(js_name = "openLegacyWorkspace")]
    pub fn open_legacy_workspace(
        env: Env,
        home_path: String,
        workspace_id: String,
    ) -> napi::Result<SecureDirectory> {
        napi_result(
            env,
            (|| {
                if workspace_id.len() != 16
                    || !workspace_id.bytes().all(|byte| byte.is_ascii_hexdigit())
                {
                    return Err(coded(
                        "SA_FS_INVALID_NAME",
                        "legacy workspace id must be exactly 16 hexadecimal characters",
                    ));
                }
                let root = open_anchor(&home_path)?;
                let relative_text =
                    format!(".safe-appeals-navigator/databases/workspaces/{workspace_id}");
                let relative = CString::new(relative_text)
                    .map_err(|_| coded("SA_FS_INVALID_PATH", "legacy path contains NUL"))?;
                let mut parent = open_beneath(root.as_raw_fd(), c".")?;
                for component in [".safe-appeals-navigator", "databases", "workspaces"] {
                    let child = open_beneath(parent.as_raw_fd(), &basename(component)?)?;
                    require_trusted_anchor(&fstat(child.as_raw_fd())?, "legacy ancestor")?;
                    parent = child;
                }
                let directory = open_beneath(parent.as_raw_fd(), &basename(&workspace_id)?)?;
                let stat = fstat(directory.as_raw_fd())?;
                require_private_directory(&stat, "SA_FS_UNTRUSTED_DIRECTORY", "legacy workspace")?;
                Ok(SecureDirectory {
                    directory: Some(directory),
                    root: Some(root),
                    relative_path: relative,
                    identity: identity_from_stat(stat),
                })
            })(),
        )
    }

    #[napi]
    pub struct LegacyWorkspaces {
        directory: SecureDirectory,
    }

    #[napi]
    impl LegacyWorkspaces {
        #[napi(js_name = "enumerateWorkspaceIds")]
        pub fn enumerate_workspace_ids(&self, env: Env, limit: u32) -> napi::Result<Vec<String>> {
            napi_result(
                env,
                (|| {
                    let entries = self.directory.enumerate(limit)?;
                    Ok(entries
                        .into_iter()
                        .filter(|entry| {
                            entry.kind == "directory"
                                && entry.name.len() == 16
                                && entry.name.bytes().all(|byte| byte.is_ascii_hexdigit())
                        })
                        .map(|entry| entry.name)
                        .collect())
                })(),
            )
        }

        #[napi(js_name = "openWorkspace")]
        pub fn open_workspace(
            &self,
            env: Env,
            workspace_id: String,
        ) -> napi::Result<SecureDirectory> {
            napi_result(
                env,
                (|| {
                    if workspace_id.len() != 16
                        || !workspace_id.bytes().all(|byte| byte.is_ascii_hexdigit())
                    {
                        return Err(coded(
                            "SA_FS_INVALID_NAME",
                            "legacy workspace id must be exactly 16 hexadecimal characters",
                        ));
                    }
                    let parent_fd = self.directory.raw_fd()?;
                    let name = basename(&workspace_id)?;
                    let child = open_beneath(parent_fd, &name)?;
                    let stat = fstat(child.as_raw_fd())?;
                    require_private_directory(
                        &stat,
                        "SA_FS_UNTRUSTED_DIRECTORY",
                        "legacy workspace",
                    )?;
                    // SAFETY: fixed dot opens an independent parent anchor.
                    let root_fd = unsafe {
                        libc::openat(
                            parent_fd,
                            c".".as_ptr(),
                            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC,
                        )
                    };
                    if root_fd < 0 {
                        return Err(io_error(
                            "open legacy workspaces anchor",
                            io::Error::last_os_error(),
                        ));
                    }
                    // SAFETY: successful openat returned an owned descriptor.
                    let root = unsafe { File::from_raw_fd(root_fd) };
                    Ok(SecureDirectory {
                        directory: Some(child),
                        root: Some(root),
                        relative_path: name,
                        identity: identity_from_stat(stat),
                    })
                })(),
            )
        }

        #[napi]
        pub fn close(&mut self) {
            self.directory.close();
        }

        #[napi]
        pub fn dispose(&mut self) {
            self.close();
        }
    }

    #[napi(js_name = "openLegacyWorkspaces")]
    pub fn open_legacy_workspaces(
        env: Env,
        home_path: String,
    ) -> napi::Result<Option<LegacyWorkspaces>> {
        napi_result(
            env,
            (|| {
                let root = open_anchor(&home_path)?;
                let mut parent = open_beneath(root.as_raw_fd(), c".")?;
                for component in [".safe-appeals-navigator", "databases", "workspaces"] {
                    let child = match open_beneath(parent.as_raw_fd(), &basename(component)?) {
                        Ok(child) => child,
                        Err(error) if error.status == "SA_FS_NOT_FOUND" => return Ok(None),
                        Err(error) => return Err(error),
                    };
                    require_trusted_anchor(&fstat(child.as_raw_fd())?, "legacy ancestor")?;
                    parent = child;
                }
                let stat = fstat(parent.as_raw_fd())?;
                Ok(Some(LegacyWorkspaces {
                    directory: SecureDirectory {
                        directory: Some(parent),
                        root: Some(root),
                        relative_path: CString::new(".safe-appeals-navigator/databases/workspaces")
                            .map_err(|_| {
                                coded("SA_FS_INVALID_PATH", "fixed legacy path is invalid")
                            })?,
                        identity: identity_from_stat(stat),
                    },
                }))
            })(),
        )
    }

    #[napi]
    pub struct LegacyCodesLock {
        lock: DirectoryLock,
    }

    #[napi]
    impl LegacyCodesLock {
        #[napi(js_name = "quarantineCodes")]
        pub fn quarantine_codes(
            &self,
            env: Env,
            staging_name: String,
            expected: ClassInstance<SecureFile>,
        ) -> napi::Result<SecureFile> {
            self.lock.quarantine_current(
                env,
                "time-tracker-codes.json".to_owned(),
                staging_name,
                expected,
            )
        }

        #[napi(js_name = "deleteQuarantine")]
        pub fn delete_quarantine(
            &self,
            env: Env,
            staging_name: String,
            expected: ClassInstance<SecureFile>,
        ) -> napi::Result<()> {
            self.lock.delete_quarantine(env, staging_name, expected)
        }

        #[napi]
        pub fn close(&mut self) {
            self.lock.close();
        }

        #[napi]
        pub fn dispose(&mut self) {
            self.close();
        }
    }

    #[napi]
    pub struct LegacyCodesWorkspace {
        directory: SecureDirectory,
        requires_private_namespace: bool,
    }

    #[napi]
    impl LegacyCodesWorkspace {
        #[napi(js_name = "inspectCodes")]
        pub fn inspect_codes(&self, env: Env) -> napi::Result<Option<FileIdentity>> {
            napi_result(
                env,
                (|| {
                    let dirfd = self.directory.raw_fd()?;
                    let name = basename("time-tracker-codes.json")?;
                    match fstatat(dirfd, &name) {
                        Ok(stat) => Ok(Some(identity_from_stat(stat))),
                        Err(error) if error.status == "SA_FS_NOT_FOUND" => Ok(None),
                        Err(error) => Err(error),
                    }
                })(),
            )
        }

        #[napi(js_name = "openCodes")]
        pub fn open_codes(&self, env: Env) -> napi::Result<SecureFile> {
            self.directory
                .open_regular_file(env, "time-tracker-codes.json".to_owned(), true)
        }

        #[napi(js_name = "acquireExclusiveLock")]
        pub fn acquire_exclusive_lock(&self, env: Env) -> napi::Result<LegacyCodesLock> {
            napi_result(
                env,
                (|| {
                    let fd = self.directory.raw_fd()?;
                    // SAFETY: fixed dot opens an independent description for flock.
                    let lock_fd = unsafe {
                        libc::openat(
                            fd,
                            c".".as_ptr(),
                            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC,
                        )
                    };
                    if lock_fd < 0 {
                        return Err(io_error(
                            "open codes workspace lock",
                            io::Error::last_os_error(),
                        ));
                    }
                    // SAFETY: successful openat returned an owned descriptor.
                    let lock_file = unsafe { File::from_raw_fd(lock_fd) };
                    // SAFETY: lock_file remains owned by the returned token.
                    if unsafe { libc::flock(lock_file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) }
                        != 0
                    {
                        return Err(io_error(
                            "acquire codes workspace lock",
                            io::Error::last_os_error(),
                        ));
                    }
                    let root = self
                        .directory
                        .root
                        .as_ref()
                        .ok_or_else(|| coded("SA_FS_CLOSED", "codes workspace is closed"))?;
                    let reopened = open_beneath(root.as_raw_fd(), &self.directory.relative_path)?;
                    let actual = fstat(reopened.as_raw_fd())?;
                    if self.requires_private_namespace {
                        require_private_directory(
                            &actual,
                            "SA_FS_UNTRUSTED_DIRECTORY",
                            "legacy codes workspace",
                        )?;
                    } else {
                        require_trusted_anchor(&actual, "legacy codes workspace")?;
                    }
                    if actual.st_dev.to_string() != self.directory.identity.device
                        || actual.st_ino.to_string() != self.directory.identity.inode
                    {
                        return Err(coded(
                            "SA_FS_DIRECTORY_REPLACED",
                            "codes workspace path was replaced",
                        ));
                    }
                    Ok(LegacyCodesLock {
                        lock: DirectoryLock {
                            directory: Some(lock_file),
                        },
                    })
                })(),
            )
        }

        #[napi]
        pub fn close(&mut self) {
            self.directory.close();
        }

        #[napi]
        pub fn dispose(&mut self) {
            self.close();
        }
    }

    #[napi(js_name = "openLegacyCodesWorkspace")]
    pub fn open_legacy_codes_workspace(
        env: Env,
        workspace_path: String,
    ) -> napi::Result<Option<LegacyCodesWorkspace>> {
        napi_result(
            env,
            (|| {
                if !workspace_path.starts_with('/') {
                    return Err(coded(
                        "SA_FS_INVALID_PATH",
                        "workspace path must be absolute",
                    ));
                }
                // SAFETY: fixed filesystem root path and no-follow directory flags.
                let root_fd = unsafe {
                    libc::open(
                        c"/".as_ptr(),
                        libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
                    )
                };
                if root_fd < 0 {
                    return Err(io_error("open filesystem root", io::Error::last_os_error()));
                }
                // SAFETY: successful open returned an owned descriptor.
                let root = unsafe { File::from_raw_fd(root_fd) };
                let relative_text = workspace_path.trim_start_matches('/');
                if relative_text.is_empty() {
                    return Err(coded(
                        "SA_FS_INVALID_PATH",
                        "filesystem root is not a workspace",
                    ));
                }
                let relative = CString::new(relative_text)
                    .map_err(|_| coded("SA_FS_INVALID_PATH", "workspace path contains NUL"))?;
                let directory = match open_beneath(root.as_raw_fd(), &relative) {
                    Ok(directory) => directory,
                    Err(error) if error.status == "SA_FS_NOT_FOUND" => return Ok(None),
                    Err(error) => return Err(error),
                };
                let codes_name = basename("time-tracker-codes.json")?;
                let first_probe = match open_child(directory.as_raw_fd(), &codes_name, false) {
                    Ok(file) => file,
                    Err(error) if error.status == "SA_FS_NOT_FOUND" => return Ok(None),
                    Err(error) => return Err(error),
                };
                let first_identity = fstat(first_probe.as_raw_fd())?;
                require_legacy_readonly_regular(&first_identity, "legacy codes file")?;
                let requires_private_namespace = first_identity.st_mode & 0o777 != 0o600;
                let stat = fstat(directory.as_raw_fd())?;
                if requires_private_namespace {
                    require_private_directory(
                        &stat,
                        "SA_FS_UNTRUSTED_DIRECTORY",
                        "legacy codes workspace",
                    )?;
                } else {
                    require_trusted_anchor(&stat, "legacy codes workspace")?;
                }
                let second_probe = open_child(directory.as_raw_fd(), &codes_name, false)?;
                let second_identity = fstat(second_probe.as_raw_fd())?;
                require_legacy_readonly_regular(&second_identity, "legacy codes file")?;
                if !same_identity(&first_identity, &second_identity) {
                    return Err(coded(
                        "SA_FS_IDENTITY_MISMATCH",
                        "legacy codes file changed during workspace validation",
                    ));
                }
                Ok(Some(LegacyCodesWorkspace {
                    directory: SecureDirectory {
                        directory: Some(directory),
                        root: Some(root),
                        relative_path: relative,
                        identity: identity_from_stat(stat),
                    },
                    requires_private_namespace,
                }))
            })(),
        )
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::fs;
        use std::os::unix::fs::PermissionsExt;

        #[test]
        fn basename_validation() {
            for invalid in ["", ".", "..", "a/b", "a\0b"] {
                assert!(basename(invalid).is_err());
            }
        }

        #[test]
        fn openat2_rejects_escape_and_symlink_components() {
            let root = tempfile::tempdir().unwrap();
            fs::set_permissions(root.path(), fs::Permissions::from_mode(0o700)).unwrap();
            fs::create_dir(root.path().join("data")).unwrap();
            std::os::unix::fs::symlink("data", root.path().join("link")).unwrap();
            let root_fd = File::open(root.path()).unwrap();
            assert!(open_beneath(root_fd.as_raw_fd(), &CString::new("../").unwrap()).is_err());
            assert!(open_beneath(root_fd.as_raw_fd(), &CString::new("link").unwrap()).is_err());
        }

        #[test]
        fn private_directory_invariant_rejects_wrong_owner_and_modes() {
            let root = tempfile::tempdir().unwrap();
            fs::set_permissions(root.path(), fs::Permissions::from_mode(0o700)).unwrap();
            let file = File::open(root.path()).unwrap();
            let valid = fstat(file.as_raw_fd()).unwrap();
            assert!(require_private_directory(&valid, "TEST", "directory").is_ok());
            let mut wrong_owner = valid;
            wrong_owner.st_uid = wrong_owner.st_uid.wrapping_add(1);
            assert!(require_private_directory(&wrong_owner, "TEST", "directory").is_err());
            for mode in [0o000, 0o100, 0o500, 0o600, 0o750] {
                let mut wrong_mode = valid;
                wrong_mode.st_mode = libc::S_IFDIR | mode;
                assert!(require_private_directory(&wrong_mode, "TEST", "directory").is_err());
            }
        }
    }
}

#[cfg(target_os = "linux")]
pub use linux::*;
