use axum_test::TestServer;
use chrono::{self, Datelike};
use serde_json::json;
use share_count::state_server;
use share_count::{entrypoint::groups::GroupResponse, router::create_router};
use std::env;
//use diesel_migrations::FileBasedMigrations;
use diesel_migrations::{embed_migrations, EmbeddedMigrations};
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();
use share_count::entrypoint::group_members::{GroupMember, GroupMemberNoDate};
use share_count::entrypoint::groups::CreateGroups;
use share_count::entrypoint::transactions::{TransactionQuery, TransactionResponse};
use std::sync::Arc;
use uuid::Uuid;

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

static SERVER: tokio::sync::OnceCell<Arc<TestServer>> = tokio::sync::OnceCell::const_new();
pub async fn create_server() -> Arc<TestServer> {
    SERVER
        .get_or_init(|| async {
            dotenvy::from_filename(".env.test").ok();
            let front_url = match env::var("FRONT_URL") {
                Ok(val) => val,
                Err(e) => panic!("Failed to get FRONT_URL: {}", e),
            };
            let connection = state_server::establish_connection().expect("fail connection");

            let state_server = state_server::StateServer { pool: connection };

            // Start transaction for test isolation

            let app = match create_router(&front_url, state_server) {
                Ok(app) => app,
                Err(e) => panic!("Failed to create router: {}", e),
            };

            Arc::new(TestServer::new(app).expect("Failed to create TestServer"))
        })
        .await
        .clone()
}

#[tokio::test]
async fn manage_group() -> Result<(), anyhow::Error> {
    let server = create_server().await;
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
    println!("get groups");

    let response = server.get("/groups/token_abc123").await;
    assert_eq!(response.status_code(), 200);
    let group = response.json::<GroupResponse>();
    assert_ne!(group.name, "");
    assert_ne!(group.currency_id, "");
    assert!(group.created_at.date().day() > 0);

    let response = server.get("/groups/token_unknown").await;
    assert_eq!(response.status_code(), 404);

    //create groups
    println!("create groups");

    let response = server
        .post("/groups")
        .json(&serde_json::json!({
            "name": "Tokyo",
            "currency_id": "USD",
            "nicknames":["waluigi", "mario", "JOJO"]
        }))
        .await;
    assert_eq!(response.status_code(), 200);
    let token = response.json::<String>();

    //get groups
    println!("get groups");

    let response = server.get(format!("/groups/{}", token).as_str()).await;
    assert_eq!(response.status_code(), 200);
    let group = response.json::<GroupResponse>();
    assert_eq!(group.name, "Tokyo");
    assert_eq!(group.currency_id, "USD");
    assert!(group.created_at.date().day() > 0);

    Ok(())
}

#[tokio::test]
async fn manage_member() -> Result<(), anyhow::Error> {
    let server = create_server().await;
    let create_group = CreateGroups::new(
        "Tokyo".to_string(),
        "USD".to_string(),
        ["waluigi", "mario", "JOJO"]
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<String>>(),
    );

    let response = server
        .post("/groups")
        .json(&serde_json::to_value(create_group)?)
        .await;
    assert_eq!(response.status_code(), 200);
    let token = response.json::<String>();

    let group = get_group_members(&token, &server).await?;
    assert_eq!(group.len(), 3);
    let binding = GroupMember {
        uuid: String::from(""),
        nickname: String::from(""),
        modified_at: chrono::Utc::now().naive_utc(),
    };
    let uuid_jojo = &group
        .iter()
        .find(|member| member.nickname.eq("JOJO"))
        .unwrap_or(&binding)
        .uuid;

    //rename members
    println!("rename members");

    let response = server
        .post(format!("/groups/{}/group_members", token).as_str())
        .json(&serde_json::to_value(vec![GroupMember {
            modified_at: chrono::Utc::now().naive_utc(),
            nickname: "JAJA".to_string(),
            uuid: uuid_jojo.clone(),
        }])?)
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
        .json(&json!([{"uuid": uuid_jojo, "nickname": "JAJA", "modified_at": chrono::Utc::now().naive_utc()}]))
        .await;
    assert_eq!(response.status_code(), 200);

    let group = get_group_members(&token, &server).await?;
    assert_eq!(group.len(), 2);

    Ok(())
}

fn create_transaction(
    members: &[GroupMember],
    desc: &str,
    main_amount: &str,
    debtors_amount: &str,
) -> TransactionQuery {
    let members = &members
        .iter()
        .map(GroupMemberNoDate::from)
        .collect::<Vec<GroupMemberNoDate>>();
    let mut new_transaction = TransactionQuery::new(
        &Uuid::new_v4(),
        desc,
        &members.first().unwrap().clone(),
        main_amount,
    );
    for member in members {
        new_transaction.add_debtor(&member.clone(), debtors_amount);
    }
    new_transaction
}

async fn get_transaction(
    token: &str,
    uuid: &str,
    server: &TestServer,
) -> Result<TransactionResponse, anyhow::Error> {
    let response = server
        .get(format!("/groups/{}/transactions/{}", token, uuid).as_str())
        .await;
    assert_eq!(response.status_code(), 200);
    let transaction = response.json::<TransactionResponse>();
    Ok(transaction)
}
#[tokio::test]
async fn manage_transactions() -> Result<(), anyhow::Error> {
    let server = create_server().await;
    let response = server
        .post("/groups")
        .json(&serde_json::json!({
            "name": "Tokyo",
            "currency_id": "USD",
            "nicknames":["waluigi", "mario", "JOJO"]
        }))
        .await;
    assert_eq!(response.status_code(), 200);
    let token = response.json::<String>();
    let group = get_group_members(&token, &server).await?;
    assert_eq!(group.len(), 3);

    //Transactions
    println!("Create transaction...");
    let mut new_transaction = create_transaction(&group, "AAAA", "3", "1");

    let new_uuid = new_transaction.get_uuid();
    let response = server
        .post(format!("/groups/{}/transactions", token).as_str())
        .json(&serde_json::to_value(&new_transaction)?)
        .await;
    assert_eq!(response.status_code(), 200);

    let transaction = get_transaction(&token, &new_uuid, &server).await?;
    assert_eq!(transaction.description, "AAAA");

    println!("Modify transaction...");

    new_transaction.set_description("BBBB");

    let response = server
        .post(format!("/groups/{}/transactions", token).as_str())
        .json(&serde_json::to_value(&new_transaction)?)
        .await;
    assert_eq!(response.status_code(), 200);

    let transaction = get_transaction(&token, &new_uuid, &server).await?;
    assert_eq!(transaction.description, "BBBB");

    println!("Modify transaction...");
    let new_transaction = create_transaction(&group, "AAAA", "4", "1");

    let response = server
        .post(format!("/groups/{}/transactions", token).as_str())
        .json(&serde_json::to_value(&new_transaction)?)
        .await;
    assert_eq!(response.status_code(), 500);

    println!("Create new transaction...");

    let mut new_transaction = create_transaction(&group, "AAAA", "0", "1");

    let response = server
        .post(format!("/groups/{}/transactions", token).as_str())
        .json(&serde_json::to_value(&new_transaction)?)
        .await;
    assert_eq!(response.status_code(), 500);
    new_transaction.set_amount("3");
    let response = server
        .post(format!("/groups/{}/transactions", token).as_str())
        .json(&serde_json::to_value(&new_transaction)?)
        .await;
    assert_eq!(response.status_code(), 200);

    new_transaction.set_description("OLD");
    let datetime = chrono::Utc::now().naive_utc();
    let new_datetime = datetime.checked_sub_signed(chrono::Duration::hours(1));
    new_transaction.set_time(&new_datetime.unwrap_or_default());
    let response = server
        .post(format!("/groups/{}/transactions", token).as_str())
        .json(&serde_json::to_value(&new_transaction)?)
        .await;
    assert_eq!(response.status_code(), 404);

    let transaction = get_transaction(&token, &new_transaction.get_uuid(), &server).await?;
    assert_eq!(transaction.description.as_str(), "AAAA");

    new_transaction.set_description("NEW");
    let datetime = chrono::Utc::now().naive_utc();
    let new_datetime = datetime.checked_add_days(chrono::Days::new(1));
    new_transaction.set_time(&new_datetime.unwrap_or_default());
    let response = server
        .post(format!("/groups/{}/transactions", token).as_str())
        .json(&serde_json::to_value(&new_transaction)?)
        .await;
    assert_eq!(response.status_code(), 200);

    let transaction = get_transaction(&token, &new_transaction.get_uuid(), &server).await?;
    assert_eq!(transaction.description.as_str(), "NEW");

    let response = server
        .delete(format!("/groups/{}/transactions/{}", token, new_uuid).as_str())
        .await;
    assert_eq!(response.status_code(), 200);

    Ok(())
}
