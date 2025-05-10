<script lang="ts">
    import type { Debt, Transaction, GroupMember } from "$lib/types";
    import TransactionView from "$lib/TransactionView.svelte";
    import {
        updateTransaction,
        deleteTransaction,
        sort_transactions,
    } from "$lib/shareCountAPI";
    let {
        transactions,
        main_currency,
        members,
        token,
        onUpdate,
    }: {
        transactions: Transaction[];
        main_currency: string | undefined;
        members: GroupMember[];
        token: string | null;
        onUpdate: (tx: Transaction[]) => void;
    } = $props();

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
            if (transaction.id) {
                await deleteTransaction(token ?? "", transaction.id);
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
        let updated = [...transactions];
        updated[id] = modified;
        updated = sort_transactions(updated);
        onUpdate && onUpdate(updated);
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
                            transactions.push(newTransaction);
                        }
                        return result;
                    }}
                    onDelete={async (newTransaction: Transaction) => {}}
                ></TransactionView>
            {/if}
            {#each transactions as transaction, id (transaction.id)}
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
                        is_editing={false}
                        is_open={false}
                        onSave={async (
                            newTransaction: Transaction,
                        ): Promise<boolean> => {
                            let result = await handler_updateTransaction(
                                $state.snapshot(newTransaction),
                            );
                            updateTransactionLocal(id, newTransaction);
                            return result;
                        }}
                        onDelete={handler_deleteTransaction}
                        onCancel={() => {}}
                    ></TransactionView>
                </div>
            {/each}
        </div>
    </div>

    <button
        class="btn btn-accent md:w-1/3 mx-auto add-button mt-5"
        onclick={() => {
            creating = true;
            creating_transaction = {
                id: -1,
                amount: "0",
                currency_id: main_currency ?? "USD",
                created_at: new Date().toISOString().replace("Z", ""),
                debtors: create_debtors(),
                description: "",
                exchange_rate: "1",
                paid_by: { id: 0, nickname: "" },
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
        bottom: 0;
        z-index: 1;
    }
</style>
