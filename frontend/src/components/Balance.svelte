<script lang="ts">
  import type { Debt, GroupMember, Transaction } from "#lib/types";
  import Modal from "./Modal.svelte";
  import { type ModalButton } from "./ModalTypes";
  import { transactionsProxy } from "#stores/group_transactions";
  import { getUTC } from "#lib/UTCDate";
  import { current_groupStore } from "#stores/group";
  import { v4 as uuidv4 } from "uuid";
  import { groupMembersProxy } from "#stores/group_members";
  import Big from "big.js";
  import { formatMoney, getLengthOfFraction } from "#lib/currencyFormat";
  import { current_user } from "#stores/groupUsernames";
  import { ArrowRightIcon, CircleCheckIcon } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import {
    create_amounts,
    compute_balance,
    compute_settlements,
    type Amount,
    type Settlement,
  } from "#stores/settlement";
  let {
    members,
    transactions,
    currency_id,
  }: {
    members: GroupMember[];
    transactions: Transaction[];
    currency_id: string;
  } = $props();
  let modal: Modal | null = $state(null);
  /** Refunds recorded from this screen, shown before the next reload. */
  let added_refunds: Transaction[] = $state([]);

  const all_transactions = $derived([...transactions, ...added_refunds]);
  const balances: Amount[] = $derived(
    compute_balance(create_amounts(members, all_transactions))
  );
  const settlements: Settlement[] = $derived(compute_settlements(balances));

  async function refund(
    group_uuid: string,
    amount: string,
    currency_id: string,
    to: string,
    from: string
  ) {
    if ($current_groupStore) {
      let transaction = {
        amount: amount,
        created_at: getUTC(),
        currency_id: currency_id,
        debtors: [
          {
            amount: amount,
            member: await groupMembersProxy.get_local_member(from),
          },
        ] as Debt[],
        description: "Refund",
        exchange_rate: "1",
        modified_at: getUTC(),
        paid_by: await groupMembersProxy.get_local_member(to),
        uuid: uuidv4(),
      } as Transaction;
      await transactionsProxy.add_transaction(group_uuid, transaction);
      transactionsProxy.synchronize(group_uuid);
      added_refunds.push(transaction);
    }
  }

  /** A refund as created by "Mark as paid": one debtor, who is not the payer. */
  function isRefund(tr: Transaction): boolean {
    return (
      tr.description === "Refund" &&
      tr.debtors.length === 1 &&
      tr.debtors[0].member.uuid !== tr.paid_by.uuid
    );
  }

  const currency_fixed = $derived(getLengthOfFraction(currency_id));

  /** Treat amounts that round to 0 in the group currency as settled. */
  function isZero(amount: Big): boolean {
    return new Big(amount.toFixed(currency_fixed)).eq(0);
  }
  const money = (amount: Big) => formatMoney(amount.abs().toString(), currency_id);

  const sorted_balances = $derived(
    balances.toSorted((a, b) => b.amount.cmp(a.amount))
  );
  const visible_settlements = $derived(
    settlements.filter((settlement) => !isZero(settlement.amount))
  );
  const max_abs = $derived(
    balances.reduce(
      (max, b) => (b.amount.abs().gt(max) ? b.amount.abs() : max),
      new Big(0)
    )
  );
  const my_uuid = $derived($current_user?.member_uuid ?? "");
  const my_balance = $derived(
    balances.find((b) => b.member.uuid === my_uuid)?.amount
  );
  const total_spent = $derived(
    all_transactions
      .filter((tr) => !isRefund(tr))
      .reduce(
        (sum, tr) => sum.plus(new Big(tr.amount).mul(new Big(tr.exchange_rate))),
        new Big(0)
      )
  );
</script>

<main class="mx-auto w-full max-w-2xl px-4 pt-4 pb-10 flex flex-col gap-6" in:fade>
  <!-- Summary for the current user -->
  <section
    class="bg-base-100 border border-base-300 rounded-box p-5 flex items-center gap-4"
  >
    <div class="min-w-0 flex-1">
      <div class="text-sm text-base-content/60">Your balance</div>
      <div
        class="text-2xl font-semibold tracking-tight tabular-nums {my_balance ===
          undefined || isZero(my_balance)
          ? ''
          : my_balance.gt(0)
            ? 'text-success'
            : 'text-error'}"
      >
        {#if my_balance === undefined || isZero(my_balance)}
          {money(new Big(0))}
        {:else}
          {my_balance.gt(0) ? "+" : "−"}{money(my_balance)}
        {/if}
      </div>
    </div>
    <div class="text-right shrink-0">
      <div class="text-sm text-base-content/60">Group spending</div>
      <div class="font-semibold tabular-nums">{money(total_spent)}</div>
    </div>
  </section>

  <!-- Settlements: who pays whom -->
  <section>
    <h2
      class="px-1 mb-2 text-xs font-medium uppercase tracking-wide text-base-content/55"
    >
      Suggested payments
    </h2>
    {#if visible_settlements.length == 0}
      <div
        class="flex flex-col items-center text-center gap-2 py-10 px-6 bg-base-100 border border-base-300 rounded-box"
      >
        <CircleCheckIcon size={36} class="text-success" />
        <p class="font-medium">Everyone is square</p>
        <p class="text-sm text-base-content/60">Nobody owes anything.</p>
      </div>
    {:else}
      <ul
        class="bg-base-100 border border-base-300 rounded-box divide-y divide-base-300 overflow-hidden"
      >
        {#each visible_settlements as settlement (settlement.member_from.uuid + settlement.member_to.uuid)}
          <li class="flex items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <div class="truncate">
                <span class="font-medium">{settlement.member_from.nickname}</span>
                <ArrowRightIcon size={14} class="inline mx-0.5 text-base-content/50" />
                <span class="font-medium">{settlement.member_to.nickname}</span>
              </div>
              <div class="font-semibold tabular-nums">{money(settlement.amount)}</div>
            </div>
            <button
              class="btn btn-sm btn-primary btn-soft shrink-0"
              onclick={() => {
                modal?.open(
                  "Mark as paid?",
                  {
                    text: "Mark as paid",
                    variant: "primary",
                    callback: () => {
                      if ($current_groupStore) {
                        refund(
                          $current_groupStore.token,
                          settlement.amount.toString(),
                          $current_groupStore.currency_id,
                          settlement.member_from.uuid,
                          settlement.member_to.uuid
                        );
                      }
                      modal?.close();
                    },
                  } as ModalButton,
                  {
                    text: "Cancel",
                    callback: () => {},
                  } as ModalButton,
                  `This records a refund of ${money(settlement.amount)} from ${settlement.member_from.nickname} to ${settlement.member_to.nickname}.`
                );
              }}
            >
              Mark as paid
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- Balance of each member -->
  <section>
    <h2
      class="px-1 mb-2 text-xs font-medium uppercase tracking-wide text-base-content/55"
    >
      Balances
    </h2>
    <ul
      class="bg-base-100 border border-base-300 rounded-box divide-y divide-base-300 overflow-hidden"
    >
      {#each sorted_balances as balance (balance.member.uuid)}
        {@const settled = isZero(balance.amount)}
        {@const positive = balance.amount.gt(0)}
        {@const ratio = max_abs.eq(0)
          ? 0
          : Number(balance.amount.abs().div(max_abs).times(100).toFixed(1))}
        <li class="flex items-center gap-3 px-4 py-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2">
              <span class="font-medium truncate">
                {balance.member.nickname}
                {#if balance.member.uuid === my_uuid}
                  <span class="badge badge-sm badge-ghost ml-1 align-middle">you</span>
                {/if}
              </span>
              <span
                class="font-semibold tabular-nums whitespace-nowrap {settled
                  ? 'text-base-content/50'
                  : positive
                    ? 'text-success'
                    : 'text-error'}"
              >
                {settled ? "" : positive ? "+" : "−"}{money(balance.amount)}
              </span>
            </div>
            <div class="mt-1.5 flex items-center gap-2">
              <div class="h-1.5 flex-1 rounded-full bg-base-200 overflow-hidden">
                {#if !settled}
                  <div
                    class="h-full rounded-full {positive ? 'bg-success' : 'bg-error'}"
                    style="width: {ratio}%"
                  ></div>
                {/if}
              </div>
              <span class="text-xs text-base-content/55 w-16 text-right">
                {settled ? "settled" : positive ? "gets back" : "owes"}
              </span>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  </section>
</main>

<Modal bind:this={modal}></Modal>
