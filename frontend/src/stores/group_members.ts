// src/lib/stores/group_members.ts
import { db, STATUS, type GroupMember_DB } from '../db/db';
import type { GroupMember } from '$lib/types';
import { getUTC } from '$lib/UTCDate';
import { v4 as uuidv4 } from 'uuid';
import { getFullBackendURL } from '$lib/shareCountAPI';
import { withTimeout } from './SynchroHelper';


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

    private async _delete_local_member(member: GroupMember, inModify: boolean) {
        if (inModify) {
            await db.group_members.where("uuid").equals(member.uuid).modify({ status: STATUS.TO_DELETE, modified_at: getUTC() });
        }
        else {
            await db.group_members.where("uuid").equals(member.uuid).delete();
        }

    }

    async delete_local_members_from_group(group_uuid: string) {
        db.group_members.where("group_uuid").equals(group_uuid).delete();
    }

    async delete_local_members(group_members: GroupMember[]) {
        for (const member of group_members) {
            await this._delete_local_member(member, true);
        }
    }

    async get_status(uuid: string): Promise<STATUS> {
        const tr = await db.group_members.where("uuid").equals(uuid).first();
        if (tr) {
            return tr.status;
        }
        return STATUS.NOTHING;
    }

    async rename_members(group_members: GroupMember[]) {
        for (const member of group_members) {
            await this._rename_local_member(member);
        }
    }

    async add_members(uuid: string, group_members: GroupMember[]) {
        await this._add_local_members(uuid, group_members, STATUS.TO_CREATE);
    }

    async delete_members(uuid: string, group_members: GroupMember[]) {
        try {
            this._delete_remote_GroupMembers(uuid, group_members);
        } finally {
            for (const member of group_members) {
                this._delete_local_member(member, true);
            }
        }
    }

    private async _rename_local_member(member: GroupMember) {
        let status = await this.get_status(member.uuid);
        if (status == STATUS.NOTHING) {
            status = STATUS.TO_UPDATE;
        }
        await db.group_members.where("uuid").equals(member.uuid).modify({
            nickname: member.nickname,
            modified_at: getUTC(),
            status: status
        });

    }

    private async _rename_local_members(group_members: GroupMember[], status: STATUS) {
        for (const member of group_members) {
            await db.group_members.where("uuid").equals(member.uuid).modify({
                nickname: member.nickname,
                modified_at: getUTC(),
                status: status
            });
        }
    }

    private async _add_local_members(uuid: string, group_members: GroupMember[], status: STATUS) {
        for (const member of group_members) {
            await db.group_members.add(
                this._convert_member_memberDB(uuid, member, status));
        }
    }

    public async get_local_members(uuid: string): Promise<GroupMember[]> {
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

    async synchronize(group_uuid: string): Promise<GroupMember[]> {
        const original = await this._fetch_local_members(group_uuid);

        const to_send = [];
        const to_delete = [];
        const map: Map<string, GroupMember_DB> = new Map();
        for (const o of original) {
            map.set(o.uuid, o);
        }

        let remotes = [];

        try {
            remotes = await withTimeout(this._get_remote_GroupMembers(group_uuid), 7000);

            for (const remote of remotes) {
                const local = map.get(remote.uuid);
                if (local) {
                    if (local.status === STATUS.TO_UPDATE) {
                        //If local is newer we send it
                        if (new Date(remote.modified_at) < new Date(local.modified_at)) {
                            to_send.push(this._convert_memberDB_member(local));
                        }
                        else {
                            await this._rename_local_members([remote], STATUS.NOTHING);
                        }
                    }
                    else if (local.status === STATUS.NOTHING) {
                        await this._rename_local_members([remote], STATUS.NOTHING);
                    }
                    else if (local.status === STATUS.TO_DELETE) {
                        to_delete.push(this._convert_memberDB_member(local));
                    }
                    else if (local.status === STATUS.TO_CREATE) {
                        to_send.push(this._convert_memberDB_member(local));
                    }
                    map.delete(local.uuid);
                }// If transaction is not present we add it
                else {
                    await this._add_local_members(group_uuid, [remote], STATUS.NOTHING)
                }
            }

            //The ones not mentioned are deleted
            for (const [, m] of map) {
                if (m.status != STATUS.TO_CREATE)
                    await this._delete_local_member(m, false);
                else if (m.status == STATUS.TO_CREATE)
                    to_send.push(m);
            }

        } catch { /* empty */ }

        try {
            this._add_remote_GroupMembers(group_uuid, to_send);
            this._delete_remote_GroupMembers(group_uuid, to_delete);

            for (const member of to_send) {
                await db.group_members.where("uuid").equals(member.uuid).modify({ status: STATUS.NOTHING })
            }
        } catch { /* empty */ }
        const members = await this.get_group_members(group_uuid);
        return members;
    }

    async get_group_members(in_group_token: string): Promise<GroupMember[]> {
        const new_members = (await this._fetch_local_members(in_group_token))
            .filter((member) => { return member.status != STATUS.TO_DELETE })
            .map((value) => { return this._convert_memberDB_member(value) })
        return new_members;
    }

}

export const groupMembersProxy = new GroupMemberProxy();

