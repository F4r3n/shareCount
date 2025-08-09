<script lang="ts">
  import type { Debt, GroupMember, Transaction } from "$lib/types";
  import { onMount } from "svelte";
  import { getUTC } from "$lib/UTCDate";
  import { v4 as uuidv4 } from "uuid";
  import { transactionsProxy } from "@stores/group_transactions";
  import { current_user } from "@stores/groupUsernames";
  import { groupMembersProxy } from "@stores/group_members";
  import { current_groupStore } from "@stores/group";
  import TransactionEditor from "@components/TransactionEditor.svelte";
  import { base } from "$app/paths";
  import { goto } from "$app/navigation";
  import { fade } from "svelte/transition";

  let transaction: Transaction | undefined = $state(undefined);
  let new_transaction = $state(false);
  let members = $state([] as GroupMember[]);
  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const transaction_uuid = params.get("id") ?? "";
    if ($current_groupStore) {
      members = await groupMembersProxy.get_group_members(
        $current_groupStore?.token
      );
      const currency = $current_groupStore.currency_id;
      const current_member = await groupMembersProxy.get_local_member(
        $current_user?.member_uuid ?? ""
      );
      if (current_member) {
        transaction =
          (await transactionsProxy.get_transation(transaction_uuid)) ??
          create_new_transaction(currency, current_member, members);
      }
    }

    new_transaction = transaction == undefined;
  });

  function create_new_transaction(
    main_currency: string,
    current_member: GroupMember,
    members: GroupMember[]
  ): Transaction {
    return {
      uuid: uuidv4(),
      amount: "",
      currency_id: main_currency ?? "EUR",
      created_at: getUTC(),
      modified_at: getUTC(),
      debtors: create_debtors(members),
      description: "",
      exchange_rate: "1",
      paid_by: current_member,
    };
  }

  function create_debtors(members: GroupMember[]): Debt[] {
    let debts = [] as Debt[];
    for (const member of members) {
      debts.push({ amount: "0", member });
    }
    return debts;
  }
</script>

<main in:fade class="w-full flex flex-col items-center">
  {#if transaction}
    <div class="justify-center w-full">
      <TransactionEditor
        {transaction}
        group_currency={$current_groupStore?.currency_id}
        {members}
        is_creating={new_transaction}
        onCancel={() => {
          //creating = false;
        }}
        onDelete={(tx: Transaction) => {
          if ($current_groupStore) {
            transactionsProxy.delete_transaction($current_groupStore.token, tx);
          }
          goto(base + "/expenses");
        }}
        onSave={(newTransaction: Transaction) => {
          if ($current_groupStore) {
            if (new_transaction) {
              transactionsProxy.add_transaction(
                $current_groupStore.token,
                newTransaction
              );
            } else {
              transactionsProxy.modify_transaction(
                $current_groupStore.token,
                newTransaction
              );
            }
          }
          goto(base + "/expenses");
        }}
      ></TransactionEditor>
    </div>
  {/if}
</main>

<style>
  main {
    display: flex;
    width: 100%;
    justify-content: center;
  }
</style>
