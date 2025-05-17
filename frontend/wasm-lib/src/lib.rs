mod utils;

use std::collections::HashMap;

use bigdecimal::{BigDecimal, Zero};
use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[derive(Tsify, Serialize, Deserialize, Clone)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Amount {
    member: GroupMember,
    amount: BigDecimal,
}

#[derive(Tsify, Serialize, Deserialize, Clone)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct GroupMember {
    uuid: String,
    nickname: String,
}

#[wasm_bindgen]
pub fn compute_balance(transactions: Vec<Amount>) -> Result<Vec<Amount>, JsError> {
    let mut map: HashMap<String, Amount> = HashMap::new();
    for transaction in transactions {
        if let Some(value) = map.get_mut(&transaction.member.nickname) {
            (value.amount) += transaction.amount;
        } else {
            map.insert(
                transaction.member.nickname.clone(),
                Amount {
                    member: transaction.member,
                    amount: transaction.amount,
                },
            );
        }
    }

    let result = map.into_values().collect::<Vec<Amount>>();

    Ok(result)
}

#[derive(Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Settlement {
    member_from: GroupMember,
    member_to: GroupMember,
    amount: BigDecimal,
}

#[wasm_bindgen]
pub fn compute_settlements(transactions: Vec<Amount>) -> Result<Vec<Settlement>, JsError> {
    let mut transactions = transactions.clone();
    transactions.sort_by(|a, b| b.amount.cmp(&a.amount));
    let mut settlements: Vec<Settlement> = Vec::new();

    let mut i = 0;
    let mut j = transactions.len() - 1;
    while i < j {
        let (first, second) = transactions.split_at_mut(std::cmp::max(i, j));
        let (top, bottom) = (&mut first[i], &mut second[0]);
        let min_amount = top.amount.clone().min(&bottom.amount * -1);
        bottom.amount += &min_amount;
        top.amount -= &min_amount;
        settlements.push(Settlement {
            member_from: bottom.member.clone(),
            member_to: top.member.clone(),
            amount: min_amount,
        });

        if bottom.amount == BigDecimal::zero() {
            j -= 1;
        }
        if top.amount == BigDecimal::zero() {
            i += 1;
        }
    }
    Ok(settlements)
}
