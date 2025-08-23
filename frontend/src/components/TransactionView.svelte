<script lang="ts">
  import type { Transaction } from "$lib/types";
  import { getCurrencySymbol } from "$lib/currencyFormat";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  let {
    transaction,
  }: {
    transaction: Transaction;
  } = $props();
  let modified_transaction = $state(
    structuredClone($state.snapshot(transaction))
  );

  const currency_symbol = $derived(
    getCurrencySymbol(modified_transaction.currency_id)
  );
</script>

<main>
  <div class="flex justify-between w-full items-center">
    <div class="flex flex-col w-full">
      <button
        class="flex gap-x-2 flex-grow bg-base-200 shadow rounded-md hover:cursor-pointer p-3"
        onclick={() => {
          goto(base + `/transaction?id=${transaction.uuid}`);
        }}
      >
        <div
          class="grid grid-cols-[1fr_auto] grid-rows-2 gap-x-4 items-center w-full"
        >
          <div
            class="col-start-1 row-start-1 truncate text-left text-base md:text-md lg:text-lg text-base-content"
          >
            {modified_transaction.description}
          </div>

          <div
            class="col-start-1 row-start-2 text-left text-sm text-base-content/80"
          >
            Paid by {modified_transaction.paid_by.nickname}
          </div>

          <div
            class="col-start-2 row-start-1 row-span-2 flex flex-col items-center justify-center h-full"
          >
            <div class="flex flex-row">
              <div class="max-w-30 truncate">
                {modified_transaction.amount}
              </div>
              <div>
                {currency_symbol}
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  </div>
</main>

<style>
</style>
