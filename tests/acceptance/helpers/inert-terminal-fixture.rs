//! Nonshipping terminal fixture for an isolated installed-app acceptance profile.
//! Build as codex.exe ONLY inside t173-fixture-bin. Compatibility probe responses
//! simulate an adapter fixture; they are never evidence of real provider authentication.
use std::io::{self, BufRead, Write};

fn main() {
    let executable = std::env::current_exe().unwrap();
    assert_eq!(
        executable.parent().unwrap().file_name().unwrap(),
        "t173-fixture-bin"
    );
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args == ["--version"] {
        println!("threadhelm-inert-fixture 0.20.0");
        return;
    }
    if args == ["login", "status"] {
        println!("INERT FIXTURE: simulated probe success; no account or provider exists");
        return;
    }
    assert!(args
        .windows(2)
        .any(|a| a == ["--ask-for-approval", "on-request"]));
    assert!(!args
        .iter()
        .any(|arg| arg == "--full-auto" || arg.contains("bypass")));
    let cwd = std::env::current_dir().unwrap();
    let folder = cwd.file_name().unwrap().to_string_lossy();
    assert!([
        "fixture-workspace-1",
        "fixture-workspace-2",
        "fixture-workspace-3",
        "fixture-workspace-4"
    ]
    .contains(&folder.as_ref()));
    println!("THREADHELM INERT TERMINAL FIXTURE: no model, account, tools or network");
    println!("Ready. Only local echo and /quit are supported.");
    io::stdout().flush().unwrap();
    // Identical finite normal-output workload for each repeated-cycle launch.
    // No background task survives this burst; subsequent steady sampling is idle.
    for index in 1..=60 {
        println!("fixture progress {index:02}/60: bounded local output; no external work");
        io::stdout().flush().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    for line in io::stdin().lock().lines() {
        let line = line.unwrap();
        if line.trim() == "/quit" {
            return;
        }
        // No commands, arguments, files, configuration or tools are interpreted.
        println!(
            "fixture echo: {}",
            line.chars().take(256).collect::<String>()
        );
        io::stdout().flush().unwrap();
    }
}
