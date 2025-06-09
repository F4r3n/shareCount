// src/lib/stores/__tests__/groupUsernames.test.ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { users, current_user, userProxy, type User } from './groupUsernames';
import { db } from '../db/db';

describe('groupUsernames store integration', () => {
    beforeEach(async () => {
        // Clear all database data before each test
        await db.user_data.clear();
        // Clear Svelte stores
        users.set({});
        current_user.set(null);
    });

    afterEach(async () => {
        // Clean up after tests
        await db.user_data.clear();
        users.set({});
        current_user.set(null);
    });



    describe('UserProxy', () => {
        it('adds a new user group if not present', async () => {
            await userProxy.set_user_group('g1', 'm1');
            const dbResult = await db.user_data.where('group_uuid').equals('g1').first();
            expect(dbResult).toMatchObject({ group_uuid: 'g1', member_uuid: 'm1' });
        });

        it('modifies an existing user group', async () => {
            await db.user_data.add({ group_uuid: 'g1', member_uuid: 'old' });
            await userProxy.set_user_group('g1', 'new');
            const dbResult = await db.user_data.where('group_uuid').equals('g1').first();
            expect(dbResult).toMatchObject({ group_uuid: 'g1', member_uuid: 'new' });
        });

        it('synchronizes the users store', async () => {
            await db.user_data.add({ group_uuid: 'g1', member_uuid: 'm1' });
            await userProxy.synchronize_store('g1');
            let storeValue: Record<string, User> = {};
            users.subscribe(v => storeValue = v)();
            expect(storeValue['g1']).toMatchObject({ group_uuid: 'g1', member_uuid: 'm1' });
        });

        it('get_user_group returns null if not found', async () => {
            const result = await userProxy.get_user_group('notfound');
            expect(result).toBeNull();
        });

        it('get_user_group returns correct user if found', async () => {
            await db.user_data.add({ group_uuid: 'g1', member_uuid: 'm1' });
            const result = await userProxy.get_user_group('g1');
            expect(result).toMatchObject({ group_uuid: 'g1', member_uuid: 'm1' });
        });
    });
});