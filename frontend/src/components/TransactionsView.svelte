<script lang="ts">
    import type { Debt, Transaction, GroupMember } from "$lib/types";
    import TransactionView from "./TransactionView.svelte";
    import { onMount } from "svelte";
    import { v4 as uuidv4 } from "uuid";
    import { transactionsProxy } from "../stores/group_transactions";
    import { current_user } from "../stores/groupUsernames";
    import { groupMembersProxy } from "../stores/group_members";
    import { current_groupStore } from "../stores/group";
    import { STATUS } from "../db/db";
    let {
        main_currency,
        members,
    }: {
        main_currency: string | undefined;
        members: GroupMember[];
    } = $props();
    let index_count = -1;
    let creating_transaction: Transaction | null = $state(null);
    let creating: boolean = $state(false);
    let transactions: Transaction[] = $state([]);
    function create_debtors(): Debt[] {
        let debts = [] as Debt[];
        for (const member of members) {
            debts.push({ amount: "0", member });
        }
        return debts;
    }

    onMount(async () => {
        if ($current_user?.group_uuid) {
            transactions = await transactionsProxy.local_synchronize(
                $current_user.group_uuid,
            );
        }
    });

    const options = {
        weekday: undefined,
        year: "numeric",
        month: "long",
        day: "numeric",
    } as Intl.DateTimeFormatOptions;
</script>

<div class="flex flex-col h-dvh">
    <button
        class="btn btn-accent w-2/3 md:w-1/3 mx-auto add-button mt-5"
        onclick={async () => {
            const current_member = await groupMembersProxy.get_local_member(
                $current_user?.member_uuid ?? "",
            );
            creating = true;
            index_count -= 1;
            creating_transaction = {
                uuid: uuidv4(),
                amount: "0",
                currency_id: main_currency ?? "USD",
                created_at: new Date().toISOString().replace("Z", ""),
                modified_at: new Date().toISOString().replace("Z", ""),
                debtors: create_debtors(),
                description: "New transaction",
                exchange_rate: "1",
                paid_by: current_member ?? ({} as GroupMember),
            };
        }}
    >
        Add transaction
    </button>
    <div class="transactions">
        <div class="flex flex-col w-full md:w-8/12 mx-1">
            {#if creating && creating_transaction}
                <TransactionView
                    transaction={creating_transaction}
                    {members}
                    is_editing={true}
                    is_open={true}
                    is_creating={true}
                    onCancel={() => {
                        creating = false;
                    }}
                    onSave={async (
                        newTransaction: Transaction,
                    ): Promise<boolean> => {
                        if ($current_groupStore) {
                            transactionsProxy.add_transaction(
                                $current_groupStore.token,
                                newTransaction,
                            );
                        }
                        return true;
                    }}
                    onDelete={async (newTransaction: Transaction) => {}}
                ></TransactionView>
            {/if}
            {#each transactions as transaction, id (transaction.uuid)}
                <div class="font-semibold text-base md:text-md lg:text-lg">
                    {#if id > 0}
                        {#if new Date(transaction.created_at.split("T")[0]).getDate() != new Date(transactions[id - 1].created_at.split("T")[0]).getDate()}
                            <div class="my-2">
                                {new Date(
                                    transaction.created_at.split("T")[0],
                                ).toLocaleDateString(undefined, options)}
                            </div>
                        {/if}
                    {:else}
                        {new Date(
                            transaction.created_at.split("T")[0],
                        ).toLocaleDateString(undefined, options)}
                    {/if}
                </div>
                <div>
                    <TransactionView
                        {transaction}
                        {members}
                        is_editing={true}
                        is_open={false}
                        is_creating={false}
                        onSave={async (
                            newTransaction: Transaction,
                        ): Promise<boolean> => {
                            if ($current_groupStore) {
                                transactionsProxy.add_transaction(
                                    $current_groupStore.token,
                                    newTransaction,
                                );
                            }

                            return true;
                        }}
                        onDelete={async (transaction: Transaction) => {
                            if ($current_groupStore) {
                                transactionsProxy.delete_transaction(
                                    $current_groupStore.token,
                                    transaction,
                                );
                            }
                        }}
                        onCancel={(transaction) => {
                            //updateTransactionLocal(id, transaction);
                        }}
                    ></TransactionView>
                </div>
            {/each}
        </div>
    </div>
</div>

<style>
    .transactions {
        display: flex;
        width: 100%;
        justify-content: center;
        overflow-y: auto;
    }

    .add-button {
        position: sticky;
        bottom: 2%;
        z-index: 1;
    }
</style>
