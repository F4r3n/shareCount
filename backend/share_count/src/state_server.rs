use diesel::r2d2::{self, ConnectionManager};
use diesel::SqliteConnection;
type DbPool = r2d2::Pool<ConnectionManager<SqliteConnection>>;
use dotenvy::dotenv;
use std::env;
use std::sync::Arc;

pub fn establish_connection() -> anyhow::Result<Arc<DbPool>> {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL")?;

    let manager = ConnectionManager::<SqliteConnection>::new(&database_url);
    let pool = r2d2::Pool::builder().build(manager)?;

    // Wrap pool in Arc for Axum's State extractor
    Ok(Arc::new(pool))
}

#[derive(Debug, Clone)]
pub struct StateServer {
    pub pool: Arc<DbPool>,
}
