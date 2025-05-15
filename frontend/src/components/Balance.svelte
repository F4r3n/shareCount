<script lang="ts">
    import type { GroupMember, Transaction } from "$lib/types";
    import { onMount } from "svelte";
    import init, {
        compute_balance,
        compute_settlements,
        type Amount,
        type Settlement,
    } from "wasm-lib";

    let {
        members,
        transactions,
    }: { members: GroupMember[]; transactions: Transaction[] } = $props();

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

<main>
    <div class="w-2/3 mx-auto">
        {#each balances as balance}
            <div
                class="bg-base-100 rounded-md flex flex-row justify-between m-1 p-2"
            >
                <div class="pl-2">{balance.member.nickname}</div>
                <div>{balance.amount}</div>
            </div>
        {/each}
    </div>

    <div class="w-2/3 mx-auto">
        {#each settlements as settlement}
            <div
                class="bg-base-100 rounded-md flex flex-row justify-between m-1 p-2"
            >
                <div class="pl-2">{settlement.member_to.nickname}</div>
                <div class="pl-2">{settlement.member_from.nickname}</div>

                <div>{settlement.amount}</div>
            </div>
        {/each}
    </div>
</main>
