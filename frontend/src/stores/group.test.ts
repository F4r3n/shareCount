import "fake-indexeddb/auto";
import { expect, test, beforeEach, vi } from 'vitest';
import { groupsProxy, groupsStore } from './group';
import type { Group } from '$lib/types';
import { getUTC } from '$lib/UTCDate';
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/db";

beforeEach(async () => {
    vi.restoreAllMocks();
    await db.groups.clear();
})

test('Create group', async () => {
    const new_Group = { created_at: getUTC(), modified_at: getUTC(), currency_id: "EUR", name: "TEST", token: uuidv4() } as Group;
    await groupsProxy.add_new_local_group(new_Group);
    const groups: Group[] = await groupsProxy.get_local_groups();
    expect(groups.length).eq(1);
    const group = groups[0];
    expect(JSON.stringify(group, Object.keys(group).sort())).eq(JSON.stringify(new_Group, Object.keys(new_Group).sort()));
});

test('Create groups', async () => {

    const list_new_groups = [];
    for (let i = 0; i < 100; i++) {
        list_new_groups.push({ created_at: getUTC(), modified_at: getUTC(), currency_id: "EUR", name: String(i), token: uuidv4() } as Group)
        await groupsProxy.add_new_local_group(list_new_groups[i]);
    }

    const groups: Group[] = (await groupsProxy.get_local_groups()).toSorted((a, b) => parseInt(a.name) - parseInt(b.name));
    expect(groups.length).eq(list_new_groups.length);
    for (let i = 0; i < groups.length; i++) {

        const group = groups[i];
        const new_group = list_new_groups[i];
        expect(JSON.stringify(group, Object.keys(group).sort())).eq(JSON.stringify(new_group, Object.keys(new_group).sort()));
    }
});

test('Add group from ID', async () => {
    const new_id = uuidv4();
    const new_Group = { created_at: getUTC(), modified_at: getUTC(), currency_id: "EUR", name: "TEST", token: new_id } as Group;
    vi.spyOn(groupsProxy as never, "_getGroup").mockResolvedValue(new_Group);
    await groupsProxy.add_group_from_id(new_id);
    const groups: Group[] = await groupsProxy.get_local_groups();
    const find = groups.find((value: Group) => { return value.token === new_id });
    expect(find?.name).toBe(new_Group.name);
});


test('Modify group', async () => {
    const new_Group = { created_at: getUTC(), modified_at: getUTC(), currency_id: "EUR", name: "TEST", token: uuidv4() } as Group;
    await groupsProxy.add_new_local_group(new_Group);

    // Modify the group
    const modified_Group = { ...new_Group, name: "MODIFIED", currency_id: "USD" };
    vi.spyOn(groupsProxy as never, "_add_remote_group").mockResolvedValue("");

    await groupsProxy.modify_group(modified_Group);

    const groups: Group[] = await groupsProxy.get_local_groups();
    expect(groups.length).eq(1);
    expect(groups[0].name).eq("MODIFIED");
    expect(groups[0].currency_id).eq("USD");
});

test('Delete group', async () => {
    const new_Group = { created_at: getUTC(), modified_at: getUTC(), currency_id: "EUR", name: "TO_DELETE", token: uuidv4() } as Group;
    await groupsProxy.add_new_local_group(new_Group);

    // Delete the group
    await groupsProxy.delete_local_group(new_Group.token);

    const groups: Group[] = await groupsProxy.get_local_groups();
    // Should be empty since group is deleted
    expect(groups.length).eq(0);
});

test('Store updates after add and delete', async () => {
    let storeGroups: Group[] = [];
    groupsProxy.SetStoreGroups(storeGroups);
    const unsubscribe = groupsStore.subscribe((value) => (storeGroups = value));

    const group = { created_at: getUTC(), modified_at: getUTC(), currency_id: "EUR", name: "STORE", token: uuidv4() } as Group;
    await groupsProxy.add_new_local_group(group);
    expect(storeGroups.length).eq(1);

    await groupsProxy.delete_local_group(group.token);
    expect(storeGroups.length).eq(0);
    groupsProxy.SetStoreGroups([]);
    unsubscribe();
});