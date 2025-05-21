// src/lib/stores/group_members.ts
import { writable, type Writable } from 'svelte/store';
import { db, STATUS, type GroupMember_DB } from '../db/db';
import type { GroupMember } from '$lib/types';
import { getUTC } from '$lib/UTCDate';
import { v4 as uuidv4 } from 'uuid';
import { getBackendURL } from '$lib/shareCountAPI';

export const current_membersStore: Writable<GroupMember[]> = writable([]);


export class GroupMemberProxy {
    SetStoreGroupMembers(members: GroupMember[]) {
        current_membersStore.set(members)
    }

    private async _get_remote_GroupMembers(tokenID: string): Promise<GroupMember[]> {
        try {
            const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}/group_members`, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) {
                throw new Error(`Request failed ${res.status}`);
            }

            const data = await res.json();
            const members: GroupMember[] = data;
            return members;

        } catch (err) {
            console.error("Error:", err);
            throw err; // re-throw so the caller can handle the error
        }
    }

    private async _delete_remote_GroupMembers(tokenID: string, members: GroupMember[]) {
        if (members.length <= 0)
            return;
        try {
            const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}/group_members`, {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(members)
            });

            if (!res.ok) {
                throw new Error(`Request failed ${res.status}`);
            }


        } catch (err) {
            console.error("Error:", err);
            throw err; // re-throw so the caller can handle the error
        }
    }

    private async _add_remote_GroupMembers(tokenID: string, members: GroupMember[]): Promise<GroupMember[]> {
        if (members.length <= 0)
            return [];
        try {
            const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}/group_members`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(members)
            });

            if (!res.ok) {
                throw new Error(`Request failed ${res.status}`);
            }

            const data = await res.json();
            const new_members: GroupMember[] = data;
            return new_members;
        } catch (err) {
            console.error("Error:", err);
            throw err; // re-throw so the caller can handle the error
        }
    }

    async _delete_local_member(member: GroupMember) {
        db.group_members.where("uuid").equals(member.uuid).modify({ status: STATUS.TO_DELETE, modified_at: getUTC() });

    }

    async delete_local_members(group_members: GroupMember[]) {
        for (const member of group_members) {
            await this._delete_local_member(member);
        }
    }

    async rename_local_members(group_members: GroupMember[]) {
        for (const member of group_members) {
            db.group_members.where("uuid").equals(member.uuid).modify({ nickname: member.nickname, modified_at: getUTC() });
        }
    }

    async add_local_members(uuid: string, group_members: GroupMember[], status : STATUS) {
        for (const member of group_members) {
            await db.group_members.add(
                this._convert_member_memberDB(uuid, member, status));
        }
    }

    async get_local_members(uuid: string): Promise<GroupMember[]> {
        return await db.group_members.where("group_uuid").equals(uuid).and((member) => { return member.status !== STATUS.TO_DELETE }).toArray();
    }

    async get_local_member(uuid: string): Promise<GroupMember | null> {
        const member = await db.group_members.where("uuid").equals(uuid).and((member) => { return member.status !== STATUS.TO_DELETE }).first();
        if (member) {
            return member;
        }
        return null;
    }

    create_group_member(nickname: string): GroupMember {
        return { nickname: nickname, modified_at: getUTC(), uuid: uuidv4() }
    }

    _convert_member_memberDB(group_uuid: string, member: GroupMember, status: STATUS): GroupMember_DB {
        return {
            group_uuid: group_uuid,
            modified_at: member.modified_at,
            nickname: member.nickname,
            status: status,
            uuid: member.uuid

        } as GroupMember_DB
    }

    _convert_memberDB_member(member: GroupMember_DB): GroupMember {
        return {
            modified_at: member.modified_at,
            nickname: member.nickname,
            uuid: member.uuid

        } as GroupMember
    }

    private async _fetch_local_members(in_group_token: string): Promise<GroupMember_DB[]> {
        const list_local_members: GroupMember_DB[] = await db.group_members.where("group_uuid").equals(in_group_token).toArray();
        return list_local_members;
    }

    private async _modify_local_member(in_group_token: string, member: GroupMember) {
        await db.group_members.where("uuid").equals(member.uuid)
            .modify(await this._convert_member_memberDB(in_group_token, member, STATUS.NOTHING))
    }

    async synchro_group_members(in_group_token: string) {
        const original_members = await this._fetch_local_members(in_group_token);
        const to_send_members = [];
        const to_delete_members = [];

        const map: Map<string, GroupMember_DB> = new Map();
        for (const member of original_members) {
            map.set(member.uuid, member);
            if (member.status == STATUS.TO_CREATE) {
                to_send_members.push(this._convert_memberDB_member(member))
            }
            else if (member.status === STATUS.TO_DELETE) {
                to_delete_members.push(this._convert_memberDB_member(member))
            }
        }

        try {
            await this._add_remote_GroupMembers(in_group_token, to_send_members);
            await this._delete_remote_GroupMembers(in_group_token, to_delete_members);

        } catch (e) {
        }

        const members_to_save = []
        try {
            const remote_members = await this._get_remote_GroupMembers(in_group_token);
            for (const member of remote_members) {
                if (map.has(member.uuid)) {
                    this._modify_local_member(in_group_token, member);
                    map.delete(member.uuid);
                }
                else {
                    members_to_save.push(member);
                }
            }
        } catch (e) { }
        await this.add_local_members(in_group_token, members_to_save, STATUS.NOTHING);

        for (const [uuid, member] of map) {
            await this._delete_local_member(member);
        }


        this.SetStoreGroupMembers(await this.get_group_members(in_group_token));
    }

    async get_group_members(in_group_token: string): Promise<GroupMember[]> {
        const new_members = await (await this._fetch_local_members(in_group_token)).map((value) => { return this._convert_memberDB_member(value) })
        this.SetStoreGroupMembers(new_members);
        return new_members;
    }

    async _reset_status(in_group_token: string) {
        await db.group_members.where("group_uuid").equals(in_group_token)
            .and((member) => { return member.status === STATUS.TO_CREATE })
            .modify({ status: STATUS.NOTHING })
    }

    async _delete_marked_delete(in_group_token: string) {
        await db.group_members.where("group_uuid").equals(in_group_token)
            .and((member) => { return member.status === STATUS.TO_DELETE })
            .delete()
    }
}

export const groupMembersProxy = new GroupMemberProxy();

