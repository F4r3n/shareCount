<script lang="ts">
    import { onMount } from "svelte";
    import type { Transaction, Group, GroupMember } from "$lib/types";

    import {
        getGroup,
        getGroupMembers,
        getTransactions,
    } from "$lib/shareCountAPI";
    import { group_name } from "$lib/store";
    import Balance from "../../components/Balance.svelte";

    let current_token = $state("");

    let transactions: Transaction[] = $state([]);
    let loading = $state(true);
    let group_info: Group | null = $state(null);
    let current_error: string = $state("");
    let group_members: GroupMember[] = $state([]);

    onMount(async () => {
        current_token =
            new URLSearchParams(window.location.search).get("id") ?? "";
        if (current_token) {
            try {
                group_info = await getGroup(current_token);
                transactions = await getTransactions(current_token);
                group_members = await getGroupMembers(current_token);

                if (group_info) {
                    group_name.set(group_info.name);
                }
            } catch (error) {
                current_error = error as string;
            }
        }
        loading = false;
    });
</script>

{#if current_error}
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
        <span>{current_error}</span>
    </div>
{/if}
{#if !loading}
    <Balance {transactions} members={group_members}></Balance>
{/if}

<style>
</style>
