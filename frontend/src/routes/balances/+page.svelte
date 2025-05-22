<script lang="ts">
    import { onMount } from "svelte";

    import Balance from "../../components/Balance.svelte";
    import { current_membersStore, groupMembersProxy } from "../../stores/group_members";
    import { current_user } from "../../stores/groupUsernames";
    import { transactionsProxy } from "../../stores/group_transactions";

    let loading = $state(true);
    let current_error: string = $state("");

    onMount(async () => {
        if ($current_user) {
            await groupMembersProxy.local_synchronize($current_user.group_uuid);
            await transactionsProxy.local_synchronize($current_user.group_uuid);
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
    <Balance members={$current_membersStore}></Balance>
{/if}

<style>
</style>
