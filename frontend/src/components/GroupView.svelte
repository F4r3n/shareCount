<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import type { Group, GroupMember } from "$lib/types";
    import { groupUsernames, setGroupMember } from "../stores/groupUsernames";
    import {
        addGroupMembers,
        deleteGroupMembers,
        getGroupMembers,
        renameGroupMembers,
    } from "$lib/shareCountAPI";
    import { slide } from "svelte/transition";
    import { CheckIcon, XIcon } from "lucide-svelte";
    import { MENU, menus } from "$lib/menus";
    import { setGroupTokenID } from "../stores/group_token";
    let {
        group,
    }: {
        group: Group;
    } = $props();
    let edit = $state(false);
    let modified_members: GroupMember[] = $state([]);
    let original_members: GroupMember[];
    let member_me = $state({ nickname: "" } as GroupMember);
    onMount(async () => {
        original_members = await getGroupMembers(group.token);
        modified_members = structuredClone(original_members);
        member_me = $groupUsernames[group.token];
        if(!member_me) {
            member_me = { nickname: "" };
        }
        edit = !member_me.nickname;
    });
    let members_to_delete: GroupMember[] = [];
    let members_to_add: string[] = $state([]);

    function clean() {
        modified_members = structuredClone(original_members);
        members_to_add = [];
        members_to_delete = [];
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
                        <input
                            type="text"
                            class="input input-ghost join-item"
                            bind:value={member.nickname}
                        />
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
                            bind:value={members_to_add[id]}
                        />

                        {#if member_me.nickname == members_to_add[id]}
                            <div class="flex items-center align-middle">
                                <CheckIcon></CheckIcon>
                            </div>
                        {:else}
                            <button
                                class="btn join-item rounded-r-full"
                                onclick={() => {
                                    member_me.nickname = member;
                                    setGroupMember(group.token, member_me);
                                }}>Select</button
                            >
                        {/if}
                    </div>
                {/each}

                <button
                    class="btn"
                    onclick={() => {
                        members_to_add.push("New");
                    }}>Add participant</button
                >
            </fieldset>

            <button
                class="btn btn-primary mt-5"
                onclick={async () => {
                    edit = false;
                    await deleteGroupMembers(group.token, members_to_delete);
                    let result = await addGroupMembers(
                        group.token,
                        members_to_add,
                    );
                    const member = result.find((value) => {
                        value.nickname == member_me.nickname;
                    });
                    if (member) {
                        member_me = member;
                        setGroupMember(group.token, member_me);
                    }
                    await renameGroupMembers(group.token, modified_members);
                    clean();
                }}
                >Validate
            </button>
        </div>
    {/if}
</main>

<style>
</style>
