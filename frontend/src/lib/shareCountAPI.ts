import type { Transaction } from "./types"

export function getBackendURL(): string {
    const backendURL = import.meta.env.VITE_BACKEND_URL;
    if (!backendURL) {
        const params = new URLSearchParams(window.location.search);
		return params.get("url") ?? "";
    }
    return backendURL;
}

export async function getTransactions(tokenID: string): Promise<Transaction[]> {
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




export function sort_transactions(inTransactions: Transaction[]): Transaction[] {
    return inTransactions.toSorted((a, b) => new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime())
}

export async function updateTransaction(tokenID: string, inTransaction: Transaction) {
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

export async function deleteTransaction(tokenID: string, inTransactionID: string) {
    try {
        const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}/transactions/${inTransactionID}`, {
            method: "DELETE",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) {
            throw new Error(`Request failed ${res.status}`);
        }

    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
}

