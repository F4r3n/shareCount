<script lang="ts">
    import { onMount } from "svelte";
    import GroupView from "../components/GroupView.svelte";
    import {
        current_groupStore,
        groupsProxy,
        groupsStore,
    } from "../stores/group";
    import type { Group } from "$lib/types";
    import { getUTC } from "$lib/UTCDate";
    import { v4 as uuidv4 } from "uuid";
    import { store_url } from "$lib/shareCountAPI";

    let current_error: string = $state("");

    onMount(async () => {
        current_groupStore.set(null);
        const params = new URLSearchParams(window.location.search);
        const token_id = params.get("id") ?? "";
        const url = params.get("url") ?? null;
        if(url) {
            store_url(url)
        }
        await groupsProxy.synchronize();
        if (
            !$groupsStore.some((gr: Group) => {
                return gr.token == token_id;
            })
        ) {
            if (token_id !== "") {
                groupsProxy.add_group_from_id(token_id);
            }
        }
    });
    let create = $state(false);
    let new_group: Group = $state({
        token: uuidv4(),
        created_at: getUTC(),
        currency_id: "EUR",
        modified_at: getUTC(),
        name: "New Group",
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

<main class="w-full mx-auto flex flex-col items-center">
    <button
        disabled={create}
        onclick={() => {
            create = true;
        }}
        class="btn btn-accent mt-5">Add Group</button
    >
    {#if create}
    <div class="mt-4">
        <GroupView creating={true} group={new_group}  onDone={()=>{create = false}}></GroupView>
    </div>
    {/if}
    <div class="mt-4">
        {#each $groupsStore as group}
            <GroupView creating={false} {group} onDone={()=>{}}></GroupView>
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
