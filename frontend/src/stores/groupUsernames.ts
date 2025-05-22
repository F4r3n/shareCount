// src/lib/stores/groupUsernames.ts
import { writable, type Writable } from 'svelte/store';
import { db, type User_DB } from '../db/db';

interface User {
    group_uuid: string;
    member_uuid: string;
}

export const users: Writable<Record<string, User>> = writable({});

const userStore_name = "current_user"
function getInitialUserStore(): User | null {
    const string = localStorage.getItem(userStore_name);
    if (string)
        return JSON.parse(string);
    return null;
}

export const current_user: Writable<User | null> = writable(getInitialUserStore());

current_user.subscribe((value) => {
    localStorage.setItem(userStore_name, JSON.stringify(value))
})



export class UserProxy {

    async set_user_group(group_uuid: string, member_uuid: string) {
        if (await this.get_user_group(group_uuid)) {
            await db.user_data.where("group_uuid").equals(group_uuid).modify({ member_uuid: member_uuid });
        }
        else {
            await db.user_data.add({ group_uuid: group_uuid, member_uuid: member_uuid });
        }
        await this.synchronize_store(group_uuid);
    }

    async synchronize_store(group_uuid: string) {
        
        const data = await this.get_user_group(group_uuid);
        if (data) {
            users.update((values: Record<string, User>) => {
                values[group_uuid] = { group_uuid: data.group_uuid, member_uuid: data.member_uuid };
                return values;
            });
            current_user.set(data)
        }
        else {
            current_user.set(null);
        }
    }

    async get_user_group(group_uuid: string): Promise<User | null> {
        const data = (await db.user_data.where("group_uuid").equals(group_uuid).toArray()).at(0);
        if (data) {
            return { group_uuid: data.group_uuid, member_uuid: data.member_uuid } as User
        }
        return null;
    }
}

export const userProxy = new UserProxy();