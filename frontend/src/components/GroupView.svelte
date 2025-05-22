<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import type { Group, GroupMember } from "$lib/types";
    import { slide } from "svelte/transition";
    import { MENU, menus } from "$lib/menus";
    import { SvelteMap } from "svelte/reactivity";
    import { groupMembersProxy } from "../stores/group_members";
    import GroupViewMemberItem from "./GroupView_MemberItem.svelte";
    import { current_groupStore, groupsProxy } from "../stores/group";
    import { current_user, userProxy, users } from "../stores/groupUsernames";
    import { transactionsProxy } from "../stores/group_transactions";
    import { STATUS } from "../db/db";
    import Modal from "./Modal.svelte";
    import { type ModalButton } from "./ModalTypes";

    let {
        group,
        creating,
        onDone,
    }: {
        group: Group;
        creating: boolean;
        onDone: () => void;
    } = $props();
    let edit = $state(false);
    let modified_members: GroupMember[] = $state([]);
    let original_members: GroupMember[];
    let error_members: SvelteMap<string, string> = new SvelteMap();
    let group_modified = $state(structuredClone($state.snapshot(group)));
    let modal: Modal | null = $state(null);
    onMount(async () => {
        if (!creating) {
            await userProxy.synchronize_store(group.token);
            await groupMembersProxy.synchro_group_members(group.token);
            original_members = await groupMembersProxy.get_group_members(
                group.token,
            );
            await transactionsProxy.synchronize(group.token);
           clean();
            edit = !$current_user;
        } else {
            edit = true;
            members_to_add.push(create_unique_member());
        }
    });
    let members_to_delete: GroupMember[] = [];
    let members_to_add: GroupMember[] = $state([]);
    let check_validity = $derived(validate(modified_members, members_to_add));
    function clean() {
        modified_members = structuredClone(original_members);
        members_to_add = [];
        members_to_delete = [];
    }


    function create_unique_member(): GroupMember {
        let member_number = 1;
        let new_member = groupMembersProxy.create_group_member("New");
        let found = check_unicity(new_member.nickname);
        if (found) {
            return new_member;
        }
        while (!check_unicity(new_member.nickname + member_number)) {
            member_number += 1;
        }
        new_member.nickname = new_member.nickname + member_number;

        return new_member;
    }

    function check_unicity(inName: string): boolean {
        const inPending = members_to_add.some(
            (item) => item.nickname === inName,
        );
        const inModified = modified_members.some(
            (item) => item.nickname === inName,
        );
        return !(inPending || inModified);
    }

    function is_present_once(inName: string): boolean {
        let map = new Map();
        for (let member of members_to_add) {
            if (!map.has(member.nickname)) map.set(member.nickname, 1);
            else map.set(member.nickname, 1 + map.get(member.nickname));
        }

        for (let member of modified_members) {
            if (!map.has(member.nickname)) map.set(member.nickname, 1);
            else map.set(member.nickname, 1 + map.get(member.nickname));
        }
        return map.get(inName) === 1;
    }

    function validate(
        inMembersModified: GroupMember[],
        inMembersToAdd: GroupMember[],
    ): boolean {
        let set = new Set();
        for (let member of inMembersToAdd) {
            set.add(member.nickname);
        }

        for (let member of inMembersModified) {
            set.add(member.nickname);
        }
        return set.size === inMembersModified.length + inMembersToAdd.length;
    }

    function get_member_from_uuid(uuid: string): GroupMember | null {
        let member = members_to_add.find((value) => {
            return value.uuid === uuid;
        });
        if (member) return member;
        member = modified_members.find((value) => {
            return value.uuid === uuid;
        });
        if (member) return member;
        return null;
    }
</script>

<main
    class="flex flex-col w-full justify-center text-base md:text-md lg:text-lg"
>
    <div class="card bg-base-100 w-sm sm:w-md shadow-sm">
        <div class="card-body">
            <h1 class="card-title">{group_modified.name}</h1>
            {#if $current_user}
                <div class="card-body">
                    {`${get_member_from_uuid($current_user.member_uuid)?.nickname} (me)`}
                </div>
            {/if}
            <div class="card-actions justify-end">
                {#if creating}
                    <button
                        class="btn btn-error"
                        onclick={() => {
                            onDone();
                            clean();
                        }}
                        >Cancel
                    </button>
                {:else}
                    <button
                        class="btn btn-error"
                        onclick={() => {
                            modal?.open(
                                "Should I delete a a group",
                                {
                                    text: "Yes delete",
                                    callback: () => {
                                        groupsProxy.delete_local_group(
                                            group.token,
                                        );
                                        clean();
                                    },
                                } as ModalButton,
                                {
                                    text: "No forget",
                                    callback: () => {},
                                } as ModalButton,
                            );
                        }}
                        >Delete
                    </button>
                    <button
                        class="btn btn-primary"
                        onclick={() => {
                            edit = !edit;
                            if (edit) {
                                groupMembersProxy.local_synchronize(
                                    group.token,
                                );
                            }
                            clean();
                        }}
                        >Edit
                    </button>

                    <button
                        class="btn btn-primary"
                        disabled={!$current_user}
                        onclick={() => {
                            current_groupStore.set(group);
                            current_user.set($users[group.token]);
                            goto(
                                `${menus[MENU.EXPENSES].path}?id=${group.token}`,
                            );
                        }}
                        >Go
                    </button>
                {/if}
            </div>
        </div>
    </div>
    {#if edit}
        <div
            class="flex flex-col bg-base-100 w-sm sm:w-md shadow-sm pl-2"
            transition:slide
        >
            <fieldset class="fieldset">
                <legend class="fieldset-legend">Title</legend>
                <input
                    class="input input-ghost"
                    type="text"
                    bind:value={group_modified.name}
                    onchange={() => {}}
                />
            </fieldset>
            <fieldset class="fieldset">
                <legend class="fieldset-legend">Members</legend>
                {#each modified_members as member, id}
                    <GroupViewMemberItem
                        current_member={member}
                        {id}
                        error_message={error_members.get(member.uuid) ?? ""}
                        member_me={$current_user?.member_uuid ?? ""}
                        onDelete={() => {
                            members_to_delete.push(member);
                            modified_members.splice(id, 1);
                        }}
                        onChange={(member) => {
                            modified_members[id] = member;
                            if (!is_present_once(member.nickname)) {
                                error_members.set(
                                    member.uuid,
                                    "The name already exists",
                                );
                            } else {
                                error_members.delete(member.uuid);
                            }
                        }}
                        onMESelect={() => {
                            userProxy.set_user_group(group.token, member.uuid);
                        }}
                    ></GroupViewMemberItem>
                {/each}

                {#each members_to_add as member, id}
                    <GroupViewMemberItem
                        current_member={member}
                        {id}
                        error_message={error_members.get(member.uuid) ?? ""}
                        member_me={$current_user?.member_uuid ?? ""}
                        onDelete={() => {
                            members_to_add.splice(id, 1);
                        }}
                        onChange={(member) => {
                            members_to_add[id] = member;
                            if (!is_present_once(member.nickname)) {
                                error_members.set(
                                    member.uuid,
                                    "The name already exists",
                                );
                            } else {
                                error_members.delete(member.uuid);
                            }
                        }}
                        onMESelect={() => {
                            userProxy.set_user_group(group.token, member.uuid);
                        }}
                    ></GroupViewMemberItem>
                {/each}

                <button
                    class="btn"
                    onclick={() => {
                        members_to_add.push(create_unique_member());
                    }}>Add participant</button
                >
            </fieldset>

            <button
                class="btn btn-primary mt-5"
                disabled={!check_validity}
                onclick={async () => {
                    if (check_validity) {
                        edit = false;
                        onDone();
                        if (creating) {
                            await groupsProxy.add_new_local_group(
                                group_modified,
                            );
                            await groupMembersProxy.add_local_members(
                                group.token,
                                members_to_add,
                                STATUS.TO_CREATE,
                            );
                            await groupsProxy.synchronize();
                            await groupMembersProxy.synchro_group_members(
                                group.token,
                            );
                        } else {
                            console.log(members_to_add);
                            await userProxy.synchronize_store(group.token);
                            await groupsProxy.modify_local_group(
                                group_modified,
                            );
                            await groupMembersProxy.delete_local_members(
                                members_to_delete,
                            );
                            await groupMembersProxy.add_local_members(
                                group.token,
                                members_to_add,
                                STATUS.TO_CREATE,
                            );
                            await groupMembersProxy.rename_local_members(
                                modified_members,
                            );

                            original_members =
                                await groupMembersProxy.local_synchronize(
                                    group.token,
                                );
                            const member = original_members.find((value) => {
                                value.uuid == $current_user?.member_uuid;
                            });
                            if (member) {
                                userProxy.set_user_group(
                                    group.token,
                                    member.uuid,
                                );
                            }
                            try {
                                await groupMembersProxy.synchro_group_members(group.token);
                            } catch (e) {}
                        }

                        clean();
                    }
                }}
                >Validate
            </button>
        </div>
    {/if}
</main>
<Modal bind:this={modal}></Modal>

<style>
</style>
