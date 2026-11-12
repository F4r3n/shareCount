<script lang="ts">
  import { onMount } from "svelte";
  import type { Transaction } from "#lib/types";
  import TransactionsView from "#components/TransactionsView.svelte";
  import { current_user } from "#stores/groupUsernames";
  import { groupMembersProxy } from "#stores/group_members";
  import { transactionsProxy } from "#stores/group_transactions";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { MENU, menus } from "#lib/menus";
  import { fade } from "svelte/transition";

  let loading = $state(true);
  let current_error: string = $state("");
  let transactions: Transaction[] = $state([]);

  onMount(async () => {
    if ($current_user?.group_uuid) {
      const group_uuid = $current_user.group_uuid;
      transactions = await transactionsProxy.synchronize_local(group_uuid);
      // Members first: the server rejects transactions referencing unknown members.
      groupMembersProxy
        .synchronize(group_uuid)
        .then(() => transactionsProxy.synchronize(group_uuid))
        .then((trs) => {
          transactions = trs;
        });
    } else {
      goto(resolve(menus[MENU.GROUPS].path));
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

<div in:fade>
  {#if loading}
    <div class="mx-auto w-full max-w-2xl px-4 pt-4 flex flex-col gap-3">
      <div class="skeleton h-3 w-32"></div>
      <div class="skeleton h-40 w-full rounded-box"></div>
      <div class="skeleton h-3 w-28"></div>
      <div class="skeleton h-24 w-full rounded-box"></div>
    </div>
  {:else}
    <TransactionsView {transactions}></TransactionsView>
  {/if}
</div>

<style>
</style>
