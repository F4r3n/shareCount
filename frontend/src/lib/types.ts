
export interface Debt {
    id? : number,
    amount : string,
    member : GroupMember
}

export interface GroupMember {
    uuid : string,
    nickname : string
}

export interface Transaction {
    uuid: string,
    description : string,
    currency_id : string,
    paid_by: GroupMember,
    created_at: string,
    amount : string,
    exchange_rate: string,
    debtors : Debt[]
}

export interface Group {
    name: string;
    currency_id: string;
    created_at: Date;
    token: string;
}