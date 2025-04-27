<script lang="ts">
    import type {Transaction, Debt} from "$lib/types"
    import {onMount} from "svelte"

    let {transaction} : {transaction : Transaction} = $props();

    onMount(()=> {
    })
</script>

<main>
    <div class="btn w-fit">{transaction.description}</div>

    <div class="flex flex-row">
        {#each transaction.debtors as debt}
        <div>{debt.nickname}</div>
        <div>{debt.amount}</div>
    {/each}
    </div>

</main>


<style>

</style>