// src/lib/stores/group_members.ts
import { writable, type Writable } from 'svelte/store';
import { db, type GroupMember_DB } from '../db/db';
import type { GroupMember } from '$lib/types';
import { addGroupMembers, deleteGroupMembers, getGroupMembers } from '$lib/shareCountAPI';
import { getUTC } from '$lib/UTCDate';
import { v4 as uuidv4 } from 'uuid';

export const group_members: Writable<GroupMember[]> = writable([]);


export class GroupMemberStore {
    SetStoreGroupMembers(members: GroupMember[]) {
        group_members.set(members)
    }

    async synchro_group_members(token: string): Promise<GroupMember[]> {
        let members: GroupMember[] = [];
        try {
            members = await this.get_group_members(token);
        } catch (error) { console.error("Error fetching group members:", error); }
        this.SetStoreGroupMembers(members);
        return members;
    }

    async delete_local_members(group_members: GroupMember[]) {
        for (const member of group_members) {
            db.group_members.where("uuid").equals(member.uuid).modify({ is_deleted: true, modified_at: getUTC() });
        }
    }

    async rename_local_members(group_members: GroupMember[]) {
        for (const member of group_members) {
            db.group_members.where("uuid").equals(member.uuid).modify({ nickname: member.nickname, modified_at: getUTC() });
        }
    }

    async add_local_members(uuid: string, group_members: GroupMember[]) {
        for (const member of group_members) {
            await db.group_members.add({
                uuid: member.uuid,
                is_deleted: false,
                is_me: false,
                modified_at: member.modified_at,
                group_uuid: uuid,
                nickname: member.nickname
            });
        }
    }

    async get_local_members(uuid: string): Promise<GroupMember[]> {
        return await db.group_members.where("group_uuid").equals(uuid).and((member) => { return member.is_deleted == false }).toArray();
    }


    create_group_member(nickname: string): GroupMember {
        return { nickname: nickname, modified_at: getUTC(), uuid: uuidv4() }
    }

    async get_group_members(in_group_token: string): Promise<GroupMember[]> {
        let original_members = []
        try {
            original_members = await this._fetch_local_members(in_group_token);
            await deleteGroupMembers(in_group_token, await this._fetch_local_members_to_delete(in_group_token));
            if (original_members.length == 0) {
                original_members = await getGroupMembers(in_group_token)
            }
            else {
                original_members = await addGroupMembers(in_group_token, original_members);

            }
            await this._update_local_members(in_group_token, original_members);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_error) {
            original_members = await this._fetch_local_members(in_group_token);
        }
        return original_members;
    }

    async _fetch_local_members(in_group_token: string): Promise<GroupMember[]> {
        const list_local_members: GroupMember_DB[] = await db.group_members.toArray();
        const list_members: GroupMember[] = []
        for (const member_db of list_local_members) {
            if (in_group_token == member_db.group_uuid) {
                list_members.push({
                    uuid: member_db.uuid,
                    nickname: member_db.nickname,
                    modified_at: member_db.modified_at
                } as GroupMember)
            }
        }
        return list_members;
    }

    async _fetch_local_members_to_delete(in_group_token: string): Promise<GroupMember[]> {
        const list_local_members = await db.group_members.toArray();
        const list_members: GroupMember[] = []
        for (const member_db of list_local_members) {
            if (in_group_token == member_db.group_uuid && member_db.is_deleted) {
                list_members.push({
                    uuid: member_db.uuid,
                    nickname: member_db.nickname,
                    modified_at: member_db.modified_at
                } as GroupMember)
            }
        }
        return list_members;
    }

    async _update_local_members(group_uuid: string, new_members: GroupMember[]) {
        await db.group_members.where("group_uuid").equals(group_uuid).delete();
        for (const member of new_members) {
            try {

                await db.group_members.add({
                    uuid: member.uuid,
                    is_deleted: false,
                    is_me: false,
                    modified_at: member.modified_at,
                    group_uuid: group_uuid,
                    nickname: member.nickname
                });

            } catch (error) {
                console.error("Error adding member to local database:", error);
            }
        }
    }
}

export const groupMemberStore = new GroupMemberStore();

