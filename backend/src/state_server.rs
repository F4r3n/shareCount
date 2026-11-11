use diesel::r2d2::{self, ConnectionManager};
type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;
use diesel::PgConnection;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use std::sync::Arc;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

/// Apply any pending migrations from `backend/migrations` (embedded at compile time).
pub fn run_migrations(pool: &DbPool) -> anyhow::Result<()> {
    let mut conn = pool.get()?;
    let applied = conn
        .run_pending_migrations(MIGRATIONS)
        .map_err(|e| anyhow::anyhow!("Failed to run migrations: {e}"))?;
    for migration in applied {
        println!("Applied migration {migration}");
    }
    Ok(())
}

pub fn establish_connection() -> anyhow::Result<Arc<DbPool>> {
    let database_url = format!(
        "postgres://{}:{}@{}:{}/{}",
        std::env::var("POSTGRES_USER")?,
        std::env::var("POSTGRES_PASSWORD")?,
        std::env::var("DATABASE_SERVER")?,
        std::env::var("POSTGRES_PORT")?,
        std::env::var("POSTGRES_DB")?
    )
    .to_string();
    println!("Database url {}", database_url);

    let manager = ConnectionManager::<PgConnection>::new(&database_url);
    let pool = r2d2::Pool::builder().build(manager)?;

    // Wrap pool in Arc for Axum's State extractor
    Ok(Arc::new(pool))
}

#[derive(Debug, Clone)]
pub struct StateServer {
    pub pool: Arc<DbPool>,
}
