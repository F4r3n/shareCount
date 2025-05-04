use anyhow::anyhow;
use axum_test::TestServer;
use chrono::{self, Datelike};
use diesel::Connection;
use share_count::state_server;
use share_count::{entrypoints::GroupResponse, router::create_router};
use std::env;
//use diesel_migrations::FileBasedMigrations;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

#[tokio::test]
async fn test_full_crud_flow() -> Result<(), anyhow::Error> {
    dotenvy::from_filename(".env.test").ok();
    let front_url = env::var("FRONT_URL")?;
    let connection = state_server::establish_connection()?;
    //let migrations = FileBasedMigrations::find_migrations_directory()?;

    connection
        .get()?
        .run_pending_migrations(MIGRATIONS)
        .map_err(|e| anyhow!(e))?;
    connection.get()?.begin_test_transaction()?;

    let state_server = state_server::StateServer { pool: connection };

    // Start transaction for test isolation

    let app = create_router(&front_url, state_server)?;

    let server = TestServer::new(app)?;
    let response = server.get("/users/1/groups").await;
    assert_eq!(response.status_code(), 200);
    let json = response.json::<Vec<share_count::entrypoints::GroupResponse>>();

    assert_eq!(json.len(), 2);
    for group in json {
        assert_ne!(group.name, "");
        assert_ne!(group.currency, "");
        assert!(group.created_at.date().day() > 0);
    }

    let response = server.get("/groups/token_abc123").await;
    assert_eq!(response.status_code(), 200);
    let group = response.json::<GroupResponse>();
    assert_ne!(group.name, "");
    assert_ne!(group.currency, "");
    assert!(group.created_at.date().day() > 0);

    let response = server.get("/groups/token_unknown").await;
    assert_eq!(response.status_code(), 404);

    let response = server
        .post("/groups")
        .json(&serde_json::json!({
            "name": "Tokyo",
            "currency": "USD",
            "nicknames":["waluigi", "mario", "JOJO"]
        }))
        .await;
    let token = response.json::<String>();
    assert_eq!(response.status_code(), 200);

    let response = server.get(format!("/groups/{}", token).as_str()).await;
    assert_eq!(response.status_code(), 200);
    let group = response.json::<GroupResponse>();
    assert_eq!(group.name, "Tokyo");
    assert_eq!(group.currency, "USD");
    assert!(group.created_at.date().day() > 0);

    Ok(())
}
