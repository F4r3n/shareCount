<script lang="ts">
    import { onMount } from "svelte";
    import type { GroupMember } from "$lib/types";
    import TransactionsView from "$lib/../components/TransactionsView.svelte";
    import { current_groupStore } from "../../stores/group";
    import { current_user } from "../../stores/groupUsernames";
    import { groupMembersProxy } from "../../stores/group_members";

    let loading = $state(true);
    let current_error: string = $state("");
    let group_members: GroupMember[] = $state([]);

    onMount(async () => {
        if ($current_user?.group_uuid) {
            group_members = await groupMembersProxy.local_synchronize($current_user.group_uuid);
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

{#if loading}
    <div class="flex justify-center items-center h-full">
        <div class="flex w-full flex-col gap-4">
            <div class="skeleton h-32 w-full"></div>
            <div class="skeleton h-4 w-28"></div>
            <div class="skeleton h-64 w-full"></div>
            <div class="skeleton h-32 w-full"></div>
        </div>
    </div>
{:else}
    <TransactionsView
        main_currency={$current_groupStore?.currency_id}
        members={group_members}
    ></TransactionsView>
{/if}

<style>
</style>
