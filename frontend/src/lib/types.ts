
export interface Debt {
    id : number,
    amount : number,
    nickname : string
}

export interface Transaction {
    id: number,
    description : string,
    currency : string,
    paid_by: String,
    created_at: number
    amount : number,
    debtors : Debt[]
}

export interface Group {
    name: string;
    currency: string;
    created_at: Date;
    token: string;
}