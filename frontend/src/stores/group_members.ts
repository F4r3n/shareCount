// src/lib/stores/group_members.ts
import { writable, type Writable } from 'svelte/store';
import { db, type GroupMember_DB } from '../db/db';
import type { GroupMember } from '$lib/types';
import { addGroupMembers, deleteGroupMembers, getGroupMembers } from '$lib/shareCountAPI';
import { getUTC } from '$lib/UTCDate';
import { v4 as uuidv4 } from 'uuid';

async function fetch_local_members(in_group_token: string): Promise<GroupMember[]> {
    let list_local_members: GroupMember_DB[] = await db.group_members.toArray();
    let list_members: GroupMember[] = []
    for (let member_db of list_local_members) {
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

async function fetch_local_members_to_delete(in_group_token: string): Promise<GroupMember[]> {
    let list_local_members = await db.group_members.toArray();
    let list_members: GroupMember[] = []
    for (let member_db of list_local_members) {
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

async function update_local_members(group_uuid: string, new_members: GroupMember[]) {
    await db.group_members.where("group_uuid").equals(group_uuid).delete();
    for (let member of new_members) {
        try {

            // Add the new friend!
            const id = await db.group_members.add({
                uuid: member.uuid,
                is_deleted: false,
                is_me: false,
                modified_at: member.modified_at,
                group_uuid: group_uuid,
                nickname: member.nickname
            });

        } catch (error) {

        }
    }
}

export async function delete_local_members(group_members: GroupMember[]) {
    for (let member of group_members) {
        db.group_members.where("uuid").equals(member.uuid).modify({ is_deleted: true, modified_at: getUTC() });
    }
}

export async function rename_local_members(group_members: GroupMember[]) {
    for (let member of group_members) {
        db.group_members.where("uuid").equals(member.uuid).modify({ nickname: member.nickname, modified_at: getUTC() });
    }
}

export async function add_local_members(uuid: string, group_members: GroupMember[]) {
    for (let member of group_members) {
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

export async function get_local_members(uuid: string): Promise<GroupMember[]> {
    return await db.group_members.where("group_uuid").equals(uuid).and((member) => { return member.is_deleted == false }).toArray();
}


export function create_group_member(nickname: string): GroupMember {
    return { nickname: nickname, modified_at: getUTC(), uuid: uuidv4() }
}

export async function get_group_members(in_group_token: string): Promise<GroupMember[]> {
    let original_members = []
    try {
        original_members = await fetch_local_members(in_group_token);
        await deleteGroupMembers(in_group_token, await fetch_local_members_to_delete(in_group_token));
        if (original_members.length == 0) {
            original_members = await getGroupMembers(in_group_token)
        }
        else {
            original_members = await addGroupMembers(in_group_token, original_members);

        }
        await update_local_members(in_group_token, original_members);
    } catch (error) {
        original_members = await fetch_local_members(in_group_token);
    }
    console.log(original_members)
    return original_members;
}


export const group_members: Writable<GroupMember[]> = writable([]);

export function SetStoreGroupMembers(members: GroupMember[]) {
    group_members.set(members)
}

export async function synchro_group_members(token: string): Promise<GroupMember[]> {
    let members: GroupMember[] = [];
    try {
        members = await get_group_members(token);
    } catch (error) { }
    SetStoreGroupMembers(members);
    return members;
}

