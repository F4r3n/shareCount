<script lang="ts">
    import type { Transaction, Debt } from "$lib/types";
    import { onMount } from "svelte";
    import { slide } from "svelte/transition";
    import { CheckIcon, X, PencilIcon, Ambulance } from "lucide-svelte";

    let {
        transaction,
        members,
        onSave
    }: { transaction: Transaction, members: string[], onSave : (tx : Transaction)=>void } = $props();
    let modified_transaction: Transaction = $state($state.snapshot(
        transaction,
    ) as Transaction);

    class DebtContainer {
        activated : boolean = $state(false)
        debt : Debt
        constructor(debt : Debt, activated : boolean) {
            this.debt = debt;
            this.activated = activated;
            if(!this.activated)
                this.activated = parseFloat(this.debt.amount) > 0;
        }

        setDebt(inDebt : Debt) {
            this.debt = inDebt;
        }
    }

    let is_open: boolean = $state(false);
    let is_same: boolean = $state(true);
    let is_editing: boolean = $state(false);
    let mapDebt: Map<string, DebtContainer> = $state(new Map());

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
            }
            else {
                debtContainer.debt.amount = "0";
            }
        }
        for(let i = 0; i < modified_transaction.debtors.length; ++i) {
            const updatedDebt = mapDebt.get(modified_transaction.debtors[i].nickname);
            if(updatedDebt) {
                modified_transaction.debtors[i] = updatedDebt.debt;
            }
        }
        
        console.log($state.snapshot(modified_transaction))
    }

    onMount(() => {
        for (const member of members) {
            mapDebt.set(member, new DebtContainer({nickname:member, amount:"0"} as Debt, false));
        }

        for (const debt of modified_transaction.debtors) {
            mapDebt.set(debt.nickname, new DebtContainer(debt, true));
            console.log(Object.is(debt, mapDebt.get(debt.nickname)?.debt))
        }


    });

    function hasChanged(): boolean {
        return (
            JSON.stringify($state.snapshot(modified_transaction)) ===
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
                    bind:value={modified_transaction.description}
                />

                <div class="flex items-center sm:text-lg">
                    <input
                        type="number"
                        placeholder="Type here"
                        class="input input-ghost"
                        bind:value={modified_transaction.amount}
                        onchange={() => {
                            updateDebtors(modified_transaction.amount);
                        }}
                    />
                    <input
                        type="text"
                        placeholder="Type here"
                        class="input input-ghost"
                        bind:value={modified_transaction.currency}
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
                    Object.assign(modified_transaction, transaction);
                }}
            >
                <div
                    class="flex flex-row items-center gap-x-2 lg:text-2xl md:text-xl sm:text-lg flex-grow"
                >
                    <div class="truncate">{modified_transaction.description}</div>
                </div>
                <div class="flex items-center sm:text-lg">
                    <div>{modified_transaction.amount}</div>
                    <div>{modified_transaction.currency}</div>
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
                    //TODO: Send event to parent
                    is_same = hasChanged();
                    is_editing = false;
                    console.log($state.snapshot(modified_transaction))
                    if(!is_same) {
                        onSave($state.snapshot(modified_transaction) as Transaction)
                    }
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
                    Object.assign(modified_transaction, transaction);
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
            {#each mapDebt as [nickname, debtContainer]}
                <div
                    class="flex flex-row mt-2 justify-between w-full items-center"
                >
                    {#if is_editing}
                        <label class="label">
                            <input
                                type="checkbox"
                                class="checkbox"
                                bind:checked={debtContainer.activated}
                                onchange={(event) => {
                                    updateDebtors(modified_transaction.amount);
                                }}
                            />
                            {nickname}
                        </label>
                        {#if parseFloat(debtContainer.debt.amount) >= 0}
                            <input
                                type="number"
                                class="input validator"
                                required
                                placeholder={String(debtContainer.debt.amount)}
                                min="0"
                                max={modified_transaction.amount}
                                title="Must be between be 0 to {String(
                                    modified_transaction.amount,
                                )}"
                                bind:value={debtContainer.debt.amount}
                                onchange={() => {
                                    is_same = hasChanged();
                                }}
                            />
                        {:else}
                            <div>0</div>
                        {/if}
                    {:else}
                        <div>{debtContainer.debt.nickname}</div>
                        <div>{debtContainer.debt.amount}</div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</main>

<style>
</style>
