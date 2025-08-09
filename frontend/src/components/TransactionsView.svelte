<script lang="ts">
  import type { Transaction, GroupMember } from "$lib/types";
  import TransactionView from "./TransactionView.svelte";
  import { onMount } from "svelte";
  import { group_transactions } from "@stores/group_transactions";
  import { current_groupStore } from "@stores/group";
  import { fade } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { base } from "$service-worker";
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
<div class="flex flex-col h-[calc(100dvh-70px)]">
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
  <button
    class="btn btn-accent w-2/3 md:w-1/3 add-button"
    onclick={async () => {
      goto(base + `/transaction?id=`);
    }}
  >
    Add transaction
  </button>
</div>

<style>
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
    bottom: 0;
    z-index: 20;
    margin-bottom: 1.5rem;
    width: 66vw;
    max-width: 400px;
  }
</style>
