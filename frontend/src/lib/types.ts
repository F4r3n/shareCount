
export interface Debt {
    id : number,
    amount : string,
    member : GroupMember
}

export interface GroupMember {
    id : number,
    nickname : string
}

export interface Transaction {
    id: number,
    description : string,
    currency : string,
    paid_by: GroupMember,
    created_at: number
    amount : string,
    debtors : Debt[]
}

export interface Group {
    name: string;
    currency: string;
    created_at: Date;
    token: string;
}