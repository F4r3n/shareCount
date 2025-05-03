// tests/test_utils.rs
use diesel::{Connection, PgConnection, RunQueryDsl};
use diesel_migrations::{FileBasedMigrations, MigrationHarness};

pub fn setup_test_db() -> PgConnection {
    let mut conn = PgConnection::establish(&std::env::var("DATABASE_URL").unwrap())
        .expect("Failed to connect to test database");

    // Run migrations
    let migrations = FileBasedMigrations::find_migrations_directory().unwrap();
    conn.run_pending_migrations(migrations).unwrap();

    // Start transaction for test isolation
    conn.begin_test_transaction().unwrap();
    conn
}
