<script lang="ts">
  import type { Transaction, GroupMember } from "$lib/types";
  import TransactionView from "./TransactionView.svelte";
  import { onMount } from "svelte";
  import { group_transactions } from "@stores/group_transactions";
  import { current_groupStore } from "@stores/group";
  import { fade } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  let {
    members,
  }: {
    members: GroupMember[];
  } = $props();

  let transactions: Transaction[] = $derived(
    $current_groupStore ? $group_transactions[$current_groupStore.token] : []
  );

  onMount(async () => {
    if ($current_groupStore) {
      transactions = $group_transactions[$current_groupStore.token];
    }
  });

  const options = {
    weekday: undefined,
    year: "numeric",
    month: "long",
    day: "numeric",
  } as Intl.DateTimeFormatOptions;
</script>

<!-- Offset with menu-->
<div class="transactions-container">
  <div transition:fade class="transactions">
    <div class="flex flex-col w-full md:w-8/12 mx-1">
      {#each transactions as transaction, id (transaction.uuid)}
        <div class="font-semibold text-base md:text-md lg:text-lg">
          {#if id > 0}
            {#if new Date(transaction.created_at.split("T")[0]).getDate() != new Date(transactions[id - 1].created_at.split("T")[0]).getDate()}
              <div class="my-2">
                {new Date(
                  transaction.created_at.split("T")[0]
                ).toLocaleDateString(undefined, options)}
              </div>
            {/if}
          {:else}
            {new Date(transaction.created_at.split("T")[0]).toLocaleDateString(
              undefined,
              options
            )}
          {/if}
        </div>
        <div>
          <TransactionView {transaction} {members}></TransactionView>
        </div>
      {/each}
    </div>
  </div>
</div>
<button
  class="btn btn-accent md:w-1/3 add-button"
  onclick={async () => {
    goto(base + `/transaction?id=`);
  }}
>
  Add transaction
</button>

<style>
  .transactions-container {
    height: calc(100svh - 150px); /* visible height minus menu */
    overflow-y: auto;
    /* Mask fade for top and bottom edges */
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      black 2%,
      black 90%,
      transparent 100%
    );
    mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      black 2%,
      black 90%,
      transparent 100%
    );

    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .transactions {
    display: flex;
    width: 100%;
    justify-content: center;
    overflow-y: auto;
  }

  .add-button {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(1.5rem + env(safe-area-inset-bottom)); /* safe on iOS */
    z-index: 20;
    pointer-events: auto;
  }
</style>
