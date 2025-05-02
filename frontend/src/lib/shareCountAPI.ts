import type {Group, Transaction} from "./types"
const backendURL: string = import.meta.env.VITE_BACKEND_URL;

export async function getGroup(tokenID : string)  : Promise<Group> {
    try {
        const res = await fetch(`http://${backendURL}/groups/${tokenID}`, {
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
            currency: data.currency,
            created_at: new Date(data.created_at),
            token: tokenID,
        };
    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
}

export async function getTransactions(tokenID : string) : Promise<Transaction[]> {
    try {
        const res = await fetch(`http://${backendURL}/transactions/${tokenID}`, {
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
        let transactions: Transaction[] = data;
        return transactions;
        
    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
}


export async function getGroupMembers(tokenID : string) : Promise<string[]> {
    try {
        const res = await fetch(`http://${backendURL}/groups/${tokenID}/group_members`, {
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
        let members: string[] = data;
        return members;
        
    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
}

export async function updateTransaction(tokenID : string, inTransaction : Transaction) {
    try {
        console.log("UPDATE")
        const res = await fetch(`http://${backendURL}/groups/${tokenID}/transactions/${inTransaction.id}`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(inTransaction)
        });

        if (!res.ok) {
            throw new Error("Request failed");
        }
        
    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
}

