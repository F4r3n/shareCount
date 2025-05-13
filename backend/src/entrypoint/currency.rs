use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct CurrencyResponse {
    pub code: String,
    pub name: String,
    pub symbol: String,
    pub minor_units: i32,
}
