use axum_test::TestServer;
use chrono::{self, Datelike};
use serde_json::json;
use share_count::state_server;
use share_count::{entrypoint::groups::GroupResponse, router::create_router};
use std::env;
//use diesel_migrations::FileBasedMigrations;
use diesel_migrations::{embed_migrations, EmbeddedMigrations};
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();
use share_count::entrypoint::group_members::GroupMember;

#[tokio::test]
async fn test_full_crud_flow() -> Result<(), anyhow::Error> {
    dotenvy::from_filename(".env.test").ok();
    let front_url = env::var("FRONT_URL")?;
    let connection = state_server::establish_connection()?;

    let state_server = state_server::StateServer { pool: connection };

    // Start transaction for test isolation

    let app = create_router(&front_url, state_server)?;

    //get user1 groups
    let server = TestServer::new(app)?;
    let response = server.get("/users/1/groups").await;
    assert_eq!(response.status_code(), 200);
    let json = response.json::<Vec<GroupResponse>>();

    assert_eq!(json.len(), 2);
    for group in json {
        assert_ne!(group.name, "");
        assert_ne!(group.currency, "");
        assert!(group.created_at.date().day() > 0);
    }
    //get groups per token
    let response = server.get("/groups/token_abc123").await;
    assert_eq!(response.status_code(), 200);
    let group = response.json::<GroupResponse>();
    assert_ne!(group.name, "");
    assert_ne!(group.currency, "");
    assert!(group.created_at.date().day() > 0);

    let response = server.get("/groups/token_unknown").await;
    assert_eq!(response.status_code(), 404);

    //create groups
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

    //get groups
    let response = server.get(format!("/groups/{}", token).as_str()).await;
    assert_eq!(response.status_code(), 200);
    let group = response.json::<GroupResponse>();
    assert_eq!(group.name, "Tokyo");
    assert_eq!(group.currency, "USD");
    assert!(group.created_at.date().day() > 0);

    //Get members
    let response = server
        .get(format!("/groups/{}/group_members", token).as_str())
        .await;
    assert_eq!(response.status_code(), 200);
    let group = response.json::<Vec<GroupMember>>();
    assert_eq!(group.len(), 3);
    let id_jojo = group
        .iter()
        .find(|member| member.nickname.eq("JOJO"))
        .unwrap_or(&GroupMember {
            id: -1,
            nickname: String::from(""),
        })
        .id;

    //rename members
    let response = server
        .patch(format!("/groups/{}/group_members", token).as_str())
        .json(&json!([{"id": id_jojo, "new": "JAJA"}]))
        .await;
    assert_eq!(response.status_code(), 200);

    let response = server
        .get(format!("/groups/{}/group_members", token).as_str())
        .await;
    assert_eq!(response.status_code(), 200);
    let group = response.json::<Vec<GroupMember>>();
    assert_eq!(group.len(), 3);
    assert!(group
        .iter()
        .any(|name| name.nickname.eq(&String::from("JAJA"))));

    //delete members
    let response = server
        .delete(format!("/groups/{}/group_members", token).as_str())
        .json(&json!([{"id": id_jojo, "nickname": "JAJA"}]))
        .await;
    assert_eq!(response.status_code(), 200);

    let response = server
        .get(format!("/groups/{}/group_members", token).as_str())
        .await;
    assert_eq!(response.status_code(), 200);
    let group = response.json::<Vec<GroupMember>>();
    assert_eq!(group.len(), 2);

    Ok(())
}
