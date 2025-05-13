import type { Group, Transaction, GroupMember } from "./types"

function getBackendURL(): string {
    const backendURL = import.meta.env.VITE_BACKEND_URL;
    if (!backendURL) {
        const params = new URLSearchParams(window.location.search);
		return params.get("url") ?? "";
    }
    return backendURL;
}

export async function getGroup(tokenID: string): Promise<Group> {
    try {
        const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) {
            throw new Error("Request failed");
        }

        const data = await res.json();
        return {
            name: data.name,
            currency_id: data.currency_id,
            created_at: new Date(data.created_at),
            token: tokenID,
        };
    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
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


export async function getGroupMembers(tokenID: string): Promise<GroupMember[]> {
    try {
        const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}/group_members`, {
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
        const members: GroupMember[] = data;
        return members;

    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
}

export async function renameGroupMembers(tokenID: string, members: GroupMember[]) {
    try {
        const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}/group_members`, {
            method: "PATCH",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(members)
        });

        if (!res.ok) {
            throw new Error(`Request failed ${res.status}`);
        }


    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
}

export async function deleteGroupMembers(tokenID: string, members: GroupMember[]) {
    if (members.length <= 0)
        return;
    try {
        const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}/group_members`, {
            method: "DELETE",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(members)
        });

        if (!res.ok) {
            throw new Error(`Request failed ${res.status}`);
        }


    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
}

export async function addGroupMembers(tokenID: string, members: string[]): Promise<GroupMember[]> {
    if (members.length <= 0)
        return [];
    try {
        const res = await fetch(`http://${getBackendURL()}/groups/${tokenID}/group_members`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(members)
        });

        if (!res.ok) {
            throw new Error(`Request failed ${res.status}`);
        }

        const data = await res.json();
        const new_members: GroupMember[] = data;
        return new_members;
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
        let url = `http://${getBackendURL()}/groups/${tokenID}/transactions`
        if (inTransaction.id && inTransaction.id > 0) {
            url += "/" + String(inTransaction.id);
        }
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

export async function deleteTransaction(tokenID: string, inTransactionID: number) {
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

