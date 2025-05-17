// src/lib/stores/groupUsernames.ts
import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Transaction } from '$lib/types';
import { sort_transactions } from '$lib/shareCountAPI';

const LOCAL_KEY = 'group_transactions';

function getInitialTransactions(): Transaction[] {
    if (!browser) return [];

    try {
        const stored = localStorage.getItem(LOCAL_KEY);
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        return parsed;
    } catch {
        return [];
    }
}


export const group_transactions: Writable<Transaction[]> = writable(getInitialTransactions());

// Persist changes to localStorage
if (browser) {
    group_transactions.subscribe((value) => {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
    });
}

export function SetTransactions(transactions: Transaction[]) {
    group_transactions.set(transactions)
}

export function AddTransaction(transaction: Transaction) {
    group_transactions.update(store=> {
        store = [...store]; 
        store.push(transaction);
        transaction.modified_at = new Date().toISOString().replace("Z", "");
        store = sort_transactions(store);
        return store;
    })
}

export function DeleteTransaction(index: number) {
    group_transactions.update(store=> {
        store = [...store]; 
        store.splice(index, 1);
        store = sort_transactions(store);
        return store;
    })
}

export function setTransactionID(id: number, tr: Transaction): void {
    group_transactions.update(store => {

        store = [...store]; 
        store[id] = tr;
        tr.modified_at = new Date().toISOString().replace("Z", "");
        store = sort_transactions(store);
        return store 
    });
}
