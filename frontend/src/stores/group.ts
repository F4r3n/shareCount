// src/lib/stores/group_members.ts
import { writable, type Writable } from 'svelte/store';
import { db, type Group_DB } from '../db/db';
import { getUTC } from '$lib/UTCDate';
import { v4 as uuidv4 } from 'uuid';
import type { Group } from "$lib/types";

export const groups: Writable<Group[]> = writable([]);


export class GroupStore {
    SetStoreGroup(in_groups: Group[]) {
        groups.set(in_groups)
    }

    async _get_local_groups(): Promise<Group[]> {
        const list_local_groups: Group_DB[] = await db.group.toArray();
        const groups: Group[] = list_local_groups.map((group) => {
            return {
                name: group.name,
                currency_id: group.currency_id,
                created_at: group.created_at,
                token: group.uuid,
                modified_at: group.modified_at,
            }
        });
        return groups;
    }

    async add_local_group(inGroup: Group) {
        await db.group.add({
            created_at: getUTC(),
            currency_id: inGroup.currency_id,
            name: inGroup.name,
            is_deleted: false,
            uuid: uuidv4(),
            modified_at: inGroup.modified_at
        } as Group_DB)
    }

    async modify_local_group(inGroup: Group) {
        db.group.where("uuid").equals(inGroup.token).modify(
            { currency_id: inGroup.currency_id, 
                name: inGroup.name, 
                modified_at: getUTC() 
            });
    }

    async delete_local_group(inGroup: Group) {
        db.group.where("uuid").equals(inGroup.token).modify({ is_deleted: true, modified_at: getUTC() });
    }

    async synchronize() {

    }

}

export const groupMemberStore = new GroupStore();

