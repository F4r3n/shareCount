<script lang="ts">
  import type { Transaction, Debt, GroupMember } from "$lib/types";
  import { onMount, untrack } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import Big from "big.js";
  import { getUTC } from "$lib/UTCDate";
  import InputNumber from "./InputNumber.svelte";
  import { getLengthOfFraction } from "$lib/currencyFormat";
  import CurrencySelector from "./CurrencySelector.svelte";
  import { splitAmount } from "$lib/split";
  import { CircleAlertIcon, Trash2Icon } from "lucide-svelte";

  let {
    transaction,
    group_currency = transaction.currency_id,
    members,
    is_creating,
    onSave,
    onDelete,
    onCancel,
  }: {
    transaction: Transaction;
    group_currency?: string;
    members: GroupMember[];
    is_creating: boolean;
    onSave: (tx: Transaction) => void;
    onDelete?: (tx: Transaction) => void;
    onCancel: (tx: Transaction) => void;
  } = $props();

  let modified_transaction = $state(
    untrack(() => structuredClone($state.snapshot(transaction)))
  );

  class DebtContainer {
    activated: boolean = $state(false);
    debt = $state({
      member: { uuid: "", nickname: "" } as GroupMember,
      amount: "0",
    } as Debt);
    constructor(debt: Debt, activated: boolean) {
      this.debt = debt;
      this.activated = activated;
      if (!this.activated) this.activated = parseFloat(this.debt.amount) >= 0;
    }

    setDebt(inDebt: Debt) {
      this.debt = inDebt;
    }
  }
  let mapDebt: SvelteMap<string, DebtContainer> = new SvelteMap();
  let modal: HTMLDialogElement | null = null;
  let date_value = $derived(modified_transaction.created_at.split("T")[0]);

  function updateDebtors(newAmount: string) {
    //TODO convert with big number
    let amount = new Big(newAmount);
    let number_people = 0;

    // First pass: count activated people
    for (const [, debtContainer] of mapDebt) {
      number_people += debtContainer.activated ? 1 : 0;
    }

    if (number_people === 0) {
      // Handle case with no activated people
      return;
    }

    // Keep the decimals; the last person absorbs the remainder
    const shares = splitAmount(amount, number_people);

    let activatedCount = 0;
    for (const [, debtContainer] of mapDebt) {
      if (debtContainer.activated) {
        debtContainer.debt.amount = shares[activatedCount++].toString();
      } else {
        debtContainer.debt.amount = "0";
      }
    }
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const set_current_debtors: Set<string> = new Set();

    for (let i = 0; i < modified_transaction.debtors.length; ++i) {
      const updatedDebt = mapDebt.get(
        modified_transaction.debtors[i].member.nickname
      );
      if (updatedDebt) {
        modified_transaction.debtors[i] = updatedDebt.debt;
      }
      set_current_debtors.add(modified_transaction.debtors[i].member.nickname);
    }

    for (const [, debtContainer] of mapDebt) {
      if (debtContainer.activated) {
        if (!set_current_debtors.has(debtContainer.debt.member.nickname)) {
          modified_transaction.debtors.push(debtContainer.debt);
        }
      }
    }
    modified_transaction.modified_at = getUTC();
  }

  onMount(() => {
    for (const member of members) {
      mapDebt.set(
        member.nickname,
        new DebtContainer({ member: member, amount: "0" } as Debt, false)
      );
    }

    for (const debt of modified_transaction.debtors) {
      mapDebt.set(debt.member.nickname, new DebtContainer(debt, true));
    }
  });

  function handleDelete() {
    if (onDelete) {
      onDelete($state.snapshot(modified_transaction));
    }
    modal?.close();
  }

  interface Error {
    code?: number;
    message: string;
  }
  function validate(transaction: Transaction): Error | null {
    if (transaction.description === "")
      return {
        code: 2,
        message: "Error: The transaction must have a description",
      };
    const total_sum_to_reach = new Big(transaction.amount);
    if (total_sum_to_reach <= new Big("0")) {
      return {
        code: 3,
        message: "Error: The transaction must must be positive",
      };
    }
    let current_sum = new Big("0");
    for (const member of transaction.debtors) {
      current_sum = current_sum.add(new Big(member.amount));
    }
    let isOK = current_sum.eq(total_sum_to_reach);
    if (!isOK) {
      return {
        code: 1,
        message: "Error: The transaction is not equal to the debts",
      };
    }
    return null;
  }

  async function getExchangeRate(
    from: string,
    to: string,
    date: Date
  ): Promise<number> {
    const dateString = date.toISOString().split("T")[0];
    try {
      const result = await fetch(
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateString}/v1/currencies/${from.toLocaleLowerCase()}.json`
      );
      const data = await result.json();
      const exchange_rate = data[from.toLowerCase()][to.toLowerCase()];
      return exchange_rate;
    } catch {
      return 1;
    }
  }
  let error: Error | null = $state(null);

  const currency_fixed = $derived(
    getLengthOfFraction(modified_transaction.currency_id)
  );

  function handleSubmit(event: Event) {
    event.preventDefault();
    error = validate(modified_transaction);
    if (error == null) {
      transaction = modified_transaction;
      onSave(modified_transaction);
    }
  }

  function reset() {
    modified_transaction = structuredClone($state.snapshot(transaction));
    onCancel(transaction);
  }
</script>

<form
  onsubmit={handleSubmit}
  class="mx-auto w-full max-w-2xl px-4 pt-4 pb-32 flex flex-col gap-4"
>
  <h1 class="px-1 text-2xl font-semibold tracking-tight">
    {is_creating ? "New expense" : "Edit expense"}
  </h1>

  <section
    class="bg-base-100 border border-base-300 rounded-box p-4 flex flex-col gap-4"
  >
    <label class="flex flex-col gap-1.5">
      <span class="text-sm font-medium text-base-content/70">Title</span>
      <input
        type="text"
        placeholder="Hotel, groceries, dinner…"
        maxlength="250"
        class="input w-full"
        bind:value={modified_transaction.description}
        onchange={() => {
          modified_transaction.modified_at = getUTC();
        }}
      />
    </label>

    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-medium text-base-content/70">Amount</span>
      <div class="join w-full">
        <InputNumber
          title="Transaction amount"
          is_editing={true}
          bind:value={modified_transaction.amount}
          number_decimal={currency_fixed}
          class="join-item flex-1 text-lg font-semibold tabular-nums"
          onChange={(value: string, valid: boolean) => {
            if (valid) updateDebtors(value);
          }}
        ></InputNumber>
        <CurrencySelector
          class="join-item w-32"
          bind:current_currency={modified_transaction.currency_id}
          onChange={(newCurrency) => {
            if (newCurrency != group_currency) {
              getExchangeRate(
                newCurrency,
                group_currency,
                new Date(modified_transaction.created_at)
              ).then((value: number) => {
                modified_transaction.exchange_rate = value.toString();
              });
            } else {
              modified_transaction.exchange_rate = "1";
            }
          }}
        ></CurrencySelector>
      </div>
    </div>

    {#if modified_transaction.currency_id != group_currency}
      <div class="flex flex-col gap-1.5">
        <span class="text-sm font-medium text-base-content/70">
          Exchange rate
          <span class="font-normal text-base-content/50">
            (1 {modified_transaction.currency_id} = ? {group_currency})
          </span>
        </span>
        <InputNumber
          is_editing={true}
          bind:value={modified_transaction.exchange_rate}
          title="Exchange rate"
          class="w-full"
        ></InputNumber>
      </div>
    {/if}

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1.5 min-w-0">
        <span class="text-sm font-medium text-base-content/70">Paid by</span>
        <select class="select w-full" bind:value={modified_transaction.paid_by}>
          <option disabled selected value={modified_transaction.paid_by}>
            {modified_transaction.paid_by.nickname}
          </option>
          {#each members as member (member.uuid)}
            <option value={member}>
              {member.nickname}
            </option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-1.5 min-w-0">
        <span class="text-sm font-medium text-base-content/70">When</span>
        <input
          type="date"
          class="input w-full"
          aria-label="Transaction date"
          bind:value={date_value}
          onchange={() => {
            // Keep the picked day, with the current (zero-padded) UTC time.
            const time = getUTC().split("T")[1];
            modified_transaction.created_at = `${date_value}T${time}`;
          }}
        />
      </label>
    </div>
  </section>

  <section class="bg-base-100 border border-base-300 rounded-box">
    <div class="flex items-baseline justify-between px-4 pt-4 pb-2">
      <h2 class="font-semibold">Split between</h2>
      <span class="text-sm text-base-content/55">
        {[...mapDebt.values()].filter((d) => d.activated).length} of {mapDebt.size}
      </span>
    </div>
    <ul class="divide-y divide-base-300">
      {#each mapDebt as [nickname, debtContainer] (nickname)}
        <li class="flex items-center gap-3 px-4 py-2.5">
          <label class="flex flex-1 min-w-0 items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              class="checkbox checkbox-primary checkbox-sm"
              bind:checked={debtContainer.activated}
              onchange={() => {
                updateDebtors(modified_transaction.amount);
              }}
            />
            <span
              class="truncate {debtContainer.activated
                ? ''
                : 'text-base-content/45'}">{nickname}</span
            >
          </label>
          <InputNumber
            title="Debtor amount"
            is_editing={true}
            bind:value={debtContainer.debt.amount}
            class="input-sm w-28 text-right tabular-nums"
          ></InputNumber>
        </li>
      {/each}
    </ul>
  </section>

  {#if error}
    <div role="alert" class="alert alert-error alert-soft">
      <CircleAlertIcon size={20} />
      <span>{error.message}</span>
    </div>
  {/if}

  <div
    class="fixed inset-x-0 bottom-0 z-10 bg-base-100/90 backdrop-blur border-t border-base-300 pb-[env(safe-area-inset-bottom)]"
  >
    <div class="mx-auto max-w-2xl px-4 py-3 flex items-center gap-2">
      {#if is_creating}
        <button type="button" class="btn btn-ghost" onclick={reset}>
          Cancel
        </button>
      {:else}
        <button
          type="button"
          class="btn btn-ghost text-error"
          onclick={() => {
            modal?.showModal();
          }}
        >
          <Trash2Icon size={18} /> Delete
        </button>
        <button type="button" class="btn btn-ghost" onclick={reset}>
          Reset
        </button>
      {/if}
      <button type="submit" class="btn btn-primary ml-auto px-8">Save</button>
    </div>
  </div>
</form>

<dialog
  class="modal modal-bottom sm:modal-middle"
  bind:this={modal}
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div class="modal-box">
    <h3 id="modal-title" class="text-lg font-semibold">Delete this expense?</h3>
    <p class="py-2 text-sm text-base-content/70">
      “{modified_transaction.description}” will be removed for everyone in the
      group.
    </p>
    <div class="modal-action">
      <form method="dialog">
        <button class="btn btn-ghost" type="submit">Cancel</button>
      </form>
      <button class="btn btn-error" type="button" onclick={handleDelete}>
        Delete
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label="Close">close</button>
  </form>
</dialog>
