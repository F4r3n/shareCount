<script lang="ts">
  import { onMount } from "svelte";
  import GroupView from "#components/GroupView.svelte";
  import { current_groupStore, groupsProxy, groupsStore } from "#stores/group";
  import type { Group } from "#lib/types";
  import { goto } from "$app/navigation";
  import { store_url } from "#lib/shareCountAPI";
  import { resolve } from "$app/paths";
  import { PlusIcon, UsersIcon } from "@lucide/svelte";
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
      return b.modified_at.localeCompare(a.modified_at);
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

<main class="mx-auto w-full max-w-2xl px-4 pt-5 pb-28">
  <h1 class="mb-3 px-1 text-2xl font-semibold tracking-tight">Your groups</h1>

  {#if sortedGroup.length === 0}
    <div
      class="flex flex-col items-center text-center gap-2 py-16 px-6 bg-base-100 border border-base-300 rounded-box"
    >
      <UsersIcon size={36} class="text-base-content/40" />
      <p class="font-medium">No groups yet</p>
      <p class="text-sm text-base-content/60">
        Create a group for your next trip, flat or dinner and start sharing
        expenses.
      </p>
    </div>
  {:else}
    <div class="flex flex-col gap-3">
      {#each sortedGroup as group (group.token)}
        <GroupView {group} onDone={() => {}}></GroupView>
      {/each}
    </div>
  {/if}
</main>

<div
  class="fixed inset-x-0 bottom-0 z-10 flex justify-center pointer-events-none pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
>
  <button
    onclick={() => {
      goto(resolve("/group"));
    }}
    class="btn btn-primary btn-lg rounded-full shadow-lg px-6 pointer-events-auto"
  >
    <PlusIcon size={20} /> New group
  </button>
</div>
