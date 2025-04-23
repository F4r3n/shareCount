use diesel::prelude::*;
use dotenvy::dotenv;
use schema::group_members;
use schema::groups;
use schema::transaction_debts;
use schema::transactions;
use schema::users;
use std::env;
use std::sync::Arc;
pub mod models;
pub mod schema;
use self::models::*;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderValue, Method},
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use diesel::r2d2::{self, ConnectionManager};
use serde::Deserialize;
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
type DbPool = r2d2::Pool<ConnectionManager<SqliteConnection>>;

pub fn establish_connection() -> Arc<DbPool> {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let manager = ConnectionManager::<SqliteConnection>::new(&database_url);
    let pool = r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create pool.");

    // Wrap pool in Arc for Axum's State extractor
    Arc::new(pool)
}

pub fn test_users(connection: &mut SqliteConnection) {
    let results = users::table
        .filter(users::name.eq("Bob"))
        .limit(5)
        .select(User::as_select())
        .load(connection)
        .expect("Error loading posts");

    println!("Displaying {} posts", results.len());
    for post in results {
        println!("{}", post.name);
        println!("-----------\n");
        println!("{}", post.email);
    }
}

pub fn test_transactions(connection: &mut SqliteConnection) {
    let results = transaction_debts::table
        .inner_join(transactions::table.on(transactions::id.eq(transaction_debts::transaction_id)))
        .inner_join(users::table.on(users::id.eq(transaction_debts::user_id)))
        .filter(users::name.eq("Bob"))
        .limit(5)
        .select((
            TransactionDebt::as_select(),
            User::as_select(),
            Transaction::as_select(),
        ))
        .load::<(TransactionDebt, User, Transaction)>(connection)
        .expect("Error loading posts");

    println!("Displaying {} posts", results.len());
    for post in results {
        println!("{}", post.0.amount);
        println!("-----------\n");
    }
}

#[derive(Deserialize)]
struct GroupQuery {
    group_id: i32,
}

#[tokio::main]
async fn main() {
    let connection = establish_connection();
    // see https://docs.rs/tower-http/latest/tower_http/cors/index.html
    // for more details
    //
    // pay attention that for some request types like posting content-type: application/json
    // it is required to add ".allow_headers([http::header::CONTENT_TYPE])"
    // or see this issue https://github.com/tokio-rs/axum/issues/849
    let cors_layer = CorsLayer::new()
        .allow_origin("http://localhost:3000".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET]);
    let backend = async {
        let app = Router::new()
            .route("/groups/{id}", get(handler_groups))
            .with_state(connection)
            .layer(cors_layer);
        serve(app, 4000).await;
    };

    tokio::join!(backend);
}

async fn serve(app: Router, port: u16) {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn handler_groups(State(pool): State<Arc<DbPool>>, Path(id): Path<i32>) -> Json<Vec<Group>> {
    let mut conn = pool.get().expect("couldn't get db connection from pool");

    let results = groups::table
        .inner_join(group_members::table.on(groups::id.eq(group_members::group_id)))
        .filter(group_members::user_id.eq(id))
        .limit(5)
        .select(Group::as_select())
        .load::<Group>(&mut conn)
        .expect("Error loading groups");

    Json(results)
}
