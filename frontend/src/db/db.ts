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

if (import.meta.env.DEV) {
    //Dexie.delete("shareCount_DB");
}


let db = new Dexie('shareCount_DB') as Dexie & {
    group_members: EntityTable<
        GroupMember_DB,
        'uuid' // primary key "id" (for the typings only)
    >;
};

// Schema declaration:
db.version(1).stores({
    group_members: '++uuid, group_uuid, nickname, modified_at, is_me, is_deleted'
});

export type { GroupMember_DB };
export { db };
