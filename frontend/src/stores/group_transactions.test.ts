import "fake-indexeddb/auto";
import { beforeEach, test, expect, vi } from "vitest";
import { transactionsProxy } from "./group_transactions";
import { db, STATUS } from "../db/db";
import { v4 as uuidv4 } from "uuid";
import { getUTC } from "$lib/UTCDate";
import { group_transactions } from "./group_transactions";
import { groupsProxy } from "./group";
import type { Group, GroupMember, Transaction } from "$lib/types";
import { groupMembersProxy } from "./group_members";
import { afterEach } from "node:test";

vi.mock("./group_transactions", async (importOriginal) => {
    const originalModule = await importOriginal<typeof import("./group_transactions")>();
    return {
        ...originalModule,
        transactionsProxy: Object.assign(
            Object.create(Object.getPrototypeOf(originalModule.transactionsProxy)),
            originalModule.transactionsProxy,
            {
                _update_remote_transaction: vi.fn().mockResolvedValue(""),
                _delete_remote_transaction: vi.fn().mockResolvedValue("")
            }
        )
    };
});

beforeEach(async () => {
    await db.transactions.clear();
    await db.debts.clear();
    group_transactions.set({});
    vi.restoreAllMocks();
    const token = uuidv4();
    const new_group = { created_at: getUTC(), currency_id: "EUR", modified_at: getUTC(), name: "TEST", token: token } as Group
    await groupsProxy.add_new_local_group(new_group);
    vi.spyOn(groupsProxy as never, "_add_remote_group").mockResolvedValue("");
    vi.spyOn(groupsProxy as never, "_getGroup").mockResolvedValue(new_group);

    await groupsProxy.synchronize();
    const new_members = [
        { nickname: "Payer", modified_at: getUTC(), uuid: uuidv4() },
        { nickname: "Debtor", modified_at: getUTC(), uuid: uuidv4() }
    ]

    vi.spyOn(groupMembersProxy as never, "_add_remote_GroupMembers").mockResolvedValue("");

    await groupMembersProxy.add_members(token, new_members)
});

afterEach(() => {
    vi.resetAllMocks();
})

function makeTransaction(paid_by: GroupMember, debtor: GroupMember, overrides = {}): Transaction {
    return {
        uuid: uuidv4(),
        amount: "100",
        created_at: getUTC(),
        currency_id: "EUR",
        description: "Test Transaction",
        exchange_rate: "1",
        modified_at: getUTC(),
        paid_by: paid_by,
        debtors: [
            { amount: "100", member: debtor }
        ],
        ...overrides
    };
}

test("add_transaction adds transaction locally and updates store", async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const members = await groupMembersProxy.get_group_members(group_uuid);
    const transaction = makeTransaction(members[0], members[1]);

    // Mock remote update to succeed
    await transactionsProxy.add_transaction(group_uuid, transaction);

    // Check in IndexedDB
    const dbTr = await db.transactions.get(transaction.uuid);
    expect(dbTr).toBeDefined();
    expect(dbTr?.amount).toBe("100");

    // Check in Svelte store
    let storeValue: Record<string, Transaction[]> = {};
    group_transactions.subscribe((v) => (storeValue = v))();
    if (storeValue) {
        expect(storeValue[group_uuid].length).toBe(1);
        expect(storeValue[group_uuid][0].uuid).toBe(transaction.uuid);
    }

});

test("add_transaction handles remote failure and sets status", async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const members = await groupMembersProxy.get_group_members(group_uuid);
    const transaction = makeTransaction(members[0], members[1]);

    vi.spyOn(transactionsProxy as never, "_update_remote_transaction").mockRejectedValue(new Error("fail"));

    await transactionsProxy.add_transaction(group_uuid, transaction);

    const dbTr = await db.transactions.get(transaction.uuid);
    expect(dbTr?.status).toBe(STATUS.TO_CREATE);
});

test("modify_transaction updates local and store", async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const members = await groupMembersProxy.get_group_members(group_uuid);
    const transaction = makeTransaction(members[0], members[1]);

    // Add transaction first
    await transactionsProxy.add_transaction(group_uuid, transaction);

    // Modify and update
    const updated = { ...transaction, description: "Updated" };
    vi.spyOn(transactionsProxy, "get_status_transation").mockResolvedValue(STATUS.NOTHING);
    await transactionsProxy.modify_transaction(group_uuid, updated);

    const dbTr = await db.transactions.get(transaction.uuid);
    expect(dbTr?.description).toBe("Updated");

    let storeValue: Record<string, Transaction[]> = {};
    group_transactions.subscribe((v) => (storeValue = v))();
    expect(storeValue[group_uuid][0].description).toBe("Updated");
});

test("delete_transaction removes transaction from store and marks as TO_DELETE", async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const members = await groupMembersProxy.get_group_members(group_uuid);
    const transaction = makeTransaction(members[0], members[1]);

    // Add transaction first
    await transactionsProxy.add_transaction(group_uuid, transaction);

    await transactionsProxy.delete_transaction(group_uuid, transaction);

    const dbTr = await db.transactions.get(transaction.uuid);
    expect(dbTr?.status).toBe(STATUS.TO_DELETE);

    let storeValue: Record<string, Transaction[]> = {};
    group_transactions.subscribe((v) => (storeValue = v))();
    expect(storeValue[group_uuid].length).toBe(0);
});

test("has_spent returns true if user has paid or owes", async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const members = await groupMembersProxy.get_group_members(group_uuid);
    const transaction = makeTransaction(members[0], members[1]);

    vi.spyOn(transactionsProxy as never, "get_local_transactions").mockResolvedValue([transaction]);

    expect(await transactionsProxy.has_spent(group_uuid, members[0]?.uuid)).toBe(true);
    expect(await transactionsProxy.has_spent(group_uuid, members[1]?.uuid)).toBe(true);
    expect(await transactionsProxy.has_spent(group_uuid, uuidv4())).toBe(false);
});

test("synchronize merges remote and local transactions correctly", async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const members = await groupMembersProxy.get_group_members(group_uuid);
    const localTr = makeTransaction(members[0], members[1]);
    const remoteTr = makeTransaction(members[0], members[1]);

    // Local transaction in DB
    await db.transactions.add({
        ...localTr,
        group_uuid,
        paid_by: localTr.paid_by.uuid,
        status: STATUS.TO_CREATE
    });

    // Mock remote fetch
    vi.spyOn(transactionsProxy, "_get_remote_transactions" as never).mockResolvedValue([remoteTr]);

    const result = await transactionsProxy.synchronize(group_uuid);

    // Both transactions should be present locally now
    const all = await db.transactions.where("group_uuid").equals(group_uuid).toArray();
    expect(all.length).toBe(2);
    expect(result.find((t) => t.uuid === remoteTr.uuid)).toBeDefined();
    expect(result.find((t) => t.uuid === localTr.uuid)).toBeDefined();
});

test("local_synchronize loads transactions into Svelte store", async () => {
    const group_uuid = ((await groupsProxy.get_local_groups())[0]).token;
    const members = await groupMembersProxy.get_group_members(group_uuid);
    const transaction = makeTransaction(members[0], members[1]);

    // Add transaction to DB
    await db.transactions.add({
        ...transaction,
        group_uuid,
        paid_by: transaction.paid_by.uuid,
        status: STATUS.NOTHING
    });

    await transactionsProxy.local_synchronize(group_uuid);

    let storeValue: Record<string, Transaction[]> = {};
    group_transactions.subscribe((v) => (storeValue = v))();
    expect(storeValue[group_uuid].length).toBe(1);
    expect(storeValue[group_uuid][0].uuid).toBe(transaction.uuid);
});
