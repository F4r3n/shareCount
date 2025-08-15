import type { GroupMember, Transaction } from '$lib/types';
import { expect, describe, it } from 'vitest';
import { compute_balance, compute_settlements, create_amounts, type Amount } from './settlement';
import Big from 'big.js';


describe("Settlement computation", () => {
    const alice: GroupMember = { uuid: "u1", nickname: "Alice", modified_at: "" };
    const bob: GroupMember = { uuid: "u2", nickname: "Bob", modified_at: "" };
    const carol: GroupMember = { uuid: "u3", nickname: "Carol", modified_at: "" };

    it("create_amounts should calculate amounts from transactions", () => {
        const transactions: Transaction[] = [
            {
                uuid: "t1",
                description: "Lunch",
                currency_id: "EUR",
                paid_by: alice,
                created_at: "",
                amount: "30",
                exchange_rate: "1",
                debtors: [
                    { amount: "10", member: bob },
                    { amount: "20", member: carol }
                ],
                modified_at: ""
            }
        ];

        const amounts = create_amounts([alice, bob, carol], transactions);

        // Should include initial zeros + one credit for Alice, two debits for Bob and Carol
        expect(amounts).toHaveLength(6);

        const aliceAmount = amounts.find(
            a => a.member.nickname === "Alice" && !a.amount.eq(0)
        );
        expect(aliceAmount).toBeDefined();
        if (!aliceAmount) throw new Error("Expected Alice's amount to be present");
        expect(aliceAmount.amount.eq(30)).toBe(true);

        const bobAmount = amounts.find(
            a => a.member.nickname === "Bob" && a.amount.lt(0)
        );
        expect(bobAmount).toBeDefined();
        if (!bobAmount) throw new Error("Expected Bob's amount to be present");
        expect(bobAmount.amount.eq(-10)).toBe(true);

        const carolAmount = amounts.find(
            a => a.member.nickname === "Carol" && a.amount.lt(0)
        );
        expect(carolAmount).toBeDefined();
        if (!carolAmount) throw new Error("Expected Carol's amount to be present");
        expect(carolAmount.amount.eq(-20)).toBe(true);
    });

    it("compute_balance should merge amounts by nickname", () => {
        const input: Amount[] = [
            { member: alice, amount: new Big(10) },
            { member: alice, amount: new Big(5) },
            { member: bob, amount: new Big(-3) }
        ];

        const balances = compute_balance(input);

        expect(balances).toHaveLength(2);

        const aliceBal = balances.find(b => b.member.nickname === "Alice");
        expect(aliceBal).toBeDefined();
        if (!aliceBal) throw new Error("Expected Alice's balance to be present");
        expect(aliceBal.amount.eq(15)).toBe(true);

        const bobBal = balances.find(b => b.member.nickname === "Bob");
        expect(bobBal).toBeDefined();
        if (!bobBal) throw new Error("Expected Bob's balance to be present");
        expect(bobBal.amount.eq(-3)).toBe(true);
    });

    it("compute_settlements should match creditors with debtors", () => {
        const balances: Amount[] = [
            { member: alice, amount: new Big(10) },  // Alice is owed 10
            { member: bob, amount: new Big(-7) },    // Bob owes 7
            { member: carol, amount: new Big(-3) }   // Carol owes 3
        ];

        const settlements = compute_settlements(balances);

        expect(settlements).toHaveLength(2);

        const first = settlements[0];
        expect(first.member_from.nickname).toBe("Bob");
        expect(first.member_to.nickname).toBe("Alice");
        expect(first.amount.eq(7)).toBe(true);

        const second = settlements[1];
        expect(second.member_from.nickname).toBe("Carol");
        expect(second.member_to.nickname).toBe("Alice");
        expect(second.amount.eq(3)).toBe(true);
    });

    it("compute_settlements handles exact zero balances", () => {
        const balances: Amount[] = [
            { member: alice, amount: new Big(5) },
            { member: bob, amount: new Big(-5) }
        ];

        const settlements = compute_settlements(balances);

        expect(settlements).toHaveLength(1);
        const s = settlements[0];
        expect(s.member_from.nickname).toBe("Bob");
        expect(s.member_to.nickname).toBe("Alice");
        expect(s.amount.eq(5)).toBe(true);
    });
});