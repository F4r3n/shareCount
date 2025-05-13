// src/lib/stores/groupUsernames.ts
import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { GroupMember } from '$lib/types';

const LOCAL_KEY = 'groupUsernames';
type GroupUsernames = Record<string, GroupMember>;

function getInitialUsernames(): GroupUsernames {
    if (!browser) return {};

    try {
        const stored = localStorage.getItem(LOCAL_KEY);
        if (!stored) return {};

        const parsed = JSON.parse(stored);
        return isValidGroupUsernames(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function isValidGroupUsernames(value: unknown): value is GroupUsernames {
    return typeof value === 'object' && value !== null &&
        Object.values(value).every(v => typeof v === 'string');
}

export const groupUsernames: Writable<GroupUsernames> = writable(getInitialUsernames());

// Persist changes to localStorage
if (browser) {
    groupUsernames.subscribe((value) => {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
    });
}

// Helper functions
export function getGroupMember(store: GroupUsernames, groupId: string): GroupMember {
    return store[groupId] || {nickname:""};
}

export function setGroupMember(groupId: string, member: GroupMember): void {
    groupUsernames.update(store => ({
        ...store,
        [groupId]: member
    }));
}
