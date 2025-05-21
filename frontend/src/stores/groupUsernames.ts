// src/lib/stores/groupUsernames.ts
import { writable, type Writable } from 'svelte/store';
import type { User } from '$lib/types';
import { db } from '../db/db';

export const users: Writable<Record<string, User>> = writable({});
export const current_user : Writable<User | null> = writable(null)

export class UserProxy {

    async set_user_group(group_uuid: string, member_uuid: string) {
        if (await this.get_user_group(group_uuid)) {
            await db.user_data.where("group_uuid").equals(group_uuid).modify({ member_uuid: member_uuid });
        }
        else {
            db.user_data.add({ group_uuid: group_uuid, member_uuid: member_uuid });
        }
        await this.synchronize_store(group_uuid);
    }

    async synchronize_store(group_uuid: string) {
        const data = await this.get_user_group(group_uuid);
        if (data) {
            users.update((values: Record<string, User>) => {
                values[group_uuid] = { group_uuid: data.group_uuid, member_uuid: data.member_uuid };
                return values;
            })
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