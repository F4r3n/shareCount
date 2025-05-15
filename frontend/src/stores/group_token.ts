// src/lib/stores/groupUsernames.ts
import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

const LOCAL_KEY = 'token_id';

function getTokenID(): string {
    if (!browser) return "";

    try {
        const stored = localStorage.getItem(LOCAL_KEY);
        if (!stored) return "";

        return stored;
    } catch {
        return "";
    }
}


export const group_tokenID: Writable<string> = writable(getTokenID());

// Persist changes to localStorage
if (browser) {
    group_tokenID.subscribe((value) => {
        localStorage.setItem(LOCAL_KEY, value);
    });
}



export function setGroupTokenID(groupId: string): void {
    group_tokenID.set(groupId);
}
