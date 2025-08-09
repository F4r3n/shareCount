<script lang="ts">
  import { groupsStore } from "@stores/group";
  import type { Group } from "$lib/types";
  import { onMount } from "svelte";
  import { getUTC } from "$lib/UTCDate";
  import { v4 as uuidv4 } from "uuid";
  import GroupViewEditor from "@components/GroupViewEditor.svelte";
  import { fade } from "svelte/transition";

  let group: Group | null = $state(null);
  let new_group = $state(false);
  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const token_id = params.get("id") ?? "";
    const gr = $groupsStore.find((g: Group) => g.token === token_id) ?? null;
    new_group = gr == null;
    group = new_group ? create_new_group() : gr;
  });

  function create_new_group(): Group {
    return {
      token: uuidv4(),
      created_at: getUTC(),
      currency_id: "EUR",
      modified_at: getUTC(),
      name: "New group",
    } as Group;
  }
</script>

<main in:fade class="w-full mx-auto flex flex-col items-center">
  {#if group}
    <div class="flex justify-center w-full">
      <GroupViewEditor creating={new_group} {group} onDone={() => {}} />
    </div>
  {:else}
    <div class="alert alert-error mt-5">Group not found.</div>
  {/if}
</main>

<style>
  main {
    display: flex;
    width: 100%;
    justify-content: center;
  }
</style>
