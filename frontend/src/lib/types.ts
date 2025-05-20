
export interface Debt {
    id? : number,
    amount : string,
    member : GroupMember
}

export interface GroupMember {
    uuid : string,
    nickname : string
    modified_at: string,
}

export interface Transaction {
    uuid: string,
    description : string,
    currency_id : string,
    paid_by: GroupMember,
    created_at: string,
    amount : string,
    exchange_rate: string,
    debtors : Debt[],
    modified_at: string,
}

export interface Group {
    token: string,
    name: string,
    modified_at: string,
    created_at: string,
    currency_id: string,
}