// src/lib/stores/group_members.ts
import { writable, type Writable } from 'svelte/store';
import { db, STATUS, type Group_DB } from '../db/db';
import { getUTC } from '$lib/UTCDate';
import { v4 as uuidv4 } from 'uuid';
import type { Group } from "$lib/types";
import { getBackendURL } from '$lib/shareCountAPI';
import { browser } from '$app/environment';

export const groupsStore: Writable<Group[]> = writable([]);

const groupStore_name = "current_groupStore"
function getInitialGroupStore(): Group | null {
    if (!browser) {
        return null;
    }
    const string = localStorage.getItem(groupStore_name);
    if (string)
        return JSON.parse(string);
    return null;
}
export const current_groupStore: Writable<Group | null> = writable(getInitialGroupStore());

if (browser) {
    current_groupStore.subscribe((value) => {
        localStorage.setItem(groupStore_name, JSON.stringify(current_groupStore))
    })
}



export class GroupsProxy {
    SetStoreGroups(in_groups: Group[]) {
        groupsStore.set(in_groups)
    }

    async get_local_groups(): Promise<Group[]> {
        const list_local_groups: Group_DB[] = await db.groups.toArray();
        const groups: Group[] = list_local_groups.map((group) => {
            return this._convert_DB_to_Group(group)
        });
        return groups;
    }

    private async add_local_group(inGroup: Group, status: STATUS) {
        await db.groups.add({
            created_at: inGroup.created_at,
            currency_id: inGroup.currency_id,
            name: inGroup.name,
            status: status,
            uuid: inGroup.token,
            modified_at: inGroup.modified_at
        } as Group_DB)

        groupsStore.update((values: Group[]) => {
            values.push(inGroup);
            return values;
        })
    }

    async create_local_group() {
        const new_group = {
            created_at: getUTC(),
            currency_id: "USD",
            name: "NEW",
            status: STATUS.TO_CREATE,
            uuid: uuidv4(),
            modified_at: getUTC()
        } as Group_DB
        await db.groups.add(new_group)

        groupsStore.update((values: Group[]) => {
            values.push(this._convert_DB_to_Group(new_group));
            return values;
        })
    }

    async modify_local_group(inGroup: Group) {
        db.groups.where("uuid").equals(inGroup.token).modify(
            {
                currency_id: inGroup.currency_id,
                name: inGroup.name,
                modified_at: getUTC()
            });
        groupsStore.update((values: Group[]) => {
            const index = values.findIndex((gr) => { return gr.token == inGroup.token; })
            if (index >= 0) {
                values[index] = inGroup;
            }
            return values;
        })
    }

    private async _getGroup(tokenID: string): Promise<Group> {
        try {
            const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}`, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) {
                throw new Error("Request failed");
            }

            const data = await res.json() as Group;
            return data;
        } catch (err) {
            console.error("Error:", err);
            throw err; // re-throw so the caller can handle the error
        }
    }

    private async _addGroup(group: Group) {
        try {
            const res = await fetch(`http://${getBackendURL()}/groups`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(group)
            });

            if (!res.ok) {
                throw new Error("Request failed");
            }
        } catch (err) {
            throw err; // re-throw so the caller can handle the error
        }
    }

    private async _deleteGroup(group: Group) {
        try {
            const res = await fetch(`http://${getBackendURL()}/groups`, {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(group)
            });

            if (!res.ok) {
                throw new Error("Request failed");
            }
        } catch (err) {
            console.error("Error:", err);
            throw err; // re-throw so the caller can handle the error
        }

        groupsStore.update((values: Group[]) => {
            const index = values.findIndex((gr: Group) => { return gr.token == group.token; });
            if (index > 0) {
                values.splice(index, 1);
            }
            return values;
        })
    }

    private _convert_DB_to_Group(group: Group_DB): Group {
        return {
            created_at: group.created_at,
            currency_id: group.currency_id,
            modified_at: group.modified_at,
            name: group.name,
            token: group.uuid
        } as Group
    }

    private _convert_Group_to_DB(group: Group): Group_DB {
        return {
            created_at: group.created_at,
            currency_id: group.currency_id,
            modified_at: group.modified_at,
            name: group.name,
            uuid: group.token
        } as Group_DB
    }

    async delete_local_group(uuid: string) {
        db.groups.where("uuid").equals(uuid).modify({ status: STATUS.TO_DELETE, modified_at: getUTC() });
    }

    async add_group_from_id(uuid: string) {
        if (uuid != "") {
            const new_group = await this._getGroup(uuid);
            this.add_local_group(new_group, STATUS.NOTHING)
            groupsStore.update((values: Group[]) => {
                values.push(new_group);
                return values;
            })
        }
    }

    async synchronize() {

        try {
            for (const group of await db.groups.toArray()) {
                if (group.status === STATUS.TO_DELETE) {
                    await this._deleteGroup({ modified_at: group.modified_at, token: group.uuid } as Group);
                    db.groups.delete(group.uuid);
                }
                else {
                    await this._addGroup(this._convert_DB_to_Group(group));
                }
            }
        } catch (e) {
        }


        for (const group of await db.groups.toArray()) {
            try {
                const new_group = await this._getGroup(group.uuid);
                db.groups.where("uuid").equals(new_group.token).modify(this._convert_Group_to_DB(new_group));
            } catch (e) {

            }
        }

        this.SetStoreGroups(await this.get_local_groups());
    }

}

export const groupsProxy = new GroupsProxy();


