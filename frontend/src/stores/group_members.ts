// src/lib/stores/group_members.ts
import { db, STATUS, type GroupMember_DB } from '../db/db';
import type { GroupMember } from '$lib/types';
import { getUTC } from '$lib/UTCDate';
import { v4 as uuidv4 } from 'uuid';
import { getFullBackendURL } from '$lib/shareCountAPI';


export class GroupMemberProxy {

    private async _get_remote_GroupMembers(tokenID: string): Promise<GroupMember[]> {
        const res = await fetch(`${getFullBackendURL()}/groups/${tokenID}/group_members`, {
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

    }

    private async _delete_remote_GroupMembers(tokenID: string, members: GroupMember[]) {
        if (members.length <= 0)
            return;
        const res = await fetch(`${getFullBackendURL()}/groups/${tokenID}/group_members`, {
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
    }

    private async _add_remote_GroupMembers(tokenID: string, members: GroupMember[]): Promise<GroupMember[]> {
        if (members.length <= 0)
            return [];
        const res = await fetch(`${getFullBackendURL()}/groups/${tokenID}/group_members`, {
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
    }

    private async _delete_local_member(member: GroupMember) {
        db.group_members.where("uuid").equals(member.uuid).modify({ status: STATUS.TO_DELETE, modified_at: getUTC() });

    }

    async delete_local_members_from_group(group_uuid : string) {
        db.group_members.where("group_uuid").equals(group_uuid).delete();
    }

    async delete_local_members(group_members: GroupMember[]) {
        for (const member of group_members) {
            await this._delete_local_member(member);
        }
    }

    async rename_local_members(group_members: GroupMember[]) {
        for (const member of group_members) {
            await db.group_members.where("uuid").equals(member.uuid).modify({ nickname: member.nickname, modified_at: getUTC() });
        }
    }

    async add_local_members(uuid: string, group_members: GroupMember[], status: STATUS) {
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

    private _convert_member_memberDB(group_uuid: string, member: GroupMember, status: STATUS): GroupMember_DB {
        return {
            group_uuid: group_uuid,
            modified_at: member.modified_at,
            nickname: member.nickname,
            status: status,
            uuid: member.uuid

        } as GroupMember_DB
    }

    private _convert_memberDB_member(member: GroupMember_DB): GroupMember {
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

    async synchronize(in_group_token: string) {
        const original_members = await this._fetch_local_members(in_group_token);
        const to_send_members = [];
        const to_delete_members = [];

        const map: Map<string, GroupMember_DB> = new Map();
        for (const member of original_members) {
            if (member.status != STATUS.TO_DELETE) {
                to_send_members.push(this._convert_memberDB_member(member));
            }
            else {
                to_delete_members.push(this._convert_memberDB_member(member));
            }
            map.set(member.uuid, member);
        }
        try {
            await this._add_remote_GroupMembers(in_group_token, to_send_members);
            await this._delete_remote_GroupMembers(in_group_token, to_delete_members);

            const remote_members = await this._get_remote_GroupMembers(in_group_token);
            this.delete_local_members_from_group(in_group_token);

            for (const member of remote_members) {
                this.add_local_members(in_group_token, [member], STATUS.NOTHING);
                //Used to get modified members
                if (map.has(member.uuid)) {
                    map.delete(member.uuid);
                }
            }
        } catch { /* empty */ }
    }

    async get_group_members(in_group_token: string): Promise<GroupMember[]> {
        const new_members = await (await this._fetch_local_members(in_group_token))
            .filter((member) => { return member.status != STATUS.TO_DELETE })
            .map((value) => { return this._convert_memberDB_member(value) })
        return new_members;
    }

}

export const groupMembersProxy = new GroupMemberProxy();

