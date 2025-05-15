<script lang="ts">
    import type { GroupMember, Transaction } from "$lib/types";
    import { onMount } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import Big from "big.js";

    let {
        members,
        transactions,
    }: { members: GroupMember[]; transactions: Transaction[] } = $props();
    interface Balance {
        member: GroupMember;
        amount: Big;
    }
    let balances: SvelteMap<string, Balance> = new SvelteMap();
    onMount(() => {
        console.log(transactions);
        for (let member of members) {
            balances.set(member.nickname, {
                member: member,
                amount: Big("0"),
            });
        }

        for (let transaction of transactions) {
            let current_balance = balances.get(
                transaction.paid_by.nickname,
            )?.amount;

            if (current_balance != undefined) {
                current_balance = current_balance.add(Big(transaction.amount));
                console.log(current_balance);

                balances.set(transaction.paid_by.nickname, {
                    member: transaction.paid_by,
                    amount: current_balance,
                });
            }

            for (let debt of transaction.debtors) {
                let current_balance = balances.get(
                    debt.member.nickname,
                )?.amount;
                if (current_balance != undefined) {
                    let balance = Big(current_balance);
                    let debt_amount = Big(debt.amount);

                    balance = balance.minus(debt_amount);

                    balances.set(debt.member.nickname, {
                        member: transaction.paid_by,
                        amount: balance,
                    });
                }
            }
        }
        console.log(balances);
    });
</script>

<main>
    <div class="w-2/3 mx-auto">
        {#each balances as [nickname, balance]}
            <div class="bg-base-100 rounded-md flex flex-row justify-between m-1 p-2">
                <div class="pl-2">{nickname}</div>
                <div>{balance.amount.toFixed(2)}</div>
            </div>
        {/each}
    </div>
</main>
