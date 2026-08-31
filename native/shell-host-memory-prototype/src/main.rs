#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    io::{self, BufRead},
    path::PathBuf,
    sync::Mutex,
    time::Duration,
};
use tauri::Manager;

#[allow(dead_code)]
#[path = "borrowed/error.rs"]
mod error;
mod hosts;
#[allow(dead_code)]
#[path = "borrowed/job.rs"]
mod job;

struct Prototype {
    hosts: Mutex<Vec<hosts::Host>>,
    _database: Mutex<Option<rusqlite::Connection>>,
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("--host") {
        hosts::host_main();
        return;
    }
    let mode = args.get(2).cloned().unwrap_or_else(|| "blank".into());
    assert!(["blank", "workspace", "hosts"].contains(&mode.as_str()));
    let root = PathBuf::from(args.get(1).expect("disposable run directory required"));
    assert!(
        root.is_absolute()
            && root
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("run-")
    );
    std::fs::create_dir_all(&root).unwrap();
    assert!(
        !root.join("ready.json").exists(),
        "fresh run directory required"
    );
    let ready_path = root.join("ready.json");
    let database = if mode == "blank" {
        None
    } else {
        let connection =
            rusqlite::Connection::open(root.join("PROTOTYPE-disposable.sqlite")).unwrap();
        connection.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE prototype_state (id INTEGER PRIMARY KEY, note TEXT NOT NULL); INSERT INTO prototype_state VALUES (1, 'Not the ThreadHelm schema');").unwrap();
        Some(connection)
    };
    let host_list = if mode == "hosts" {
        (0..4).map(|_| hosts::Host::start()).collect()
    } else {
        Vec::new()
    };
    let app = tauri::Builder::default()
        .manage(Prototype { hosts: Mutex::new(host_list), _database: Mutex::new(database) })
        .setup(move |app| {
            let ready_path = ready_path.clone();
            let host_reports: Vec<_> = app.state::<Prototype>().hosts.lock().unwrap().iter().map(hosts::Host::report).collect();
            let page = if mode == "blank" { "index.html" } else { "workspace.html" };
            tauri::WebviewWindowBuilder::new(app, "prototype", tauri::WebviewUrl::App(page.into()))
                .title("ThreadHelm Memory Prototype - NONSHIPPING")
                .inner_size(1280.0, 800.0)
                .data_directory(root.join("webview-data"))
                .devtools(false)
                .on_navigation(|url| ["http://tauri.localhost/", "http://tauri.localhost/index.html", "http://tauri.localhost/workspace.html"].contains(&url.as_str()))
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .on_document_title_changed(move |window, title| {
                    if title != "TH-PROTOTYPE-RENDERED" { return; }
                    let report = serde_json::json!({"pid":std::process::id(),"rendered":true,"visible":window.is_visible().unwrap(),"minimized":window.is_minimized().unwrap(),"mode":mode,"hosts":host_reports,"tauri":"2.11.5"});
                    std::fs::write(&ready_path, serde_json::to_vec_pretty(&report).unwrap()).unwrap();
                    window.set_title("ThreadHelm Memory Prototype - NONSHIPPING").unwrap();
                })
                .build()?;
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                for line in io::stdin().lock().lines() {
                    if matches!(line.as_deref(), Ok("STOP") | Err(_)) { break; }
                }
                handle.exit(0);
            });
            let handle = app.handle().clone();
            std::thread::spawn(move || { std::thread::sleep(Duration::from_secs(240)); handle.exit(2); });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("prototype build failed");
    app.run(|app, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            for host in app.state::<Prototype>().hosts.lock().unwrap().iter_mut() {
                host.stop();
            }
        }
    });
}
