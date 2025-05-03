use diesel::r2d2::{self, ConnectionManager};
type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;
use diesel::PgConnection;
use std::env;
use std::sync::Arc;

pub fn establish_connection() -> anyhow::Result<Arc<DbPool>> {
    let database_url = env::var("DATABASE_URL")?;

    let manager = ConnectionManager::<PgConnection>::new(&database_url);
    let pool = r2d2::Pool::builder().build(manager)?;

    // Wrap pool in Arc for Axum's State extractor
    Ok(Arc::new(pool))
}

#[derive(Debug, Clone)]
pub struct StateServer {
    pub pool: Arc<DbPool>,
}
