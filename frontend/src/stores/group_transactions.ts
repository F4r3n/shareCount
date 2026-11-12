// src/lib/stores/groupUsernames.ts
import type { Debt, Transaction } from '$lib/types';
import { getFullBackendURL } from '$lib/shareCountAPI';
import { db, STATUS, type Debt_DB, type Transaction_DB } from '../db/db';
import { groupMembersProxy } from './group_members';
import { getUTC, parseUTC } from '$lib/UTCDate';
import { RemoteRequestError, withTimeout } from './SynchroHelper';



export class TransactionsProxy {

    private async _get_local_debts(transaction_uuid: string): Promise<Debt[]> {
        const debts_db = await db.debts.where("transaction_uuid").equals(transaction_uuid).toArray();
        const result: Debt[] = [];

        for (const de of debts_db) {
            result.push(await this._convert_debtDB_debt(de));
        }

        return result;
    }


    private async _read_local_transactions(group_uuid: string, filter: (t: Transaction_DB) => boolean): Promise<Transaction[]> {
        return db.transaction("r", db.transactions, db.debts, db.group_members, async () => {
            const rows = (await this._get_local_transactionsDB(group_uuid)).filter(filter);
            const result: Transaction[] = [];
            for (const t of rows) {
                result.push(await this._convert_transactionDB_transaction(t));
            }
            return result;
        });
    }

    public async get_local_transactions(group_uuid: string): Promise<Transaction[]> {
        return this._read_local_transactions(group_uuid, () => true);
    }

    public async synchronize_local(group_uuid: string): Promise<Transaction[]> {
        // Hide transactions deleted locally but not yet synchronized.
        const result = await this._read_local_transactions(group_uuid, (t) => t.status !== STATUS.TO_DELETE);
        return this._sort_transactions(result);
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

        await this._add_local_transaction(group_uuid, inTransaction, STATUS.TO_CREATE);
    }

    async modify_transaction(group_uuid: string, inTransaction: Transaction) {
        inTransaction.modified_at = getUTC();

        let status = await this.get_status_transation(inTransaction.uuid);
        if (status == STATUS.NOTHING) {
            status = STATUS.TO_UPDATE;
        }
        await this._modify_local_transaction(group_uuid, inTransaction, status);
    }

    async delete_transaction(group_uuid: string, inTransaction: Transaction) {
        inTransaction.modified_at = getUTC();

        await this._delete_local_transaction(inTransaction.uuid, true);
    }

    private async _add_local_transaction(group_uuid: string, inTransaction: Transaction, status: STATUS) {
        const transaction_db = this._convert_transaction_transactionDB(group_uuid, inTransaction, status);
        await db.transaction("rw", db.transactions, db.debts, async () => {
            //If add multiple times
            await this._delete_local_debts(transaction_db.uuid);
            await this._add_local_debts(transaction_db.uuid, inTransaction.debtors);
            await db.transactions.add(transaction_db);
        });
    }

    _sort_transactions(inTransactions: Transaction[]): Transaction[] {
        return inTransactions.toSorted(
            (a, b) => parseUTC(b.created_at) - parseUTC(a.created_at),
        );
    }

    private async _delete_local_transaction(transaction_uuid: string, inModify: boolean) {
        if (inModify) {
            await db.transactions.where("uuid").equals(transaction_uuid).modify({ status: STATUS.TO_DELETE, modified_at: getUTC() });
        }
        else {
            await db.transaction("rw", db.transactions, db.debts, async () => {
                await db.transactions.where("uuid").equals(transaction_uuid).delete();
                await this._delete_local_debts(transaction_uuid);
            });
        }

    }

    private async _modify_local_transaction(group_uuid: string, transaction: Transaction, inStatus: STATUS) {
        const new_tr_db = this._convert_transaction_transactionDB(group_uuid, transaction, inStatus);
        new_tr_db.modified_at = getUTC();

        await db.transaction("rw", db.transactions, db.debts, async () => {
            await this._delete_local_debts(transaction.uuid);
            await this._add_local_debts(transaction.uuid, transaction.debtors);
            await db.transactions.where("uuid").equals(transaction.uuid).modify(new_tr_db);
        });
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

        try {
            const remote_transactions = await withTimeout(this._get_remote_transactions(group_uuid), 7000);
            for (const remote_transaction of remote_transactions) {
                const local_transaction = map.get(remote_transaction.uuid);
                // If transaction is not present we add it
                if (!local_transaction) {
                    await this._add_local_transaction(group_uuid, remote_transaction, STATUS.NOTHING);
                    continue;
                }
                map.delete(local_transaction.uuid);

                const local_is_newer = new Date(remote_transaction.modified_at) < new Date(local_transaction.modified_at);
                switch (local_transaction.status) {
                    case STATUS.TO_CREATE:
                    case STATUS.TO_UPDATE:
                        if (local_is_newer) {
                            to_send_transactions.push(await this._convert_transactionDB_transaction(local_transaction));
                        } else {
                            await this._modify_local_transaction(group_uuid, remote_transaction, STATUS.NOTHING);
                        }
                        break;
                    case STATUS.TO_DELETE:
                        // Someone edited it after our deletion: keep their version.
                        if (local_is_newer) {
                            to_delete_transactions.push(await this._convert_transactionDB_transaction(local_transaction));
                        } else {
                            await this._modify_local_transaction(group_uuid, remote_transaction, STATUS.NOTHING);
                        }
                        break;
                    default:
                        await this._modify_local_transaction(group_uuid, remote_transaction, STATUS.NOTHING);
                }
            }

            // Not on the server: deleted remotely, unless we created it and haven't sent it yet.
            for (const [uuid, tr] of map) {
                if (tr.status === STATUS.TO_CREATE) {
                    to_send_transactions.push(await this._convert_transactionDB_transaction(tr));
                } else {
                    await this._delete_local_transaction(uuid, false);
                }
            }
        } catch {
            // Offline or server error: keep every pending change for the next synchronization.
            return await this.synchronize_local(group_uuid);
        }

        // Only clear a pending status once the server has confirmed the change.
        try {
            const sent = await this._send_transactions(group_uuid, to_send_transactions);
            for (const uuid of sent) {
                await db.transactions.where("uuid").equals(uuid).modify({ status: STATUS.NOTHING });
            }
        } catch { /* stays pending */ }

        try {
            if (to_delete_transactions.length > 0) {
                await this._delete_remote_transaction(group_uuid, to_delete_transactions);
                for (const tr of to_delete_transactions) {
                    await this._delete_local_transaction(tr.uuid, false);
                }
            }
        } catch { /* stays pending */ }

        return await this.synchronize_local(group_uuid);
    }

    /**
     * Send transactions to the server and return the uuids it accepted.
     * The batch endpoint is atomic, so if the server rejects the batch (e.g. one
     * invalid transaction) retry them one by one so a single bad entry cannot
     * block every other pending change.
     */
    private async _send_transactions(group_uuid: string, transactions: Transaction[]): Promise<string[]> {
        if (transactions.length === 0) {
            return [];
        }
        try {
            await this._update_remote_transaction(group_uuid, transactions);
            return transactions.map((tr) => tr.uuid);
        } catch (error) {
            if (!(error instanceof RemoteRequestError) || error.status !== 400 || transactions.length === 1) {
                throw error;
            }
        }

        const sent: string[] = [];
        for (const tr of transactions) {
            try {
                await this._update_remote_transaction(group_uuid, [tr]);
                sent.push(tr.uuid);
            } catch { /* this one stays pending */ }
        }
        return sent;
    }
    async get_status_transation(uuid: string): Promise<STATUS> {
        const tr = await db.transactions.where("uuid").equals(uuid).first();
        if (tr) {
            return tr.status;
        }
        return STATUS.NOTHING;
    }

    async get_transation(uuid: string): Promise<Transaction | undefined> {
        const tr = await db.transactions.where("uuid").equals(uuid).first();
        if (tr) {
            return await this._convert_transactionDB_transaction(tr);
        }
        return undefined;
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
        const url = `${getFullBackendURL()}/groups/${tokenID}/transactions`
        const res = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(inTransaction)
        });

        if (!res.ok) {
            throw new RemoteRequestError(res.status);
        }
    }

    private async _delete_remote_transaction(tokenID: string, inTransaction: Transaction[]) {
        const res = await fetch(`${getFullBackendURL()}/groups/${tokenID}/transactions`, {
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
