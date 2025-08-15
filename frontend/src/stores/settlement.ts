import type { Transaction, GroupMember } from "$lib/types";
import Big from "big.js";


export interface Amount {
    member: GroupMember;
    amount: Big; // Big.js object
}

export interface Settlement {
    member_from: GroupMember;
    member_to: GroupMember;
    amount: Big;
}

export function create_amounts(members: GroupMember[], transactions: Transaction[]): Amount[] {
    const amounts: Amount[] = [];

    for (const member of members) {
        amounts.push({ member: member, amount: new Big("0") } as Amount);
    }

    for (const transaction of transactions) {
        amounts.push({
            member: transaction.paid_by,
            amount: new Big(transaction.amount)
                .mul(new Big(transaction.exchange_rate)),
        } as Amount);
        for (const debt of transaction.debtors) {
            amounts.push({
                member: debt.member,
                amount:
                    new Big(debt.amount)
                        .mul(new Big(transaction.exchange_rate)).mul(-1),
            } as Amount);
        }
    }
    return amounts;
}

/**
 * Merge transactions by member.nickname, summing their amounts.
 * Amounts can be positive (credit) or negative (debt).
 */
export function compute_balance(transactions: Amount[]): Amount[] {
    const map = new Map<string, Amount>();

    for (const transaction of transactions) {
        const key = transaction.member.nickname;
        const existing = map.get(key);

        if (existing) {
            existing.amount = existing.amount.plus(transaction.amount);
        } else {
            map.set(key, {
                member: transaction.member,
                amount: new Big(transaction.amount)
            });
        }
    }

    return Array.from(map.values());
}

/**
 * Given a list of balances (positive or negative),
 * match creditors with debtors and compute the settlement transfers.
 */
export function compute_settlements(transactions: Amount[]): Settlement[] {
    // Clone so we don't mutate original array
    const txs = transactions.map(t => ({
        member: t.member,
        amount: new Big(t.amount) // copy
    }));

    // Sort descending so creditors first, debtors last
    txs.sort((a, b) => b.amount.cmp(a.amount));

    const settlements: Settlement[] = [];

    let i = 0;
    let j = txs.length - 1;

    while (i < j) {
        const top = txs[i];    // Creditor
        const bottom = txs[j]; // Debtor

        // Only settle if top has credit and bottom has debt
        if (top.amount.lte(0) || bottom.amount.gte(0)) {
            break;
        }

        // min(top.amount, -bottom.amount)
        const minAmount = top.amount.cmp(bottom.amount.times(-1)) <= 0
            ? top.amount
            : bottom.amount.times(-1);

        bottom.amount = bottom.amount.plus(minAmount);
        top.amount = top.amount.minus(minAmount);

        settlements.push({
            member_from: bottom.member,
            member_to: top.member,
            amount: minAmount
        });

        if (bottom.amount.eq(0)) {
            j--;
        }
        if (top.amount.eq(0)) {
            i++;
        }
    }

    return settlements;
}