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

    let {
        members,
        transactions,
    }: { members: GroupMember[]; transactions: Transaction[] } = $props();
    let modal: HTMLDialogElement | null = $state(null);
    let balances: Amount[] = $state([]);
    let settlements: Settlement[] = $state([]);
    onMount(async () => {
        let amounts = [];
        await init(); // Initialize WASM memory
        console.log(transactions);
        for (const member of members) {
            amounts.push({ member: member, amount: "0" } as Amount);
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
        balances = compute_balance(amounts);
        settlements = compute_settlements(balances);
    });
</script>

<main class="w-2/3 mx-auto">
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
                <div class="bg-base-100 rounded-md m-1 p-2 flex flex-col">
                    <div class="flex flex-row justify-between">
                        <div class="flex flex-row">
                            <div class="pl-2">
                                {settlement.member_from.nickname}
                            </div>
                            <span class="px-2 text-base-content/80">(owes)</span
                            >
                            <div>{settlement.member_to.nickname}</div>
                        </div>

                        <div>{settlement.amount}</div>
                    </div>

                    <div class="btn mt-3 btn-accent">
                        <button
                            onclick={() => {
                                console.log("TEST");
                                //console.log(modal);
                                //modal?.showModal();
                            }}>Mark as paid</button
                        >
                    </div>
                </div>
            {/each}
        </div>
    </div>
</main>

<Modal
    bind:modal
    title={"Should I create a transaction"}
    yesButton={{ text: "Yes create", callback: () => {} } as ModalButton}
    noButton={{ text: "No forget", callback: () => {} } as ModalButton}
></Modal>
