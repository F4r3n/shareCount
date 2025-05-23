<script lang="ts">
    import type { GroupMember, Transaction } from "$lib/types";
    import { onMount } from "svelte";
    import init, {
        compute_balance,
        compute_settlements,
        type Amount,
        type Settlement,
    } from "wasm-lib";
    import Modal from "./Modal.svelte";
    import { type ModalButton } from "./ModalTypes";
    import { transactionsProxy } from "../stores/group_transactions";
    import { current_user } from "../stores/groupUsernames";
    let { members }: { members: GroupMember[] } = $props();
    let modal: Modal | null = $state(null);
    let balances: Amount[] = $state([]);
    let settlements: Settlement[] = $state([]);

    async function compute(amounts: Amount[]) {
        const wasmUrl = new URL('./wasm_lib_bg.wasm', import.meta.url).href;
        console.log(wasmUrl, import.meta.url)
        await init(wasmUrl);
        balances = compute_balance(amounts);
        settlements = compute_settlements(balances);
    }

    onMount(async () => {
        let amounts = [];

        for (const member of members) {
            amounts.push({ member: member, amount: "0" } as Amount);
        }
        let transactions = [] as Transaction[];
        if ($current_user?.group_uuid) {
            transactions = await transactionsProxy.local_synchronize(
                $current_user.group_uuid,
            );
        }
        for (const transaction of transactions) {
            amounts.push({
                member: transaction.paid_by,
                amount: transaction.amount,
            } as Amount);
            for (let debt of transaction.debtors) {
                amounts.push({
                    member: debt.member,
                    amount: "-" + debt.amount,
                } as Amount);
            }
        }
        await compute(amounts);
    });
</script>

<main class="w-full sm:w-2/3 mx-auto">
    <div class="m-2">
        <h2>Balances</h2>
        <div>
            {#each balances as balance}
                <div
                    class="bg-base-100 rounded-md flex flex-row justify-between m-1 p-2"
                >
                    <div class="pl-2">{balance.member.nickname}</div>
                    <div>{balance.amount}</div>
                </div>
            {/each}
        </div>
    </div>
    <div class="m-2">
        <h2>Settlements</h2>
        <div>
            {#each settlements as settlement}
                {#if settlement.amount !== "0"}
                    <div class="bg-base-100 rounded-md m-1 p-2 flex flex-col">
                        <div class="flex flex-row justify-between">
                            <div class="flex flex-row">
                                <div class="pl-2">
                                    {settlement.member_from.nickname}
                                </div>
                                <span class="px-2 text-base-content/80"
                                    >(owes)</span
                                >
                                <div>{settlement.member_to.nickname}</div>
                            </div>

                            <div>{settlement.amount}</div>
                        </div>

                        <button
                            class="btn mt-3 btn-accent"
                            onclick={() => {
                                modal?.open(
                                    "Should I create a transaction",
                                    {
                                        text: "Yes create",
                                        callback: () => {},
                                    } as ModalButton,
                                    {
                                        text: "No forget",
                                        callback: () => {},
                                    } as ModalButton,
                                );
                            }}>Mark as paid</button
                        >
                    </div>
                {/if}
            {/each}
        </div>
    </div>
</main>

<Modal bind:this={modal}></Modal>
