<script lang="ts">
    import type { Debt, Transaction, GroupMember } from "$lib/types";
    import TransactionView from "./TransactionView.svelte";
    import {
        updateTransaction,
        deleteTransaction,
    } from "$lib/shareCountAPI";
    import {v4 as uuidv4} from 'uuid';
    import { groupUsernames } from "../stores/groupUsernames";
    import { AddTransaction, DeleteTransaction, group_transactions, setTransactionID } from "../stores/group_transactions";
    let {
        main_currency,
        members,
        token,
        onUpdate,
    }: {
        main_currency: string | undefined;
        members: GroupMember[];
        token: string | null;
        onUpdate: (tx: Transaction[]) => void;
    } = $props();
    let index_count = -1;
    let creating_transaction: Transaction | null = $state(null);
    let creating: boolean = $state(false);

    async function handler_updateTransaction(
        transaction: Transaction,
    ): Promise<boolean> {
        try {
            await updateTransaction(token ?? "", transaction);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    async function handler_deleteTransaction(
        transaction: Transaction,
    ): Promise<boolean> {
        try {
            if (transaction.uuid) {
                await deleteTransaction(token ?? "", transaction.uuid);
            }
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    function create_debtors(): Debt[] {
        let debts = [] as Debt[];
        for (const member of members) {
            debts.push({ amount: "0", member });
        }
        return debts;
    }

    function updateTransactionLocal(id: number, modified: Transaction) {
        setTransactionID(id, modified);
    }
    const options = {
        weekday: undefined,
        year: "numeric",
        month: "long",
        day: "numeric",
    } as Intl.DateTimeFormatOptions;
</script>

<div class="flex flex-col h-dvh">
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
                        let result = await handler_updateTransaction(
                            $state.snapshot(newTransaction),
                        );
                        if (result) {
                            creating = false;
                            AddTransaction(newTransaction)
                        }
                        return result;
                    }}
                    onDelete={async (newTransaction: Transaction) => {}}
                ></TransactionView>
            {/if}
            {#each $group_transactions as transaction, id (transaction.uuid)}
                <div class="font-semibold text-base md:text-md lg:text-lg">
                    {#if id > 0}
                        {#if new Date(transaction.created_at.split("T")[0]).getDate() != new Date($group_transactions[id - 1].created_at.split("T")[0]).getDate()}
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
                            newTransaction.modified_at = new Date().toISOString().replace("Z", "");

                            let result = await handler_updateTransaction(
                                $state.snapshot(newTransaction),
                            );
                            updateTransactionLocal(id, newTransaction);
                            return result;
                        }}
                        onDelete={async (transaction: Transaction) => {
                            let result =
                                await handler_deleteTransaction(transaction);
                            let index = $group_transactions.findIndex(
                                (tr: Transaction) => {
                                    return tr.uuid == transaction.uuid;
                                },
                            );

                            if (index >= 0) {
                                DeleteTransaction(index);
                            }
                        }}
                        onCancel={(transaction) => {
                            updateTransactionLocal(id, transaction);
                        }}
                    ></TransactionView>
                </div>
            {/each}
        </div>
    </div>

    <button
        class="btn btn-accent w-2/3 md:w-1/3 mx-auto add-button mt-5"
        onclick={() => {
            creating = true;
            index_count-=1;
            creating_transaction = {
                uuid: uuidv4(),
                amount: "0",
                currency_id: main_currency ?? "USD",
                created_at: new Date().toISOString().replace("Z", ""),
                modified_at: new Date().toISOString().replace("Z", ""),
                debtors: create_debtors(),
                description: "",
                exchange_rate: "1",
                paid_by: $groupUsernames[token ?? ""] ?? members[0],
            };
        }}
    >
        Add transaction
    </button>
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
