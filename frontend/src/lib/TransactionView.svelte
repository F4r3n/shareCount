<script lang="ts">
    import type { Transaction, Debt, GroupMember } from "$lib/types";
    import { onMount } from "svelte";
    import { slide } from "svelte/transition";
    import { CheckIcon, X, PencilIcon, Trash2Icon } from "lucide-svelte";
    import { SvelteMap } from "svelte/reactivity";
    let {
        transaction,
        members,
        is_editing,
        is_open,
        onSave,
        onDelete,
        onCancel,
    }: {
        transaction: Transaction;
        members: GroupMember[];
        is_editing: boolean;
        is_open: boolean;
        onSave: (tx: Transaction) => Promise<boolean>;
        onDelete: (tx: Transaction) => void;
        onCancel: (tx: Transaction) => void;
    } = $props();
    let modified_transaction = $state(transaction);

    class DebtContainer {
        activated: boolean = $state(false);
        debt = $state({
            member: { id: 0, nickname: "" } as GroupMember,
            amount: "0",
        } as Debt);
        constructor(debt: Debt, activated: boolean) {
            this.debt = debt;
            this.activated = activated;
            if (!this.activated)
                this.activated = parseFloat(this.debt.amount) >= 0;
        }

        setDebt(inDebt: Debt) {
            this.debt = inDebt;
        }
    }

    let mapDebt: SvelteMap<string, DebtContainer> = $state(new SvelteMap());
    let modal: HTMLDialogElement | null = null;
    let date_value = $derived(modified_transaction.created_at.split("T")[0]);

    function updateDebtors(newAmount: string) {
        //TODO convert with big number
        let amount = parseFloat(newAmount);
        let number_people = 0;
        for (const [key, debtContainer] of mapDebt) {
            number_people += debtContainer.activated ? 1 : 0;
        }

        for (const [key, debtContainer] of mapDebt) {
            if (debtContainer.activated) {
                debtContainer.debt.amount = String(amount / number_people);
            } else {
                debtContainer.debt.amount = "0";
            }
        }

        const set_current_debtors: Set<String> = new Set();

        for (let i = 0; i < modified_transaction.debtors.length; ++i) {
            const updatedDebt = mapDebt.get(
                modified_transaction.debtors[i].member.nickname,
            );
            if (updatedDebt) {
                modified_transaction.debtors[i] = updatedDebt.debt;
            }
            set_current_debtors.add(
                modified_transaction.debtors[i].member.nickname,
            );
        }

        for (const [key, debtContainer] of mapDebt) {
            if (debtContainer.activated) {
                if (
                    !set_current_debtors.has(debtContainer.debt.member.nickname)
                ) {
                    modified_transaction.debtors.push(debtContainer.debt);
                }
            }
        }
    }

    onMount(() => {
        for (const member of members) {
            mapDebt.set(
                member.nickname,
                new DebtContainer(
                    { member: member, amount: "0" } as Debt,
                    false,
                ),
            );
        }

        for (const debt of modified_transaction.debtors) {
            mapDebt.set(debt.member.nickname, new DebtContainer(debt, true));
        }
    });

    function handleDelete() {
        // Replace with your actual logic
        onDelete($state.snapshot(modified_transaction));
        modal?.close();
    }
</script>

<main>
    <div class="flex justify-between w-full items-center">
        <div class="flex flex-col w-full">
            <button
                class="flex gap-x-2 flex-grow bg-base-200 shadow rounded-md hover:cursor-pointer p-3"
                onclick={() => {
                    is_open = !is_open;
                    is_editing = false;
                    modified_transaction = transaction;
                }}
            >
                <div
                    class="grid grid-cols-[1fr_auto] grid-rows-2 gap-x-4 items-center w-full"
                >
                    <!-- Title: Top-left -->
                    <div
                        class="col-start-1 row-start-1 truncate text-left text-base md:text-md lg:text-lg text-base-content"
                    >
                        {modified_transaction.description}
                    </div>

                    <!-- Paid by: Second row, left column -->
                    <div
                        class="col-start-1 row-start-2 text-left text-sm text-base-content/80"
                    >
                        Paid by {modified_transaction.paid_by.nickname}
                    </div>

                    <!-- Amount: Right, vertically centered across first two rows -->
                    <div
                        class="col-start-2 row-start-1 row-span-2 flex flex-col items-center justify-center text-base md:text-md lg:text-lg h-full"
                    >
                        <div>
                            {modified_transaction.amount}
                            {modified_transaction.currency_id}
                        </div>
                    </div>
                </div>
            </button>
            {#if is_editing}
                <div class="flex flex-row justify-start gap-x-2 mt-2">
                    <button
                        type="button"
                        aria-label="Confirm"
                        class="ml-2 p-1 rounded-full flex items-center justify-center
               hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                        onclick={async () => {
                            //TODO: Send event to parent
                            //if (!is_same) {
                            transaction = modified_transaction;
                            if (await onSave(modified_transaction)) {
                                is_editing = false;
                            } else {
                                is_editing = true;
                            }
                            //}
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
                            modified_transaction = transaction;
                            is_editing = false;
                            is_open = false;
                            onCancel(modified_transaction);
                        }}
                    >
                        <X
                            class="text-red-600 w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8"
                        />
                    </button>
                </div>
            {/if}
        </div>
    </div>

    {#if is_open}
        <div class="flex flex-col" transition:slide>
            <div class="flex items-center">
                <fieldset class="fieldset">
                    <legend class="fieldset-legend">Title</legend>

                    <div class="flex items-center gap-x-2 flex-grow">
                        <input
                            type="text"
                            placeholder="Hotel"
                            readonly={!is_editing}
                            class="input input-ghost md:input-md lg:input-lg"
                            bind:value={modified_transaction.description}
                        />
                    </div>
                    <legend class="fieldset-legend">Amount</legend>
                    <div class="join">
                        <input
                            readonly={!is_editing}
                            type="text"
                            placeholder="USD"
                            class="input input-ghost md:input-md lg:input-lg"
                            bind:value={modified_transaction.currency_id}
                        />
                        <input
                            readonly={!is_editing}
                            type="number"
                            placeholder="0"
                            class="input input-ghost md:input-md lg:input-lg"
                            bind:value={modified_transaction.amount}
                            onchange={() => {
                                updateDebtors(modified_transaction.amount);
                            }}
                        />
                    </div>
                </fieldset>
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <div class="flex items-center sm:space-x-8 space-x-4">
                    <fieldset class="fieldset">
                        <legend class="fieldset-legend">Paid by</legend>
                        <select
                            class="select"
                            disabled={!is_editing}
                            bind:value={modified_transaction.paid_by}
                        >
                            <option
                                disabled
                                selected
                                value={modified_transaction.paid_by}
                            >
                                {modified_transaction.paid_by.nickname}
                            </option>
                            {#each members as member}
                                <option value={member}>
                                    {member.nickname}
                                </option>
                            {/each}
                        </select>
                    </fieldset>
                    <fieldset class="fieldset">
                        <legend class="fieldset-legend">When</legend>
                        <input
                            type="date"
                            readonly={!is_editing}
                            class="input input-bordered w-full max-w-[10rem] sm:max-w-xs"
                            aria-label="Transaction date"
                            bind:value={date_value}
                            onchange={() => {
                                modified_transaction.created_at =
                                    date_value + "T00:00:00.000000";
                            }}
                        />
                    </fieldset>
                </div>
            </div>
            <div class="flex flex-col justify-between w-full pl-4 pr-4">
                {#each mapDebt as [nickname, debtContainer]}
                    <div
                        class="flex flex-row mt-2 justify-between w-full items-center"
                    >
                        {#if is_editing}
                            <label class="label mr-2">
                                <input
                                    type="checkbox"
                                    class="checkbox checkbox-accent checkbox-xs sm:checkbox-sm md:checkbox-md"
                                    bind:checked={debtContainer.activated}
                                    onchange={(event) => {
                                        updateDebtors(
                                            modified_transaction.amount,
                                        );
                                    }}
                                />
                                {nickname}
                            </label>
                            {#if parseFloat(debtContainer.debt.amount) >= 0}
                                <input
                                    type="number"
                                    class="input validator"
                                    required
                                    placeholder={String(
                                        debtContainer.debt.amount,
                                    )}
                                    min="0"
                                    max={modified_transaction.amount}
                                    title="Must be between be 0 to {String(
                                        modified_transaction.amount,
                                    )}"
                                    bind:value={debtContainer.debt.amount}
                                    onchange={() => {}}
                                />
                            {:else}
                                <div>0</div>
                            {/if}
                        {:else}
                            <div>{debtContainer.debt.member.nickname}</div>
                            <div>{debtContainer.debt.amount}</div>
                        {/if}
                    </div>
                {/each}
            </div>
            <div class="flex flex-row justify-end gap-x-2 mt-2">
                <button
                    class="btn btn-sm btn-primary"
                    onclick={() => {
                        is_editing = true;
                        is_open = true;
                    }}
                >
                    Edit
                </button>
                <button
                    class="btn btn-sm btn-error"
                    onclick={() => {
                        modal?.showModal();
                    }}
                >
                    Delete
                </button>
            </div>
        </div>
    {/if}
</main>

<dialog
    id="my_modal_1"
    class="modal"
    bind:this={modal}
    aria-modal="true"
    aria-labelledby="modal-title"
    aria-describedby="modal-desc"
>
    <div class="modal-box w-full max-w-xs sm:max-w-lg p-6 rounded-lg">
        <h3 id="modal-title" class="text-lg font-bold">
            This transaction will be deleted, are you sure?
        </h3>
        <div class="modal-action flex flex-col sm:flex-row gap-2">
            <button
                class="btn btn-error w-full sm:w-auto"
                type="button"
                onclick={handleDelete}
            >
                Yes, Delete
            </button>
            <form method="dialog" class="w-full sm:w-auto">
                <button class="btn w-full sm:w-auto" type="submit"
                    >Cancel</button
                >
            </form>
        </div>
    </div>
</dialog>

<style>
</style>
