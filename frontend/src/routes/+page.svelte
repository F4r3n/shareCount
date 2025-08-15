<script lang="ts">
  import { onMount } from "svelte";
  import GroupView from "@components/GroupView.svelte";
  import { current_groupStore, groupsProxy, groupsStore } from "@stores/group";
  import type { Group } from "$lib/types";
  import { goto } from "$app/navigation";
  import { store_url } from "$lib/shareCountAPI";
  import { base } from "$app/paths";
  let current_error: string = $state("");
  onMount(async () => {
    current_groupStore.set(null);
    const params = new URLSearchParams(window.location.search);
    const token_id = params.get("id") ?? "";
    const url = params.get("url") ?? null;
    if (url) {
      store_url(url);
    }
    groupsProxy.synchronize();
    await groupsProxy.synchronize_local();

    if ($groupsStore.length > 0) {
      if (
        !$groupsStore.some((gr: Group) => {
          return gr.token == token_id;
        })
      ) {
        if (token_id !== "") {
          groupsProxy.add_group_from_id(token_id);
        }
      }
    } else {
      if (token_id !== "") {
        groupsProxy.add_group_from_id(token_id);
      }
    }
  });

  let sortedGroup = $derived(
    $groupsStore.toSorted((a: Group, b: Group) => {
      return b.created_at.localeCompare(a.created_at);
    })
  );
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
    {#each sortedGroup as group (group.token)}
      <div class="mb-5">
        <GroupView {group} onDone={() => {}}></GroupView>
      </div>
    {/each}
  </div>
  <button
    onclick={() => {
      goto(base + `/group`);
    }}
    class="btn btn-primary add-group-bottom">Add Group</button
  >
</main>

<style>
  main {
    display: flex;
    width: 100%;
    justify-content: center;
  }

  .add-group-bottom {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    width: 66vw;
    max-width: 400px;
    margin-bottom: 1rem;
  }
</style>
