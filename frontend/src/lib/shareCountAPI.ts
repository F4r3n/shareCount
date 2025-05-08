import type {Group, Transaction, GroupMember} from "./types"
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
            currency_id: data.currency_id,
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
        const res = await fetch(`http://${backendURL}/groups/${tokenID}/transactions`, {
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
        let transactions: Transaction[] = data;
        console.log(transactions);
        return transactions;
        
    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
}


export async function getGroupMembers(tokenID : string) : Promise<GroupMember[]> {
    try {
        const res = await fetch(`http://${backendURL}/groups/${tokenID}/group_members`, {
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
        let members: GroupMember[] = data;
        return members;
        
    } catch (err) {
        console.error("Error:", err);
        throw err; // re-throw so the caller can handle the error
    }
}

export async function updateTransaction(tokenID : string, inTransaction : Transaction) {
    try {
        console.log("UPDATE")
        let url = `http://${backendURL}/groups/${tokenID}/transactions`
        if(inTransaction.id > 0) {
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

export async function deleteTransaction(tokenID : string, inTransactionID : number) {
    try {
        console.log("UPDATE")
        const res = await fetch(`http://${backendURL}/groups/${tokenID}/transactions/${inTransactionID}`, {
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

