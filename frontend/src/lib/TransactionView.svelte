<script lang="ts">
    import type { Transaction } from "$lib/types";
    import { onMount } from "svelte";
    import { slide } from "svelte/transition";
    import { CheckIcon, X, PencilIcon } from "lucide-svelte";
    let { transaction }: { transaction: Transaction } = $props();
    let original_transaction: Transaction = $state.snapshot(
        transaction,
    ) as Transaction;

    let is_open: boolean = $state(false);
    let is_same: boolean = $state(true);
    let is_editing: boolean = $state(false);

    onMount(() => {});

    function hasChanged(): boolean {
        return (
            JSON.stringify(original_transaction) ===
            JSON.stringify($state.snapshot(transaction))
        );
    }
</script>

<main>
    <div class="flex justify-between w-full items-center">
        {#if is_editing}
            <div class="flex items-center gap-x-2 flex-grow">
                <input
                    type="text"
                    placeholder="Type here"
                    class="input input-ghost lg:text-2xl md:text-xl sm:text-lg flex-grow"
                    bind:value={transaction.description}
                />

                <div class="flex items-center sm:text-lg">
                    <input
                        type="number"
                        placeholder="Type here"
                        class="input input-ghost"
                        bind:value={transaction.amount}
                    />
                    <input
                        type="text"
                        placeholder="Type here"
                        class="input input-ghost"
                        bind:value={transaction.currency}
                    />
                </div>
            </div>
        {:else}
            <button
                class="btn flex items-center gap-x-2 flex-grow"
                type="button"
                onclick={() => {
                    is_open = !is_open;
                    is_editing = false;
                    Object.assign(transaction, original_transaction);
                }}
            >
                <div
                    class="flex flex-row items-center gap-x-2 lg:text-2xl md:text-xl sm:text-lg flex-grow"
                >
                    <div class="truncate">{transaction.description}</div>
                </div>
                <div class="flex items-center sm:text-lg">
                    <div>{transaction.amount}</div>
                    <div>{transaction.currency}</div>
                </div>
            </button>
        {/if}

        <!-- Icon buttons (only show when !is_same) -->
        {#if is_editing}
            <button
                type="button"
                aria-label="Confirm"
                class="ml-2 p-1 rounded-full flex items-center justify-center
               hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                onclick={() => {
                    original_transaction = $state.snapshot(
                        transaction,
                    ) as Transaction;
                    is_same = hasChanged();
                    is_editing = false;
                }}
            >
                <CheckIcon
                    class="text-green-600 w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8"
                />
            </button>

            <button
                type="button"
                aria-label="Reject"
                class="ml-2 p-1 rounded-full flex items-center justify-center hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 transition"
                onclick={() => {
                    Object.assign(transaction, original_transaction);
                    is_same = hasChanged();
                    is_editing = false;
                    is_open = false;
                }}
            >
                <X class="text-red-600 w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" />
            </button>
        {:else}
            <button
                type="button"
                aria-label="Edit"
                class="btn"
                onclick={() => {
                    is_editing = true;
                    is_open = true;
                }}
            >
                <PencilIcon></PencilIcon>
            </button>
        {/if}
    </div>

    {#if is_open}
        <div class="flex flex-col justify-between w-full pl-8" transition:slide>
            {#each transaction.debtors as debt}
                <div class="flex flex-row mt-2 justify-between w-full items-center">
                    <div>{debt.nickname}</div>
                    {#if is_editing}
                        <input
                            type="number"
                            class="input validator"
                            required
                            placeholder={String(debt.amount)}
                            min="0"
                            max={transaction.amount}
                            title="Must be between be 0 to {String(
                                transaction.amount,
                            )}"
                            bind:value={debt.amount}
                            onchange={() => {
                                is_same = hasChanged();
                            }}
                        />
                    {:else}
                        <div>{debt.amount}</div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</main>

<style>
</style>
