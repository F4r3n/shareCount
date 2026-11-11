<script lang="ts">
  import type { Transaction } from "$lib/types";
  import TransactionView from "./TransactionView.svelte";
  import { fade } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { PlusIcon, ReceiptIcon } from "lucide-svelte";
  import { localDay } from "$lib/UTCDate";
  let { transactions }: { transactions: Transaction[] } = $props();

  const options = {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  } as Intl.DateTimeFormatOptions;

  /** Transactions grouped by day, most recent day first. */
  const sections = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const byDay = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
      const day = transaction.created_at.split("T")[0];
      const items = byDay.get(day);
      if (items) items.push(transaction);
      else byDay.set(day, [transaction]);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => localDay(b).getTime() - localDay(a).getTime())
      .map(([day, items]) => ({
        day,
        label: localDay(day).toLocaleDateString(undefined, options),
        items,
      }));
  });
</script>

<div transition:fade class="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">
  {#if transactions.length === 0}
    <div
      class="flex flex-col items-center text-center gap-2 py-16 px-6 bg-base-100 border border-base-300 rounded-box"
    >
      <ReceiptIcon size={36} class="text-base-content/40" />
      <p class="font-medium">No expenses yet</p>
      <p class="text-sm text-base-content/60">
        Add the first expense and ShareCount will keep track of who owes what.
      </p>
    </div>
  {:else}
    <div class="flex flex-col gap-5">
      {#each sections as section (section.day)}
        <section>
          <h2
            class="px-1 mb-2 text-xs font-medium uppercase tracking-wide text-base-content/55"
          >
            {section.label}
          </h2>
          <ul
            class="bg-base-100 border border-base-300 rounded-box divide-y divide-base-300 overflow-hidden"
          >
            {#each section.items as transaction (transaction.uuid)}
              <li>
                <TransactionView {transaction}></TransactionView>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</div>

<div
  class="fixed inset-x-0 bottom-0 z-10 flex justify-center pointer-events-none pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
>
  <button
    class="btn btn-primary btn-lg rounded-full shadow-lg px-6 pointer-events-auto"
    onclick={() => {
      goto(resolve("/transaction?id="));
    }}
  >
    <PlusIcon size={20} /> Add expense
  </button>
</div>
