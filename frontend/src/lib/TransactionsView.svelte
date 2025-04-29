<script lang="ts">
    import { onMount } from "svelte";
    import type { Transaction } from "$lib/types";
    import TransactionView from "$lib/TransactionView.svelte";

    let { transactions }: { transactions: Transaction[] } = $props();
    onMount(async () => {});
    let creating : boolean = $state(false);
</script>

<div class="flex flex-col h-dvh">
    <div class="transactions">
        <div class="flex flex-col w-full md:w-8/12">
            {#each transactions as transaction}
                <TransactionView {transaction}></TransactionView>
            {/each}
        </div>
    </div>

    {#if creating}
    <div class="card bg-base-100 w-full max-w-sm shrink-0 shadow-2xl">
        <div class="card-body">
          <fieldset class="fieldset">
            <label class="label">Email</label>
            <input type="email" class="input" placeholder="Email" />
            <label class="label">Password</label>
            <input type="password" class="input" placeholder="Password" />
            <div><a class="link link-hover">Forgot password?</a></div>
            <button class="btn btn-neutral mt-4">Save</button>
            <button class="btn btn-neutral mt-4" onclick={()=>{creating=false;}}>Close</button>
          </fieldset>
        </div>
      </div>
    {/if}
    <button class="btn btn-accent md:w-1/3 mx-auto add-button" onclick={()=>{creating=true;}}>
        Add transaction
    </button>

</div>

<style>
    .transactions {
        display: flex;
        width: 100%;
        justify-content: center;
        overflow-y: auto;
        flex-grow: 1;
    }

    .add-button {
        position: sticky;
        bottom: 0;
        z-index: 10;
    }
</style>
