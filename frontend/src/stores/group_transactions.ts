// src/lib/stores/groupUsernames.ts
import { writable, type Writable } from 'svelte/store';
import type { Debt, Transaction } from '$lib/types';
import { getBackendURL } from '$lib/shareCountAPI';
import { db, STATUS, type Debt_DB, type Transaction_DB } from '../db/db';
import { groupMembersProxy } from './group_members';
import { getUTC } from '$lib/UTCDate';


export const group_transactions: Writable<Record<string, Transaction[]>> = writable({});

export class TransactionsProxy {

    async _get_local_debts(transaction_uuid: string): Promise<Debt[]> {
        const debts_db = await db.debt.where("transaction_uuid").equals(transaction_uuid).toArray()
        const result: Debt[] = [];

        for (const de of debts_db) {
            result.push(await this._convert_debtDB_debt(de));
        }
        return result;
    }

    async get_local_transactions(group_uuid: string): Promise<Transaction[]> {
        const tr = await this._get_local_transactionsDB(group_uuid)
        const result: Transaction[] = [];
        for (const t of tr) {
            result.push(await this._convert_transactionDB_transaction(t));
        }
        return result;
    }

    async _get_local_transactionsDB(group_uuid: string): Promise<Transaction_DB[]> {
        const tr = (await db.transaction.where("group_uuid").equals(group_uuid).toArray());
        return tr;
    }

    async _add_local_debts(transaction_uuid: string, debts: Debt[]) {
        for (const debt of debts) {
            await db.debt.add(this._convert_debt_debtDB(transaction_uuid, debt))
        }
    }

    async add_local_transaction(group_uuid: string, inTransaction: Transaction) {
        const transaction_db = this._convert_transaction_transactionDB(group_uuid, inTransaction, STATUS.TO_CREATE);
        await db.transaction.add(transaction_db);
        group_transactions.update((values: Record<string, Transaction[]>) => {
            values[group_uuid].push(inTransaction);
            return values;
        })
    }

    async delete_local_transaction(group_uuid: string, transaction_uuid: string) {
        await db.transaction.where("uuid").equals(transaction_uuid).modify({ status: STATUS.TO_DELETE, modified_at: getUTC() });
        group_transactions.update((values: Record<string, Transaction[]>) => {
            const id = values[group_uuid].findIndex((value) => { return value.uuid === transaction_uuid })
            values[group_uuid].splice(id, 1);
            return values;
        })
    }

    async modify_local_transaction(group_uuid: string, transaction: Transaction) {
        await db.debt.where("transaction_uuid").equals(transaction.uuid).delete();
        await this._add_local_debts(transaction.uuid, transaction.debtors);
        const new_tr_db = this._convert_transaction_transactionDB(group_uuid, transaction, STATUS.NOTHING);
        new_tr_db.modified_at = getUTC();
        await db.transaction.where("uuid").equals(transaction.uuid).modify(new_tr_db);
    }

    async synchonize(group_uuid: string) {

        const original_transactions = await this._get_local_transactionsDB(group_uuid);
        const to_send_transactions: Transaction[] = [];
        const to_delete_transactions: Transaction[] = [];

        const map: Map<string, Transaction_DB> = new Map();
        for (const transaction of original_transactions) {
            map.set(transaction.uuid, transaction);
            if (transaction.status == STATUS.TO_CREATE) {
                to_send_transactions.push(await this._convert_transactionDB_transaction(transaction))
            }
            else if (transaction.status === STATUS.TO_DELETE) {
                to_delete_transactions.push(await this._convert_transactionDB_transaction(transaction))
            }
        }
        const remote_transactions = await this._get_remote_transactions(group_uuid)
        for (const transaction of remote_transactions) {
            if (map.has(transaction.uuid)) {
                to_send_transactions.push(transaction);
            }
            map.set(transaction.uuid, this._convert_transaction_transactionDB(group_uuid, transaction, STATUS.NOTHING));
        }

        for (const transaction of to_send_transactions) {
            await this._update_remote_transaction(group_uuid, transaction);
        }
        await this._reset_status(group_uuid);
        for (const transaction of to_delete_transactions) {
            await this._delete_remote_transaction(group_uuid, transaction);

        }
        await this._delete_marked_delete(group_uuid);

        const new_transactions = await this.get_local_transactions(group_uuid)

        group_transactions.update((values: Record<string, Transaction[]>) => {
            values[group_uuid] = new_transactions;
            return values;
        })
    }

    async _reset_status(in_group_token: string) {
        await db.transaction.where("group_uuid").equals(in_group_token)
            .and((member) => { return member.status === STATUS.TO_CREATE })
            .modify({ status: STATUS.NOTHING })
    }

    async _delete_marked_delete(in_group_token: string) {
        await db.transaction.where("group_uuid").equals(in_group_token)
            .and((member) => { return member.status === STATUS.TO_DELETE })
            .delete()
    }

    async _convert_debtDB_debt(debt: Debt_DB): Promise<Debt> {
        const member = await groupMembersProxy.get_local_member(debt.member_uuid);
        return {
            amount: debt.amount,
            member: member,
        } as Debt
    }

    _convert_debt_debtDB(transaction_uuid: string, debt: Debt): Debt_DB {
        return {
            amount: debt.amount,
            member_uuid: debt.member.uuid,
            transaction_uuid: transaction_uuid
        } as Debt_DB
    }

    _convert_transaction_transactionDB(group_uuid: string, tr: Transaction, status: STATUS): Transaction_DB {
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

    async _convert_transactionDB_transaction(tr: Transaction_DB): Promise<Transaction> {
        const member = await groupMembersProxy.get_local_member(tr.paid_by);
        const debts: Debt[] = [] as Debt[]
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

    async _get_remote_transactions(tokenID: string): Promise<Transaction[]> {
        try {
            const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}/transactions`, {
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

        } catch (err) {
            console.error("Error:", err);
            throw err; // re-throw so the caller can handle the error
        }
    }


    _sort_transactions(inTransactions: Transaction[]): Transaction[] {
        return inTransactions.toSorted((a, b) => new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime())
    }

    async _update_remote_transaction(tokenID: string, inTransaction: Transaction) {
        try {
            const url = `http://${getBackendURL()}/groups/${tokenID}/transactions`

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

        } catch (err) {
            console.error("Error:", err);
            throw err; // re-throw so the caller can handle the error
        }
    }

    async _delete_remote_transaction(tokenID: string, inTransaction: Transaction) {
        try {
            const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}/transactions}`, {
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

        } catch (err) {
            console.error("Error:", err);
            throw err; // re-throw so the caller can handle the error
        }
    }


}

