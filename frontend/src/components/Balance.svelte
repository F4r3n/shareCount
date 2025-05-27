<script lang="ts">
    import type { Debt, GroupMember, Transaction } from "$lib/types";
    import { onMount } from "svelte";
    import init, {
        compute_balance,
        compute_settlements,
        type Amount,
        type Settlement,
    } from "wasm-lib";
    import Modal from "./Modal.svelte";
    import { type ModalButton } from "./ModalTypes";
    import { transactionsProxy } from "@stores/group_transactions";
    import { current_user } from "@stores/groupUsernames";
    import { base } from "$app/paths";
    import { getUTC } from "$lib/UTCDate";
    import { current_groupStore } from "@stores/group";
    import { v4 as uuidv4 } from "uuid";
    import { groupMembersProxy } from "@stores/group_members";

    let { members }: { members: GroupMember[] } = $props();
    let modal: Modal | null = $state(null);
    let balances: Amount[] = $state([]);
    let settlements: Settlement[] = $state([]);

    async function get_amounts(): Promise<Amount[]> {
        let amounts = [];

        for (const member of members) {
            amounts.push({ member: member, amount: "0" } as Amount);
        }
        let transactions = [] as Transaction[];
        if ($current_user?.group_uuid) {
            transactions = await transactionsProxy.local_synchronize(
                $current_user.group_uuid,
            );
        }
        for (const transaction of transactions) {
            amounts.push({
                member: transaction.paid_by,
                amount: transaction.amount,
            } as Amount);
            for (let debt of transaction.debtors) {
                amounts.push({
                    member: debt.member,
                    amount: "-" + debt.amount,
                } as Amount);
            }
        }
        return amounts;
    }

    onMount(async () => {
        await init(base + "/assets/wasm_lib_bg.wasm");
        balances = compute_balance(await get_amounts());
        settlements = compute_settlements(balances).filter(
            (settlement: Settlement) => {
                return settlement.amount != "0";
            },
        );
    });

    async function refund(
        group_uuid: string,
        amount: string,
        currency_id: string,
        to: string,
        from: string,
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
            balances = compute_balance(await get_amounts());
            settlements = compute_settlements(balances).filter(
                (settlement: Settlement) => {
                    return settlement.amount != "0";
                },
            );
        }
    }
</script>

<main class="w-full sm:w-2/3 mx-auto">
    <div class="m-2">
        <h1 class="text-2xl">Balances</h1>
        <div>
            {#each balances as balance (balance.member)}
                <div
                    class="bg-base-100 rounded-md flex flex-row justify-between m-1 p-2"
                >
                    <div class="pl-2">{balance.member.nickname}</div>
                    <div>{balance.amount}</div>
                </div>
            {/each}
        </div>
    </div>
    <div class="m-2 mt-5">
        <h1 class="text-2xl">Settlements</h1>
        <div>
            {#if settlements.length == 0}
                <div class="text-center text-2xl">Everyting is paid!</div>
            {:else}
                {#each settlements as settlement (settlement.member_from)}
                    <div class="bg-base-100 rounded-md m-1 p-2 flex flex-col">
                        <div class="flex flex-row justify-between">
                            <div class="flex flex-row">
                                <div class="pl-2">
                                    {settlement.member_from.nickname}
                                </div>
                                <span class="px-2 text-base-content/80"
                                    >(owes)</span
                                >
                                <div>{settlement.member_to.nickname}</div>
                            </div>

                            <div>{settlement.amount}</div>
                        </div>

                        <button
                            class="btn mt-3 btn-accent"
                            onclick={() => {
                                modal?.open(
                                    "Should I create a transaction",
                                    {
                                        text: "Yes create",
                                        callback: () => {
                                            if ($current_groupStore) {
                                                refund(
                                                    $current_groupStore.token,
                                                    settlement.amount,
                                                    $current_groupStore.currency_id,
                                                    settlement.member_from.uuid,
                                                    settlement.member_to.uuid,
                                                );
                                            }
                                            modal?.close();
                                        },
                                    } as ModalButton,
                                    {
                                        text: "No forget",
                                        callback: () => {},
                                    } as ModalButton,
                                );
                            }}>Mark as paid</button
                        >
                    </div>
                {/each}
            {/if}
        </div>
    </div>
</main>

<Modal bind:this={modal}></Modal>
