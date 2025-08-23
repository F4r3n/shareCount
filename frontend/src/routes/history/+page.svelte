<script lang="ts">
  import TransactionView from "@components/TransactionView.svelte"; // can be used inside cards
  import { current_user } from "@stores/groupUsernames";
  import { historyProxy } from "@stores/history";
  import type { TransactionHistory } from "$lib/types";

  function formatDate(date: string) {
    return new Date(date).toLocaleString();
  }
</script>

<main class="centered-editor-card w-full md:w-md max-w-full md:max-w-md">
  {#if $current_user && $current_user.group_uuid}
    {#await historyProxy.get_remote_transactions_history($current_user.group_uuid) then histories}
      {#if histories.length === 0}
        <div class="p-4 text-center text-gray-500">No history available</div>
      {:else}
        <ul
          class="timeline timeline-vertical timeline-snap-icon max-w-2xl mx-auto"
        >
          {#each histories as h, i}
            <li>
              <hr class="bg-gray-300" />
              <div class="timeline-middle">
                {#if h.operation === "CREATE"}
                  <div class="badge badge-success">+</div>
                {:else if h.operation === "UPDATE"}
                  <div class="badge badge-warning">✎</div>
                {:else if h.operation === "DELETE"}
                  <div class="badge badge-error">✕</div>
                {:else}
                  <div class="badge">?</div>
                {/if}
              </div>

              <div
                class={`timeline-end mb-10 ${i % 2 === 0 ? "text-start" : "text-end"}`}
              >
                <div class="card shadow-md bg-base-200">
                  <div class="card-body p-4">
                    <h3 class="font-bold">{h.description}</h3>
                    <p class="text-sm opacity-70">
                      {h.operation} by {h.paid_by.nickname} • {formatDate(
                        h.modified_at
                      )}
                    </p>
                    <p>
                      Amount: {h.amount}
                      {h.currency_id}
                    </p>
                    {#if h.debtors?.length > 0}
                      <p class="text-sm">
                        Shared with: {h.debtors
                          .map((d) => d.member.nickname)
                          .join(", ")}
                      </p>
                    {/if}
                  </div>
                </div>
              </div>
              <hr class="bg-gray-300" />
            </li>
          {/each}
        </ul>
      {/if}
    {:catch error}
      <div class="alert alert-error">{error.message}</div>
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
