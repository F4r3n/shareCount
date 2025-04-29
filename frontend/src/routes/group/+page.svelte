<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import type { Transaction, Group } from "../../lib/types";
    import TransactionView from "$lib/TransactionView.svelte";
    import { getGroup, getTransactions } from "$lib/shareCountAPI";
    let current_token = page.url.searchParams.get("id");

    let sub_menus: String[] = ["Transactions", "Statistics"];
    let index_menu = $state(0);

    let transactions: Transaction[] = $state([]);
    let group_info: Group | null = $state(null);
    onMount(async () => {
        if (current_token) {
            try {
                group_info = await getGroup(current_token);
                transactions = await getTransactions(current_token);
            } catch (error) {}
        }
    });

    let menus;
</script>

<div class="drawer">
    <input id="my-drawer-3" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content flex flex-col">
        <!-- Navbar -->
        <div class="navbar bg-base-300 w-full banner">
            <div class="flex-none lg:hidden">
                <label
                    for="my-drawer-3"
                    aria-label="open sidebar"
                    class="btn btn-square btn-ghost"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        class="inline-block h-6 w-6 stroke-current"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 6h16M4 12h16M4 18h16"
                        ></path>
                    </svg>
                </label>
            </div>
            <div class="mx-2 flex-1 px-2">{group_info?.name}</div>
            <div class="hidden flex-none lg:block">
                <ul class="menu menu-horizontal">
                    {#each sub_menus as sub, index}
                        <li>
                            <button
                                class="cursor-pointer"
                                onclick={() => {
                                    index_menu = index;
                                }}
                            >
                                {sub}
                            </button>
                        </li>
                    {/each}
                </ul>
            </div>
        </div>
        <div class="transactions">
            <div class="flex flex-col justify-center w-full md:w-8/12">
                {#if index_menu == 0}
                    {#each transactions as transaction}
                        <TransactionView {transaction}></TransactionView>
                    {/each}
                {/if}
            </div>
        </div>
    </div>
    <div class="drawer-side">
        <label
            for="my-drawer-3"
            aria-label="close sidebar"
            class="drawer-overlay"
        ></label>
        <ul class="menu bg-base-200 min-h-full w-80 p-4">
            <!-- Sidebar content here -->
            {#each sub_menus as sub, index}
                <li>
                    <button
                        class="cursor-pointer"
                        onclick={() => {
                            index_menu = index;
                        }}
                    >
                        {sub}
                    </button>
                </li>
            {/each}
        </ul>
    </div>
</div>

<style>
    .transactions {
        display: flex;
        width: 100%;
        justify-content: center;
    }

    .banner {
        background-color: var(--color-primary);
        color: var(--color-primary-content);
    }
</style>
