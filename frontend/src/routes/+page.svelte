<script lang="ts">
    import { onMount } from "svelte";
    import GroupView from "../components/GroupView.svelte";
    import { groupsProxy, groupStore } from "../stores/group";

    let current_error: string = $state("");
    
    onMount(async () => {
        const params = new URLSearchParams(window.location.search);
		const token_id = params.get("id") ?? "";
        await groupsProxy.synchronize();
        if(!$groupStore.some((gr)=>{
            return gr.token == token_id;
        }))
        {
            groupsProxy.add_local_group(await groupsProxy.getGroup(token_id));
        }
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

    <div class="mt-4">
    {#each $groupStore as group}
       <GroupView {group}></GroupView>
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
