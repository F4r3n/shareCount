import { getFullBackendURL } from "$lib/shareCountAPI";
import type { TransactionHistory } from "$lib/types";


export class HistoryProxy {

    async get_remote_transactions_history(tokenID: string, from?: number, to?: number): Promise<TransactionHistory[]> {
        const params = [];
        let url = `${getFullBackendURL()}/history/groups/${tokenID}/transactions`
        if (from) {
            params.push(`from=${from}`)
        }
        if (to) {
            params.push(`to=${to}`)
        }
        if (params.length > 0) {
            url += "?" + params.join("&");
        }
        const res = await fetch(url, {
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
        const transactions: TransactionHistory[] = data;

        return transactions;
    }

    // Helper function to get differences between two objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDifferences(obj1: Record<string, any>, obj2: Record<string, any>, path: string = ''): string[] {
        const diffs: string[] = [];
        for (const key in obj1) {
            const fullPath = path ? `${path}.${key}` : key;
            if (
                typeof obj1[key] === 'object' &&
                obj1[key] !== null &&
                obj2[key] !== null &&
                typeof obj2[key] === 'object'
            ) {
                // Recursively compare if nested object or array
                diffs.push(...this.getDifferences(obj1[key], obj2[key], fullPath));
            } else if (obj1[key] !== obj2[key]) {
                diffs.push(`${fullPath}: '${obj1[key]}' => '${obj2[key]}'`);
            }
        }
        return diffs;
    }

    // Compare all pairs in TransactionHistory[]
    compareTransactionHistory(arr: TransactionHistory[]): string[][] {
        const result: string[][] = [];
        for (let i = 0; i < arr.length - 1; i++) {
            const diffs = this.getDifferences(arr[i], arr[i + 1]);
            result.push(diffs);
        }
        return result;
    }
}

export const historyProxy = new HistoryProxy();
