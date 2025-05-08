<script lang="ts">
    import { onMount } from "svelte";
    import type { Debt, Transaction, GroupMember } from "$lib/types";
    import TransactionView from "$lib/TransactionView.svelte";
    import { updateTransaction, deleteTransaction } from "$lib/shareCountAPI";
    let {
        transactions,
        main_currency,
        members,
        token,
    }: {
        transactions: Transaction[];
        main_currency: string | undefined;
        members: GroupMember[];
        token: string | null;
    } = $props();
    let creating_transaction: Transaction | null = $state(null);
    onMount(async () => {});
    let creating: boolean = $state(false);
    </script>

<div class="flex flex-col h-dvh">
    <div class="transactions">
        <div class="flex flex-col w-full md:w-8/12 mx-1">
            {#each transactions as transaction}
                <TransactionView
                    {transaction}
                    {members}
                    is_editing={false}
                    is_open={false}
                    onSave={async (newTransaction: Transaction) => {
                        try {
                            await updateTransaction(
                                token ?? "",
                                newTransaction,
                            );
                        } catch (e) {
                            console.log(e);
                        }
                    }}
                    onDelete={async (newTransaction: Transaction) => {
                        try {
                            console.log(newTransaction)
                            await deleteTransaction(token ?? "", newTransaction.id);
                        } catch (e) {
                            console.log(e);
                        }
                    }}
                ></TransactionView>
            {/each}
            {#if creating && creating_transaction}
                <TransactionView
                    transaction={creating_transaction}
                    {members}
                    is_editing={true}
                    is_open={true}
                    onSave={async (newTransaction: Transaction) => {
                        try {
                        } catch (e) {
                            console.log(e);
                        }
                    }}
                    onDelete={async (newTransaction: Transaction) => {
                        try {
                        } catch (e) {
                            console.log(e);
                        }
                    }}
                ></TransactionView>
            {/if}
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
                created_at: new Date().toDateString(),
                debtors: [] as Debt[],
                description: "",
                exchange_rate:"1",
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
