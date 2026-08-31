// THROWAWAY topology probe. Only this executable can be started, never a provider.
// A host blocks on its private stdin until its coordinator has assigned and
// verified both the unnamed containment job and the named tracking job.
use crate::job;
use std::{
    io::{BufRead, BufReader, Write},
    os::windows::process::CommandExt,
    process::{Child, ChildStdin, Command, Stdio},
};

pub struct Host {
    pub child: Child,
    input: ChildStdin,
    pub token: u32,
    pub session_id: String,
}

fn command() -> Command {
    let mut cmd = Command::new(std::env::current_exe().unwrap());
    cmd.env_clear();
    for name in ["SystemRoot", "WINDIR", "TEMP", "TMP"] {
        if let Some(value) = std::env::var_os(name) {
            cmd.env(name, value);
        }
    }
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW, not a detached process.
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    cmd
}

impl Host {
    pub fn start() -> Self {
        let session_id = uuid::Uuid::new_v4().to_string();
        let token = job::create_named_session_job(&session_id).unwrap();
        // A collision must reject joining this already-owned tracking scope.
        assert!(job::create_named_session_job(&session_id).is_err());
        let mut child = command().args(["--host", &session_id]).spawn().unwrap();
        let mut output = BufReader::new(child.stdout.take().unwrap());
        let mut line = String::new();
        output.read_line(&mut line).unwrap();
        assert_eq!(line.trim(), "DORMANT");
        job::assign_process(token, child.id()).unwrap();
        assert!(job::verify_process_in_job(token, child.id()).unwrap());
        assert_eq!(
            job::inspect_job(token).unwrap().process_ids,
            vec![child.id()]
        );
        let input = child.stdin.take().unwrap();
        Self {
            child,
            input,
            token,
            session_id,
        }
    }

    pub fn report(&self) -> serde_json::Value {
        let scope = job::inspect_job(self.token).unwrap();
        serde_json::json!({"pid":self.child.id(),"sessionId":self.session_id,"phase":"dormant","containedWhileDormant":true,"providerStarted":false,"processIds":scope.process_ids})
    }

    pub fn stop(&mut self) {
        let _ = writeln!(self.input, "STOP");
        let _ = self.input.flush();
        assert!(self.child.wait().unwrap().success());
        assert!(job::inspect_job(self.token).unwrap().is_empty());
        job::close_job(self.token).unwrap();
    }
}

pub fn host_main() {
    // Defensive lifetime only; the normal idle state is a blocking pipe read.
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(240));
        std::process::exit(2);
    });
    println!("DORMANT");
    std::io::stdout().flush().unwrap();
    let mut line = String::new();
    std::io::stdin().lock().read_line(&mut line).unwrap();
    assert_eq!(line.trim(), "STOP");
}
