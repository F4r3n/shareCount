import "fake-indexeddb/auto";
import { expect, test, beforeEach, vi } from 'vitest';
import { groupMembersProxy } from './group_members';
import { db, STATUS } from '../db/db';
import { v4 as uuidv4 } from "uuid";
import { formatDate, getUTC } from '$lib/UTCDate';
import type { Group, GroupMember } from "$lib/types";
import { groupsProxy } from "./group";
import { afterEach } from "node:test";

vi.mock("./group_members", async (importOriginal) => {
  const originalModule = await importOriginal<typeof import("./group_members")>();
  return {
    ...originalModule,
    groupMembersProxy: Object.assign(
      Object.create(Object.getPrototypeOf(originalModule.groupMembersProxy)),
      originalModule.groupMembersProxy,
      {
        _add_remote_GroupMembers: vi.fn().mockResolvedValue("")
      }
    )
  };
});

beforeEach(async () => {
    await db.group_members.clear();
    vi.restoreAllMocks();
    const new_group = { created_at: getUTC(), currency_id: "EUR", modified_at: getUTC(), name: "TEST", token: uuidv4() } as Group
    await groupsProxy.add_new_local_group(new_group);
    vi.spyOn(groupsProxy as never, "_getGroup").mockResolvedValue(new_group);
    await groupsProxy.synchronize();
});

afterEach(()=>{
    vi.clearAllMocks();
})

test('Create group member', async () => {
    const nickname = "Alice";
    const member = groupMembersProxy.create_group_member(nickname);
    expect(member.nickname).eq(nickname);
    expect(member.uuid).toBeDefined();
    expect(member.modified_at).toBeDefined();
});

test('Add members locally and retrieve', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const member = groupMembersProxy.create_group_member("Bob");

    await groupMembersProxy.add_members(group_uuid, [member]);
    const members = await groupMembersProxy.get_local_members(group_uuid);
    expect(members.length).eq(1);
    expect(members[0].nickname).eq("Bob");
});

test('Get local member by uuid', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const member = groupMembersProxy.create_group_member("Charlie");
    await groupMembersProxy.add_members(group_uuid, [member]);
    const fetched = await groupMembersProxy.get_local_member(member.uuid);
    expect(fetched).not.toBeNull();
    expect(fetched?.nickname).eq("Charlie");
});

test('Delete local members from group', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const member1 = groupMembersProxy.create_group_member("Daisy");
    const member2 = groupMembersProxy.create_group_member("Eve");
    await groupMembersProxy.add_members(group_uuid, [member1, member2]);
    await groupMembersProxy.delete_local_members_from_group(group_uuid);
    const members = await groupMembersProxy.get_local_members(group_uuid);
    expect(members.length).eq(0);
});

test('Delete local members with status change', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const member = groupMembersProxy.create_group_member("Frank");
    await groupMembersProxy.add_members(group_uuid, [member]);
    await groupMembersProxy.delete_local_members([member]);
    const dbMember = await db.group_members.get(member.uuid);
    expect(dbMember?.status).eq(STATUS.TO_DELETE);
});

test('Rename members locally and remotely', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const member = groupMembersProxy.create_group_member("Gina");
    await groupMembersProxy.add_members(group_uuid, [member]);
    const renamed = { ...member, nickname: "Hannah" };
    // Mock remote call to succeed
    vi.spyOn(groupMembersProxy as never, '_add_remote_GroupMembers').mockResolvedValue([renamed]);
    await groupMembersProxy.rename_members(group_uuid, [renamed]);
    const fetched = await groupMembersProxy.get_local_member(renamed.uuid);
    expect(fetched?.nickname).eq("Hannah");
});

test('Add members - remote failure falls back to local', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const member = groupMembersProxy.create_group_member("Ivan");
    // Mock remote call to fail
    vi.spyOn(groupMembersProxy as never, '_add_remote_GroupMembers').mockRejectedValue(new Error("Network error"));
    await groupMembersProxy.add_members(group_uuid, [member]);
    const dbMember = await db.group_members.get(member.uuid);
    expect(dbMember?.status).eq(STATUS.TO_CREATE);
});

test('Delete members - remote always called, local status set', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const member = groupMembersProxy.create_group_member("Jack");
    await groupMembersProxy.add_members(group_uuid, [member]);
    // Mock remote call to succeed
    vi.spyOn(groupMembersProxy as never, '_delete_remote_GroupMembers').mockResolvedValue(undefined);
    await groupMembersProxy.delete_members(group_uuid, [member]);
    const dbMember = await db.group_members.get(member.uuid);
    expect(dbMember?.status).eq(STATUS.TO_DELETE);
});

test('Synchronize: adds remote-only members locally', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const remoteMember = { uuid: uuidv4(), nickname: "Kate", modified_at: getUTC() };
    // Mock remote fetch to return one member
    vi.spyOn(groupMembersProxy as never, '_get_remote_GroupMembers').mockResolvedValue([remoteMember]);
    // No local members initially
    await groupMembersProxy.synchronize(group_uuid);
    const members = await groupMembersProxy.get_local_members(group_uuid);
    expect(members.some(m => m.nickname === "Kate")).toBeTruthy();
});

test('Synchronize: removes local-only members not in remote', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const localMember = groupMembersProxy.create_group_member("Liam");
    await groupMembersProxy.add_members(group_uuid, [localMember]);
    // Mock remote fetch to return empty array
    vi.spyOn(groupMembersProxy as never, '_get_remote_GroupMembers').mockResolvedValue([]);
    await groupMembersProxy.synchronize(group_uuid);
    const members = await groupMembersProxy.get_local_members(group_uuid);
    expect(members.length).eq(0);
});

test('Synchronize: updates local member if remote is newer', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const oldDate = new Date(Date.now() - 10000);
    const newDate = new Date();
    const member = { uuid: uuidv4(), nickname: "Mona", modified_at: formatDate(oldDate) } as GroupMember;
    await groupMembersProxy.add_members(group_uuid, [member]);
    const remoteMember = { ...member, nickname: "Nina", modified_at: formatDate(newDate) };
    vi.spyOn(groupMembersProxy as never, '_get_remote_GroupMembers').mockResolvedValue([remoteMember]);
    await groupMembersProxy.synchronize(group_uuid);
    const updated = await groupMembersProxy.get_local_member(member.uuid);
    expect(updated?.nickname).eq("Nina");
});

test('Synchronize: sends local TO_CREATE members to remote', async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const member = groupMembersProxy.create_group_member("Oscar");
    // Add member with TO_CREATE status
    await db.group_members.add({
        group_uuid,
        nickname: member.nickname,
        uuid: member.uuid,
        modified_at: member.modified_at,
        status: STATUS.TO_CREATE
    });
    // Mock remote to return no members
    vi.spyOn(groupMembersProxy as never, '_get_remote_GroupMembers').mockResolvedValue([]);
    // Mock remote add to succeed
    vi.spyOn(groupMembersProxy as never, '_add_remote_GroupMembers').mockResolvedValue([member]);
    await groupMembersProxy.synchronize(group_uuid);
    const updated = await db.group_members.get(member.uuid);
    expect(updated?.status).eq(STATUS.NOTHING);
});
