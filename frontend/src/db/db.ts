// db.ts
import Dexie, { type EntityTable } from 'dexie';

interface GroupMember_DB {
    uuid: string;
    group_uuid: string;
    nickname: string;
    modified_at: string;
    is_me: boolean;
    is_deleted: boolean;
}

interface Group_DB {
    uuid: string;
    name: string;
    created_at: string;
    modified_at: string;
    currency_id: string;
    is_deleted: boolean;
}

interface Debt_DB {
    id: number;
    transaction_uuid: string;
    group_uuid: string;
    amount: string;
}


interface Transaction_DB {
    uuid: string;
    group_uuid: string;
    description: string;
    amount: string;
    created_at: string;
    modified_at: string;
    paid_by: string;
    exchange_rate: string;
    currency_id: string;
    is_deleted: boolean;
}


interface User_DB {
    id: number;
    group_uuid: string;
    member_uuid: string;
}


if (import.meta.env.DEV) {
    //Dexie.delete("shareCount_DB");
}


const db = new Dexie('shareCount_DB') as Dexie & {
    group: EntityTable<
        Group_DB,
        'uuid' // primary key "id" (for the typings only)
    >;
    group_members: EntityTable<
        GroupMember_DB,
        'uuid' // primary key "id" (for the typings only)
    >;
    transaction: EntityTable<
        Transaction_DB,
        'uuid' // primary key "id" (for the typings only)
    >;
    debt: EntityTable<
        Debt_DB,
        'id' // primary key "id" (for the typings only)
    >;
    user_data: EntityTable<
        User_DB,
        'id' // primary key "id" (for the typings only)
    >;
};

// Schema declaration:
db.version(1).stores({
    group_members: '++uuid, group_uuid, nickname, modified_at, is_me, is_deleted',
    group: '++uuid, name, created_at, modified_at, currency_id, is_deleted',
    transaction: '++uuid, group_uuid, description, amount, created_at, modified_at, paid_by, exchange_rate, currency_id, is_deleted',
    debt: '++id, transaction_uuid, group_uuid, amount',
    user_data: '++id, group_uuid, member_uuid'
});

export type { GroupMember_DB, Group_DB, Transaction_DB, Debt_DB, User_DB };
export { db };
