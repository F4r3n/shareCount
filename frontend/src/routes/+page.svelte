<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import type { Group } from "$lib/types";
    import { getGroup } from "$lib/shareCountAPI";
    import {group_name} from "$lib/store"
    let groups = $state([] as Group[]);
    let list_tokens: string[] = ["token_abc123"];
    let is_connected: boolean = false;
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
                } catch (error) {}
            }
        }
    });
</script>

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
