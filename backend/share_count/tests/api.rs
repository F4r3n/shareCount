use axum_test::TestServer;
use chrono::{self, Datelike};
use serde_json::json;
use share_count::entrypoint::transactions::TransactionIDResponse;
use share_count::state_server;
use share_count::{entrypoint::groups::GroupResponse, router::create_router};
use std::env;
//use diesel_migrations::FileBasedMigrations;
use diesel_migrations::{embed_migrations, EmbeddedMigrations};
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();
use share_count::entrypoint::group_members::GroupMember;
use share_count::entrypoint::transactions::TransactionResponse;

async fn get_group_members(
    token: &str,
    server: &TestServer,
) -> Result<Vec<GroupMember>, anyhow::Error> {
    let response = server
        .get(format!("/groups/{}/group_members", token).as_str())
        .await;
    assert_eq!(response.status_code(), 200);
    Ok(response.json::<Vec<GroupMember>>())
}

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
        assert_ne!(group.currency_id, "");
        assert!(group.created_at.date().day() > 0);
    }

    //get groups per token
    let response = server.get("/groups/token_abc123").await;
    assert_eq!(response.status_code(), 200);
    let group = response.json::<GroupResponse>();
    assert_ne!(group.name, "");
    assert_ne!(group.currency_id, "");
    assert!(group.created_at.date().day() > 0);

    let response = server.get("/groups/token_unknown").await;
    assert_eq!(response.status_code(), 404);

    //create groups
    let response = server
        .post("/groups")
        .json(&serde_json::json!({
            "name": "Tokyo",
            "currency_id": "USD",
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
    assert_eq!(group.currency_id, "USD");
    assert!(group.created_at.date().day() > 0);

    //Get members
    let group = get_group_members(&token, &server).await?;
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

    let group = get_group_members(&token, &server).await?;
    assert_eq!(group.len(), 3);
    assert!(group
        .iter()
        .any(|name| name.nickname.eq(&String::from("JAJA"))));

    println!("Delete members...");
    //delete members
    let response = server
        .delete(format!("/groups/{}/group_members", token).as_str())
        .json(&json!([{"id": id_jojo, "nickname": "JAJA"}]))
        .await;
    assert_eq!(response.status_code(), 200);

    let group = get_group_members(&token, &server).await?;
    assert_eq!(group.len(), 2);

    //Transactions
    let first_member = group.first().unwrap();

    let response = server
    .post(format!("/groups/{}/transactions", token).as_str())
    .json(&json!({"id":-1,"amount":1111,"currency_id":"USD","created_at":"2025-05-08T19:17:41.819",
    "debtors":[{"member":{"id":first_member.id,"nickname":first_member.nickname},"amount":"1111"}],
    "description":"AAAA","exchange_rate":"1","paid_by":{"id":first_member.id,"nickname":first_member.nickname}}))
    .await;
    let new_transaction_id = response.json::<TransactionIDResponse>().id;
    assert!(new_transaction_id > 0);
    assert_eq!(response.status_code(), 200);

    let response = server
        .get(format!("/groups/{}/transactions/{}", token, new_transaction_id).as_str())
        .await;
    let transaction = response.json::<TransactionResponse>();
    assert_eq!(transaction.description, "AAAA");

    let response = server
    .post(format!("/groups/{}/transactions/{}", token, new_transaction_id).as_str())
    .json(&json!({"id":new_transaction_id,"amount":1111,"currency_id":"USD","created_at":"2025-05-08T19:17:41.819",
    "debtors":[{"member":{"id":first_member.id,"nickname":first_member.nickname},"amount":"1111"}],
    "description":"BBBB","exchange_rate":"1","paid_by":{"id":first_member.id,"nickname":first_member.nickname}}))
    .await;
    assert_eq!(response.status_code(), 200);

    let response = server
        .get(format!("/groups/{}/transactions/{}", token, new_transaction_id).as_str())
        .await;
    let transaction = response.json::<TransactionResponse>();
    assert_eq!(transaction.description, "BBBB");
    assert_eq!(response.status_code(), 200);

    let response = server
    .post(format!("/groups/{}/transactions", token).as_str())
    .json(&json!({"id":-1,"amount":1111,"currency_id":"USD","created_at":"2025-05-08T19:17:41.819",
    "debtors":[{"member":{"id":first_member.id,"nickname":first_member.nickname},"amount":111}],
    "description":"AAAA","exchange_rate":1,"paid_by":{"id":first_member.id,"nickname":first_member.nickname}}))
    .await;
    assert_eq!(response.status_code(), 500);

    let response = server
    .post(format!("/groups/{}/transactions", token).as_str())
    .json(&json!({"id":-1,"amount":0,"currency_id":"USD","created_at":"2025-05-08T19:17:41.819",
    "debtors":[{"member":{"id":first_member.id,"nickname":first_member.nickname},"amount":111}],
    "description":"AAAA","exchange_rate":1,"paid_by":{"id":first_member.id,"nickname":first_member.nickname}}))
    .await;
    assert_eq!(response.status_code(), 500);

    let response = server
    .post(format!("/groups/{}/transactions", token).as_str())
    .json(&json!({"id":-1,"amount":-10,"currency_id":"USD","created_at":"2025-05-08T19:17:41.819",
    "debtors":[{"member":{"id":first_member.id,"nickname":first_member.nickname},"amount":111}],
    "description":"AAAA","exchange_rate":1,"paid_by":{"id":first_member.id,"nickname":first_member.nickname}}))
    .await;
    assert_eq!(response.status_code(), 500);

    let response = server
        .delete(format!("/groups/{}/transactions/{}", token, new_transaction_id).as_str())
        .await;
    assert_eq!(response.status_code(), 200);

    Ok(())
}
