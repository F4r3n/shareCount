// src/lib/stores/groupUsernames.ts
import { writable, type Writable } from 'svelte/store';
import type { Debt, Transaction } from '$lib/types';
import { getBackendURL } from '$lib/shareCountAPI';
import { db, STATUS, type Debt_DB, type Transaction_DB } from '../db/db';
import { groupMembersProxy } from './group_members';
import { getUTC } from '$lib/UTCDate';


export const group_transactions: Writable<Record<string, Transaction[]>> = writable({});

export class TransactionsProxy {

    private async _get_local_debts(transaction_uuid: string): Promise<Debt[]> {
        const debts_db = await db.debts.where("transaction_uuid").equals(transaction_uuid).toArray();
        const result: Debt[] = [];

        for (const de of debts_db) {
            result.push(await this._convert_debtDB_debt(de));
        }

        return result;
    }

    private async get_local_transactions(group_uuid: string): Promise<Transaction[]> {
        const tr = await this._get_local_transactionsDB(group_uuid)
        const result: Transaction[] = [];
        for (const t of tr) {
            result.push(await this._convert_transactionDB_transaction(t));
        }
        return result;
    }

    private async _get_local_transactionsDB(group_uuid: string): Promise<Transaction_DB[]> {
        const tr = (await db.transactions.where("group_uuid").equals(group_uuid).toArray());
        return tr;
    }

    private async _add_local_debts(transaction_uuid: string, debts: Debt[]) {
        for (const debt of debts) {
            await db.debts.add(this._convert_debt_debtDB(transaction_uuid, debt))
        }
    }

    private async _delete_local_debts(transaction_uuid: string) {
        await db.debts.where("transaction_uuid").equals(transaction_uuid).delete();
    }

    async add_local_transaction(group_uuid: string, inTransaction: Transaction, status: STATUS) {
        const transaction_db = this._convert_transaction_transactionDB(group_uuid, inTransaction, status);
        this._add_local_debts(transaction_db.uuid, inTransaction.debtors);
        await db.transactions.add(transaction_db);
        group_transactions.update((values: Record<string, Transaction[]>) => {
            if(!values[group_uuid]) {
                values[group_uuid] = [];
            }
            values[group_uuid].push(inTransaction);
            return values;
        })
    }

    async delete_local_transaction(group_uuid: string, transaction_uuid: string) {
        await db.transactions.where("uuid").equals(transaction_uuid).modify({ status: STATUS.TO_DELETE, modified_at: getUTC() });
        group_transactions.update((values: Record<string, Transaction[]>) => {
            const id = values[group_uuid].findIndex((value) => { return value.uuid === transaction_uuid })
            values[group_uuid].splice(id, 1);
            return values;
        })
    }

    async modify_local_transaction(group_uuid: string, transaction: Transaction) {
        await this._delete_local_debts(transaction.uuid);
        await this._add_local_debts(transaction.uuid, transaction.debtors);
        const new_tr_db = this._convert_transaction_transactionDB(group_uuid, transaction, STATUS.NOTHING);
        new_tr_db.modified_at = getUTC();
        await db.transactions.where("uuid").equals(transaction.uuid).modify(new_tr_db);
    }

    async local_synchronize(group_uuid: string) {
        const original_transactions = await this._get_local_transactionsDB(group_uuid);
        const transactions: Transaction[] = [];
        for (const tr of original_transactions) {
            transactions.push(await this._convert_transactionDB_transaction(tr))
        }
        group_transactions.update((values: Record<string, Transaction[]>) => {
            values[group_uuid] = transactions;
            return values;
        })
        return transactions;
    }

    private async _delete_all_transactions(group : string) {
        for(const tr of await db.transactions.where("group_uuid").equals(group).toArray())
        {
            await db.debts.where("transaction_uuid").equals(tr.uuid).delete();
        }
        await db.transactions.where("group_uuid").equals(group).delete();
    }

    async synchronize(group_uuid: string) {

        const original_transactions = await this._get_local_transactionsDB(group_uuid);
        const to_send_transactions: Transaction[] = [];
        const to_delete_transactions: Transaction[] = [];

        const map: Map<string, Transaction_DB> = new Map();
        for (const transaction of original_transactions) {
            map.set(transaction.uuid, transaction);
            if (transaction.status == STATUS.TO_CREATE || transaction.status == STATUS.NOTHING) {
                to_send_transactions.push(await this._convert_transactionDB_transaction(transaction))
            }
            else if (transaction.status === STATUS.TO_DELETE) {
                to_delete_transactions.push(await this._convert_transactionDB_transaction(transaction))
            }
        }
        try {
            for (const transaction of to_delete_transactions) {
                await this._delete_remote_transaction(group_uuid, transaction);
            }
            for (const transaction of to_send_transactions) {
                await this._update_remote_transaction(group_uuid, transaction);
            }
            await this._delete_all_transactions(group_uuid);
            const remote_transactions = await this._get_remote_transactions(group_uuid);
            for (const transaction of remote_transactions) {
                this.add_local_transaction(group_uuid, transaction, STATUS.NOTHING);
                if (map.has(transaction.uuid)) {
                    map.delete(transaction.uuid)
                }
            }

        } catch { /* empty */ }

        const new_transactions = await this.get_local_transactions(group_uuid)

        group_transactions.update((values: Record<string, Transaction[]>) => {
            values[group_uuid] = new_transactions;
            return values;
        })
    }


    private async _convert_debtDB_debt(debt: Debt_DB): Promise<Debt> {
        const member = await groupMembersProxy.get_local_member(debt.member_uuid);
        return {
            amount: debt.amount,
            member: member,
        } as Debt
    }

    private _convert_debt_debtDB(transaction_uuid: string, debt: Debt): Debt_DB {
        return {
            amount: debt.amount,
            member_uuid: debt.member.uuid,
            transaction_uuid: transaction_uuid
        } as Debt_DB
    }

    private _convert_transaction_transactionDB(group_uuid: string, tr: Transaction, status: STATUS): Transaction_DB {
        return {
            amount: tr.amount,
            created_at: tr.created_at,
            currency_id: tr.currency_id,
            description: tr.description,
            exchange_rate: tr.exchange_rate,
            group_uuid: group_uuid,
            status: status,
            modified_at: tr.modified_at,
            paid_by: tr.paid_by.uuid,
            uuid: tr.uuid
        } as Transaction_DB
    }

    private async _convert_transactionDB_transaction(tr: Transaction_DB): Promise<Transaction> {
        const member = await groupMembersProxy.get_local_member(tr.paid_by);
        const debts: Debt[] = await this._get_local_debts(tr.uuid);
        return {
            uuid: tr.uuid,
            amount: tr.amount,
            created_at: tr.created_at,
            currency_id: tr.currency_id,
            description: tr.description,
            exchange_rate: tr.exchange_rate,
            modified_at: tr.modified_at,
            paid_by: member,
            debtors: debts
        } as Transaction
    }

    private async _get_remote_transactions(tokenID: string): Promise<Transaction[]> {
        const res = await fetch(`${getBackendURL()}/groups/${tokenID}/transactions`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) {
            throw new Error(`Request failed ${res.status}`);
        }

        const data = await res.json();
        const transactions: Transaction[] = data;

        return transactions.reverse();

    }


    _sort_transactions(inTransactions: Transaction[]): Transaction[] {
        return inTransactions.toSorted((a, b) => new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime())
    }

    private async _update_remote_transaction(tokenID: string, inTransaction: Transaction) {
        const url = `${getBackendURL()}/groups/${tokenID}/transactions`

        const res = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(inTransaction)
        });

        if (!res.ok) {
            throw new Error(`Request failed ${res.status}`);
        }
    }

    private async _delete_remote_transaction(tokenID: string, inTransaction: Transaction) {
        const res = await fetch(`${getBackendURL()}/groups/${tokenID}/transactions}`, {
            method: "DELETE",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(inTransaction)
        });

        if (!res.ok) {
            throw new Error(`Request failed ${res.status}`);
        }

    }


}

export const transactionsProxy = new TransactionsProxy();