// src/lib/stores/groupUsernames.ts
import { writable, type Writable } from 'svelte/store';
import type { Debt, Transaction } from '$lib/types';
import { getFullBackendURL } from '$lib/shareCountAPI';
import { db, STATUS, type Debt_DB, type Transaction_DB } from '../db/db';
import { groupMembersProxy } from './group_members';
import { getUTC } from '$lib/UTCDate';
import { Synchro, withTimeout } from './SynchroHelper';


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
        return await db.transactions.where("group_uuid").equals(group_uuid).toArray();
    }

    private async _add_local_debts(transaction_uuid: string, debts: Debt[]) {
        for (const debt of debts) {
            await db.debts.add(this._convert_debt_debtDB(transaction_uuid, debt))
        }
    }

    private async _delete_local_debts(transaction_uuid: string) {
        await db.debts.where("transaction_uuid").equals(transaction_uuid).delete();
    }

    async add_transaction(group_uuid: string, inTransaction: Transaction) {
        inTransaction.modified_at = getUTC();
        let has_error = false;
        try {
            await this._update_remote_transaction(group_uuid, [inTransaction]);
        }
        catch {
            has_error = true;
        }
        finally {
            this._add_local_transaction(group_uuid, inTransaction, Synchro.compute_next_status(has_error, STATUS.TO_CREATE));
            group_transactions.update((values: Record<string, Transaction[]>) => {
                if (!values[group_uuid]) {
                    values[group_uuid] = [];
                }
                values[group_uuid].push(inTransaction);
                values[group_uuid] = this._sort_transactions(values[group_uuid]);
                return values;
            })
        }
    }

    async modify_transaction(group_uuid: string, inTransaction: Transaction) {
        inTransaction.modified_at = getUTC();
        let has_error = false;
        try {
            await this._update_remote_transaction(group_uuid, [inTransaction]);
        } catch {
            has_error = true;
        }
        finally {
            const status = Synchro.compute_next_status(has_error, await this.get_status_transation(inTransaction.uuid));
            await this._modify_local_transaction(group_uuid, inTransaction, status);
            group_transactions.update((values: Record<string, Transaction[]>) => {
                const id = values[group_uuid].findIndex((value) => { return value.uuid === inTransaction.uuid })
                values[group_uuid][id] = inTransaction;
                values[group_uuid] = this._sort_transactions(values[group_uuid]);

                return values;
            })
        }
    }

    async delete_transaction(group_uuid: string, inTransaction: Transaction) {
        inTransaction.modified_at = getUTC();
        try {
            this._delete_remote_transaction(group_uuid, [inTransaction]);
        } catch {
            /*empty*/
        } finally {
            this._delete_local_transaction(inTransaction.uuid, true);
            group_transactions.update((values: Record<string, Transaction[]>) => {
                const id = values[group_uuid].findIndex((value) => { return value.uuid === inTransaction.uuid })
                values[group_uuid].splice(id, 1);
                values[group_uuid] = this._sort_transactions(values[group_uuid]);
                return values;
            });
        }

    }

    private async _add_local_transaction(group_uuid: string, inTransaction: Transaction, status: STATUS) {
        const transaction_db = this._convert_transaction_transactionDB(group_uuid, inTransaction, status);
        //If add multiple times
        this._delete_local_debts(transaction_db.uuid);
        this._add_local_debts(transaction_db.uuid, inTransaction.debtors);
        await db.transactions.add(transaction_db);
    }

    _sort_transactions(inTransactions: Transaction[]): Transaction[] {
        return inTransactions.toSorted(
            (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
        );
    }

    private async _delete_local_transaction(transaction_uuid: string, inModify: boolean) {
        if (inModify) {
            await db.transactions.where("uuid").equals(transaction_uuid).modify({ status: STATUS.TO_DELETE, modified_at: getUTC() });
        }
        else {
            await db.transactions.where("uuid").equals(transaction_uuid).delete();
        }

    }

    private async _modify_local_transaction(group_uuid: string, transaction: Transaction, inStatus: STATUS) {
        await this._delete_local_debts(transaction.uuid);
        await this._add_local_debts(transaction.uuid, transaction.debtors);
        const new_tr_db = this._convert_transaction_transactionDB(group_uuid, transaction, inStatus);
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
            values[group_uuid] = this._sort_transactions(values[group_uuid]);
            return values;
        })
        return transactions;
    }

    async has_spent(group: string, user: string): Promise<boolean> {
        const transactions = await this.get_local_transactions(group);
        for (const transaction of transactions) {
            if (transaction.paid_by.uuid === user && transaction.amount != "0") {
                return true;
            }
            for (const debt of transaction.debtors) {
                if (debt.member.uuid === user && debt.amount != "0") {
                    return true;
                }
            }
        }
        return false
    }

    async synchronize(group_uuid: string): Promise<Transaction[]> {

        const original_transactions = await this._get_local_transactionsDB(group_uuid);
        const to_send_transactions: Transaction[] = [];
        const to_delete_transactions: Transaction[] = [];
        const map: Map<string, Transaction_DB> = new Map();
        for (const transaction of original_transactions) {
            map.set(transaction.uuid, transaction);
        }

        let remote_transactions: Transaction[] = [];

        try {
            remote_transactions = await withTimeout(this._get_remote_transactions(group_uuid),7000);
            for (const remote_transaction of remote_transactions) {
                const local_transaction = map.get(remote_transaction.uuid);
                if (local_transaction) {
                    if (local_transaction.status === STATUS.TO_UPDATE) {
                        //If local is newer we send it
                        if (new Date(remote_transaction.modified_at) < new Date(local_transaction?.modified_at)) {
                            to_send_transactions.push(await this._convert_transactionDB_transaction(local_transaction));
                        }
                        else {
                            await this._modify_local_transaction(group_uuid, remote_transaction, STATUS.NOTHING);
                        }
                    }
                    else if (local_transaction.status === STATUS.NOTHING) {
                        await this._modify_local_transaction(group_uuid, remote_transaction, STATUS.NOTHING);
                    }
                    else if (local_transaction.status === STATUS.TO_DELETE) {
                        to_delete_transactions.push(await this._convert_transactionDB_transaction(local_transaction));
                    }
                    else if (local_transaction.status === STATUS.TO_CREATE) {
                        to_send_transactions.push(await this._convert_transactionDB_transaction(local_transaction));
                    }
                    map.delete(local_transaction.uuid);
                }// If transaction is not present we add it
                else {
                    await this._add_local_transaction(group_uuid, remote_transaction, STATUS.NOTHING)
                }
            }

            //The ones not mentioned are deleted
            for (const [uuid, tr] of map) {
                if (tr.status != STATUS.TO_CREATE) {
                    await this._delete_local_transaction(uuid, false);
                }
                else if (tr.status === STATUS.TO_CREATE) {
                    to_send_transactions.push(await this._convert_transactionDB_transaction(tr));
                }
            }

        } catch { /* empty */ }

        try {
            this._update_remote_transaction(group_uuid, to_send_transactions);

            for (const tr of to_send_transactions) {
                await db.transactions.where("uuid").equals(tr.uuid).modify({ status: STATUS.NOTHING });
            }
            this._delete_remote_transaction(group_uuid, to_delete_transactions);

        } catch { /* empty */ }

        const new_transactions = await this.get_local_transactions(group_uuid)

        group_transactions.update((values: Record<string, Transaction[]>) => {

            values[group_uuid] = new_transactions;
            values[group_uuid] = this._sort_transactions(values[group_uuid]);
            return values;
        })
        return new_transactions;
    }
    async get_status_transation(uuid: string): Promise<STATUS> {
        const tr = await db.transactions.where("uuid").equals(uuid).first();
        if (tr) {
            return tr.status;
        }
        return STATUS.NOTHING;
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
        const res = await fetch(`${getFullBackendURL()}/groups/${tokenID}/transactions`, {
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


    private async _update_remote_transaction(tokenID: string, inTransaction: Transaction[]) {
        const url = `${getFullBackendURL()}/v2/groups/${tokenID}/transactions`
        try {
            await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(inTransaction)
            });
        } catch (error) {
            throw new Error(`Request failed ${error}`);
        }
    }

    private async _delete_remote_transaction(tokenID: string, inTransaction: Transaction[]) {
        const res = await fetch(`${getFullBackendURL()}/v2/groups/${tokenID}/transactions`, {
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