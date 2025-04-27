<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import type { Transaction } from "../../lib/types";
    import TransactionView from "$lib/TransactionView.svelte";
    let current_token = page.url.searchParams.get("id");

    let transactions: Transaction[] = $state([]);

    onMount(async () => {
        fetch(`http://127.0.0.1:4000/transactions/${current_token}`, {
            method: "GET",
            credentials: "include", // include cookies if your backend sets any
            headers: {
                "Content-Type": "application/json", // important for POST/JSON too
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Request failed");
                return res.json(); // or .text() depending on your response
            })
            .then((data) => {
                transactions = data;
            })
            .catch((err) => {
                console.error("Error:", err);
            });
    });
</script>

<main>
    <div class="flex flex-col justify-center">
        {#each transactions as transaction}
            <TransactionView {transaction}></TransactionView>
        {/each}
    </div>
</main>

<style>
    main {
        display: flex;
        width: 100%;
        justify-content: center;
    }
</style>
