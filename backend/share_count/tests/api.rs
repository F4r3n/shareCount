use axum_test::TestServer;
use share_count::router::create_router;
use share_count::state_server;
use std::env;
pub mod utils;
use diesel::Connection;
//use diesel_migrations::FileBasedMigrations;
use dotenvy::dotenv;

#[tokio::test]
async fn test_full_crud_flow() -> Result<(), anyhow::Error> {
    dotenvy::from_filename(".env.test").ok();
    let front_url = env::var("FRONT_URL")?;
    let connection = state_server::establish_connection()?;
    //let migrations = FileBasedMigrations::find_migrations_directory()?;

    //connection.get()?.run_migration(migrations)?;
    connection.get()?.begin_test_transaction()?;

    let state_server = state_server::StateServer { pool: connection };

    // Start transaction for test isolation

    let app = create_router(&front_url, state_server)?;

    let server = TestServer::new(app)?;
    let response = server.get("/users/1/groups").await;
    assert_eq!(response.status_code(), 200);
    let json = response.json::<Vec<share_count::entrypoints::GroupResponse>>();
    dbg!(&json);
    assert_eq!(json.len(), 2);

    Ok(())
}
