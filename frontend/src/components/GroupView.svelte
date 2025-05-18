<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import type { Group, GroupMember } from "$lib/types";
    import { groupUsernames, setGroupMember } from "../stores/groupUsernames";
    import { slide } from "svelte/transition";
    import { CheckIcon, XIcon } from "lucide-svelte";
    import { MENU, menus } from "$lib/menus";
    import { group_tokenID, setGroupTokenID } from "../stores/group_token";
    import { SvelteMap } from "svelte/reactivity";
    import {
        add_local_members,
        create_group_member,
        delete_local_members,
        get_local_members,
        rename_local_members,
        synchro_group_members,
    } from "../stores/group_members";
    let {
        group,
    }: {
        group: Group;
    } = $props();
    let edit = $state(false);
    let modified_members: GroupMember[] = $state([]);
    let original_members: GroupMember[];
    let error_members: SvelteMap<string, string> = new SvelteMap();
    let member_me = $state({ nickname: "" } as GroupMember);
    onMount(async () => {
        console.log("Start synchro");
        original_members = await synchro_group_members(group.token);

        modified_members = structuredClone(original_members);
        member_me = $groupUsernames[group.token];
        if (!member_me) {
            member_me = {
                nickname: "",
                uuid: "",
                modified_at: new Date().toISOString().replace("Z", ""),
            };
        }
        edit = !member_me.nickname;
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
        let new_member = create_group_member("New");
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

    function validate(inMembersModified : GroupMember[], inMembersToAdd: GroupMember[]): boolean {
        let set = new Set();
        for (let member of inMembersToAdd) {
            set.add(member.nickname);
        }

        for (let member of inMembersModified) {
            set.add(member.nickname);
        }
        console.log(set.size, inMembersModified.length, inMembersToAdd.length);
        return set.size === inMembersModified.length + inMembersToAdd.length;
    }
</script>

<main
    class="flex flex-col w-full justify-center text-base md:text-md lg:text-lg"
>
    <div class="card bg-base-100 w-sm sm:w-md shadow-sm">
        <div class="card-body">
            <h1 class="card-title">{group.name}</h1>
            {#if member_me && member_me.nickname != ""}
                <div class="card-body">{`${member_me.nickname} (me)`}</div>
            {/if}
            <div class="card-actions justify-end">
                <button
                    class="btn btn-primary"
                    onclick={() => {
                        edit = !edit;
                        clean();
                    }}
                    >Edit
                </button>

                <button
                    class="btn btn-primary"
                    disabled={!member_me.nickname}
                    onclick={() => {
                        setGroupTokenID(group.token);
                        goto(`${menus[MENU.EXPENSES].path}?id=${group.token}`);
                    }}
                    >Go
                </button>
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
                    bind:value={group.name}
                />
            </fieldset>
            <fieldset class="fieldset">
                <legend class="fieldset-legend">Members</legend>
                {#each modified_members as member, id}
                    <div class="join mt-2">
                        <button
                            class="btn join-item rounded-r-full"
                            onclick={() => {
                                members_to_delete.push(member);
                                modified_members.splice(id, 1);
                            }}><XIcon></XIcon></button
                        >

                        <div
                            class=" {error_members.has(member.uuid)
                                ? 'tooltip tooltip-open tooltip-right'
                                : ''}"
                            data-tip={error_members.has(member.uuid)
                                ? error_members.get(member.uuid)
                                : ""}
                        >
                            <input
                                type="text"
                                class="input join-item {error_members.has(
                                    member.uuid,
                                )
                                    ? 'input-error'
                                    : 'input-ghost'}"
                                bind:value={member.nickname}
                                onchange={() => {
                                    if (!is_present_once(member.nickname)) {
                                        error_members.set(
                                            member.uuid,
                                            "The name already exists",
                                        );
                                    } else {
                                        error_members.delete(member.uuid);
                                    }
                                }}
                            />
                        </div>

                        {#if member_me.nickname == member.nickname}
                            <div class="flex items-center align-middle">
                                <CheckIcon></CheckIcon>
                            </div>
                        {:else}
                            <button
                                class="btn join-item rounded-r-full"
                                onclick={() => {
                                    member_me = member;
                                    setGroupMember(group.token, member);
                                }}>Select</button
                            >
                        {/if}
                    </div>
                {/each}

                {#each members_to_add as member, id}
                    <div class="join mt-2">
                        <button
                            class="btn join-item rounded-r-full"
                            onclick={() => {
                                members_to_add.splice(id, 1);
                            }}><XIcon></XIcon></button
                        >
                        <input
                            type="text"
                            class="input input-ghost join-item"
                            bind:value={members_to_add[id].nickname}
                        />

                        {#if member_me.nickname == members_to_add[id].nickname}
                            <div class="flex items-center align-middle">
                                <CheckIcon></CheckIcon>
                            </div>
                        {:else}
                            <button
                                class="btn join-item rounded-r-full"
                                onclick={() => {
                                    member_me.nickname = member.nickname;
                                    setGroupMember(group.token, member_me);
                                }}>Select</button
                            >
                        {/if}
                    </div>
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
                        await delete_local_members(members_to_delete);
                        await add_local_members($group_tokenID, members_to_add);
                        await rename_local_members(modified_members);
                        let members = await get_local_members($group_tokenID);
                        const member = members.find((value) => {
                            value.nickname == member_me.nickname;
                        });
                        if (member) {
                            member_me = member;
                            setGroupMember(group.token, member_me);
                        }

                        original_members = await synchro_group_members(
                            group.token,
                        );

                        clean();
                    }
                }}
                >Validate
            </button>
        </div>
    {/if}
</main>

<style>
</style>
