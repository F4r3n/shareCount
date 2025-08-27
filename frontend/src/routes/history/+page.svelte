<script lang="ts">
  import { current_user } from "@stores/groupUsernames";
  import { historyProxy } from "@stores/history";
  import TransactionHistory from "@components/TransactionHistory.svelte";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
</script>

<main class="centered-editor-card w-full md:w-md max-w-full md:max-w-md">
  {#if $current_user && $current_user.group_uuid}
    {#await historyProxy.get_remote_transactions_history($current_user.group_uuid) then histories}
      {#if histories.length === 0}
        <div class="p-4 text-center text-gray-500">No history available</div>
      {:else}
        <ul class="space-y-3">
          {#each histories as history}
            <li class="card bg-base-100 shadow-md border border-base-200">
              <TransactionHistory {history}></TransactionHistory>
            </li>
          {/each}
        </ul>
      {/if}
    {/await}
  {/if}
</main>

<style>
  .centered-editor-card {
    margin: 0 auto;
    max-width: 100vw;
    display: block;
  }
</style>
