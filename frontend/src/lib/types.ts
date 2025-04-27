
export interface Debt {
    amount : number,
    nickname : string
}

export interface Transaction {
    description : string,
    currency : string,
    paid_by: String,
    created_at: number
    amount : number,
    debtors : Debt[]
}