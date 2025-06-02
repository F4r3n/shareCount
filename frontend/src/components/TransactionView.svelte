<script lang="ts">
    import type { Transaction, Debt, GroupMember } from "$lib/types";
    import { onMount } from "svelte";
    import { slide } from "svelte/transition";
    import { SvelteMap } from "svelte/reactivity";
    import Big from "big.js";
    import { getUTC } from "$lib/UTCDate";
    import InputNumber from "./InputNumber.svelte";
    import {
        getCurrencySymbol,
        getLengthOfFraction,
    } from "$lib/currencyFormat";
    import CurrencySelector from "./CurrencySelector.svelte";
    let {
        transaction,
        group_currency = transaction.currency_id,
        members,
        is_editing,
        is_open,
        is_creating,
        onSave,
        onDelete,
        onCancel,
    }: {
        transaction: Transaction;
        group_currency?: string;
        members: GroupMember[];
        is_editing: boolean;
        is_open: boolean;
        is_creating: boolean;
        onSave: (tx: Transaction) => Promise<boolean>;
        onDelete?: (tx: Transaction) => void;
        onCancel: (tx: Transaction) => void;
    } = $props();
    let modified_transaction = $state(
        structuredClone($state.snapshot(transaction)),
    );

    class DebtContainer {
        activated: boolean = $state(false);
        debt = $state({
            member: { uuid: "", nickname: "" } as GroupMember,
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

    let mapDebt: SvelteMap<string, DebtContainer> = new SvelteMap();
    let modal: HTMLDialogElement | null = null;
    let date_value = $derived(modified_transaction.created_at.split("T")[0]);

    function updateDebtors(newAmount: string) {
        //TODO convert with big number
        let amount = new Big(newAmount);
        let number_people = 0;

        // First pass: count activated people
        for (const [, debtContainer] of mapDebt) {
            number_people += debtContainer.activated ? 1 : 0;
        }

        if (number_people === 0) {
            // Handle case with no activated people
            return;
        }

        // Calculate base amount and remainder
        const baseAmount = amount.div(number_people).round(2, Big.roundDown);
        const totalBase = baseAmount.times(number_people - 1);
        const lastAmount = amount.minus(totalBase);

        let activatedCount = 0;
        for (const [, debtContainer] of mapDebt) {
            if (debtContainer.activated) {
                activatedCount++;

                if (activatedCount < number_people) {
                    debtContainer.debt.amount =
                        baseAmount.toFixed(currency_fixed);
                } else {
                    // Last person gets the remainder
                    debtContainer.debt.amount =
                        lastAmount.toFixed(currency_fixed);
                }
            } else {
                debtContainer.debt.amount = "0";
            }
        }

        const set_current_debtors: Set<string> = new Set();

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

        for (const [, debtContainer] of mapDebt) {
            if (debtContainer.activated) {
                if (
                    !set_current_debtors.has(debtContainer.debt.member.nickname)
                ) {
                    modified_transaction.debtors.push(debtContainer.debt);
                }
            }
        }
        modified_transaction.modified_at = getUTC();
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
        is_open = false;
        if (onDelete) {
            onDelete($state.snapshot(modified_transaction));
        }
        modal?.close();
    }

    function hasChanged(
        transaction: Transaction,
        modified_transaction: Transaction,
    ) {
        return modified_transaction.modified_at !== transaction.modified_at;
    }
    interface Error {
        code?: number;
        message: string;
    }
    function validate(transaction: Transaction): Error | null {
        if (transaction.description === "")
            return {
                code: 2,
                message: "Error: The transaction must have a description",
            };
        const total_sum_to_reach = new Big(transaction.amount);
        if (total_sum_to_reach <= new Big("0")) {
            return {
                code: 3,
                message: "Error: The transaction must must be positive",
            };
        }
        let current_sum = new Big("0");
        for (const member of transaction.debtors) {
            current_sum = current_sum.add(new Big(member.amount));
        }
        let isOK = current_sum.eq(total_sum_to_reach);
        if (!isOK) {
            return {
                code: 1,
                message: "Error: The transaction is not equal to the debts",
            };
        }
        return null;
    }
    //2024-03-06
    async function getExchangeRate(
        from: string,
        to: string,
        date: Date,
    ): Promise<number> {
        const dateString = date.toISOString().split("T")[0];
        try {
            const result = await fetch(
                `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateString}/v1/currencies/${from.toLocaleLowerCase()}.json`,
            );
            const data = await result.json();
            const exchange_rate = data[from.toLowerCase()][to.toLowerCase()];
            return exchange_rate;
        } catch {}
        return 1;
    }
    let error: Error | null = $state(null);
    const currency_symbol = $derived(
        getCurrencySymbol(modified_transaction.currency_id),
    );
    const currency_fixed = $derived(
        getLengthOfFraction(modified_transaction.currency_id),
    );
</script>

<main>
    <div class="flex justify-between w-full items-center">
        <div class="flex flex-col w-full">
            <button
                class="flex gap-x-2 flex-grow bg-base-200 shadow rounded-md hover:cursor-pointer p-3"
                onclick={() => {
                    is_open = !is_open;
                    if (is_open) {
                        is_editing = true;
                    }
                }}
            >
                {#if hasChanged(transaction, modified_transaction)}
                    <div class="status status-info animate-bounce"></div>
                {/if}
                <div
                    class="grid grid-cols-[1fr_auto] grid-rows-2 gap-x-4 items-center w-full"
                >
                    <div
                        class="col-start-1 row-start-1 truncate text-left text-base md:text-md lg:text-lg text-base-content"
                    >
                        {modified_transaction.description}
                    </div>

                    <div
                        class="col-start-1 row-start-2 text-left text-sm text-base-content/80"
                    >
                        Paid by {modified_transaction.paid_by.nickname}
                    </div>

                    <div
                        class="col-start-2 row-start-1 row-span-2 flex flex-col items-center justify-center text-base md:text-md lg:text-lg h-full"
                    >
                        <div class="flex flex-row">
                            <div class="max-w-30 truncate">
                                {modified_transaction.amount}
                            </div>
                            <div>
                                {currency_symbol}
                            </div>
                        </div>
                    </div>
                </div>
            </button>
        </div>
    </div>

    {#if is_open}
        <div transition:slide>
            <div class="flex flex-col p-3 border-accent border rounded-md">
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
                                onchange={() => {
                                    modified_transaction.modified_at = getUTC();
                                }}
                            />
                        </div>
                        <legend class="fieldset-legend">Amount</legend>
                        <div class="join">
                            <CurrencySelector
                                bind:current_currency={
                                    modified_transaction.currency_id
                                }
                                onChange={(newCurrency) => {
                                    if (newCurrency != group_currency) {
                                        getExchangeRate(
                                            newCurrency,
                                            group_currency,
                                            new Date(
                                                modified_transaction.created_at,
                                            ),
                                        ).then((value: number) => {
                                            modified_transaction.exchange_rate =
                                                value.toString();
                                        });
                                    }
                                    else
                                    {
                                        modified_transaction.exchange_rate = "1";
                                    }
                                }}
                            ></CurrencySelector>
                            <InputNumber
                                title="Transaction amount"
                                {is_editing}
                                bind:value={modified_transaction.amount}
                                onChange={(value: string) => {
                                    updateDebtors(value);
                                }}
                            ></InputNumber>
                        </div>
                        {#if modified_transaction.currency_id != group_currency}
                            <legend class="fieldset-legend"
                                >Exchange rate</legend
                            >
                            <InputNumber
                                {is_editing}
                                bind:value={modified_transaction.exchange_rate}
                                title="Exchange rate"
                            ></InputNumber>
                        {/if}
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
                                {#each members as member (member.uuid)}
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
                                    const date = new Date();
                                    modified_transaction.created_at =
                                        date_value +
                                        `T${date.getUTCHours()}:${date.getUTCMinutes()}:${date.getSeconds()}.000000`;
                                }}
                            />
                        </fieldset>
                    </div>
                </div>
                <div class="flex flex-col justify-between w-full pl-4 pr-4">
                    {#each mapDebt as [nickname, debtContainer] (nickname)}
                        <div
                            class="flex flex-row mt-2 justify-between w-full items-center"
                        >
                            {#if is_editing}
                                <label class="label mr-2">
                                    <input
                                        type="checkbox"
                                        class="checkbox checkbox-accent checkbox-xs sm:checkbox-sm md:checkbox-md"
                                        bind:checked={debtContainer.activated}
                                        onchange={() => {
                                            updateDebtors(
                                                modified_transaction.amount,
                                            );
                                        }}
                                    />
                                    {nickname}
                                </label>
                                <div class="max-w-1/3">
                                    <InputNumber
                                        title="Debtor amount"
                                        {is_editing}
                                        bind:value={debtContainer.debt.amount}
                                    ></InputNumber>
                                </div>
                            {:else}
                                <div>{debtContainer.debt.member.nickname}</div>
                                <div>{debtContainer.debt.amount}</div>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
            {#if error}
                <div role="alert" class="alert alert-error">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6 shrink-0 stroke-current"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <span>{error.message}</span>
                </div>
            {/if}
            <div class="flex flex-row justify-between gap-x-2 m-2">
                <!-- Left side: Delete and Reset -->
                {#if is_creating}
                    <button
                        class="btn btn-sm btn-error"
                        onclick={() => {
                            onCancel(modified_transaction);
                        }}
                    >
                        Cancel
                    </button>
                {:else}
                    <div class="flex flex-row gap-x-2">
                        <button
                            class="btn btn-sm btn-error"
                            onclick={() => {
                                modal?.showModal();
                            }}
                        >
                            Delete
                        </button>
                        <button
                            class="btn btn-sm btn-error"
                            onclick={() => {
                                modified_transaction = transaction;
                                onCancel(transaction);
                            }}
                        >
                            Reset
                        </button>
                    </div>
                {/if}

                <div>
                    <button
                        class="btn btn-sm btn-primary"
                        onclick={async () => {
                            error = validate(modified_transaction);
                            if (error == null) {
                                transaction = modified_transaction;
                                if (await onSave(modified_transaction)) {
                                    is_editing = false;
                                    is_open = false;
                                }
                            }
                        }}
                    >
                        Save
                    </button>
                </div>
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
