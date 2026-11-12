<script lang="ts">
  import type { Transaction } from "#lib/types";
  import { formatMoney } from "#lib/currencyFormat";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  let { transaction }: { transaction: Transaction } = $props();

  const shared_with = $derived(
    transaction.debtors.filter((debt) => Number(debt.amount) > 0).length
  );
</script>

<button
  class="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors hover:bg-base-200 focus:outline-none focus-visible:bg-base-200"
  onclick={() => {
    goto(resolve(`/transaction?id=${transaction.uuid}`));
  }}
>
  <div class="min-w-0 flex-1">
    <div class="font-medium truncate">{transaction.description}</div>
    <div class="text-sm text-base-content/60 truncate">
      Paid by {transaction.paid_by.nickname}
      {#if shared_with > 0}
        · split {shared_with} {shared_with > 1 ? "ways" : "way"}
      {/if}
    </div>
  </div>
  <div class="font-semibold tabular-nums whitespace-nowrap">
    {formatMoney(transaction.amount, transaction.currency_id)}
  </div>
</button>
