<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import type { Group } from "$lib/types";
    import { getGroup } from "$lib/shareCountAPI";
    import {group_name} from "$lib/store"
    let groups = $state([] as Group[]);
    let list_tokens: string[] = ["token_abc123"];
    let is_connected: boolean = false;
    let current_error : string = $state("");
    onMount(async () => {
        let list_tokens_string;
        group_name.set("");

        if (is_connected) {
            //get list groups
        } else {
            list_tokens_string = localStorage.getItem("list_tokens");
            if (list_tokens_string) {
                list_tokens = JSON.parse(list_tokens_string);
            }
            groups = [];
            for (const token of list_tokens) {
                try {
                    groups.push(await getGroup(token));
                } catch (error) {
                    current_error = error as string;
                }
            }
        }
    });
</script>

{#if current_error}
<div role="alert" class="alert alert-error">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>{current_error}</span>
  </div>
{/if}

<main>
    {#each groups as group}
        <button
            type="button"
            class="group btn btn-neutral"
            onclick={() => {
                goto(`/group?id=${group.token}`);
            }}
        >
            <div class="text-2xl font-bold group-title">{group.name}</div>
            <div class="text-sm pt-2 group-date">
                {group.created_at.toLocaleDateString()}
            </div>
        </button>
    {/each}
</main>

<style>
    main {
        display: flex;
        width: 100%;
        justify-content: center;
    }

    .group {
        border-width: 2px;
        border-radius: 10px;
        border-color: var(--color-accent);
        padding: 30px;
    }
</style>
