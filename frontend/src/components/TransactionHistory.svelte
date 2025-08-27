<script lang="ts">
  import type { TransactionHistory } from "$lib/types";
  import { getCurrencySymbol } from "$lib/currencyFormat";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";

  let {
    history,
  }: {
    history: TransactionHistory;
  } = $props();

  const currency_symbol = getCurrencySymbol(history.currency_id);
</script>

<div class="card-body p-4">
  <button
    type="button"
    class="[all:unset] hover:cursor-pointer"
    onclick={() => {
      goto(base + `/transaction?id=${history.uuid}`);
    }}
  >
    <div class="flex justify-between items-center">
      <h2 class="card-title text-lg font-semibold">
        {history.description}
      </h2>
      <span class="badge badge-outline">
        {history.amount}
        {getCurrencySymbol(history.currency_id)}
      </span>
    </div>

    <p class="text-sm text-gray-500">
      Paid by <span class="font-medium">{history.paid_by.nickname}</span>
    </p>

    <p class="text-xs text-gray-400">
      {new Date(history.created_at).toLocaleString()}
    </p>

    {#if history.modified_by}
      <p class="text-xs text-warning">
        {history.operation} by {history.modified_by.nickname} at
        {new Date(history.modified_at).toLocaleString()}
      </p>
    {/if}
  </button>
</div>
