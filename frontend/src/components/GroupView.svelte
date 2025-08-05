<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import type { Group, GroupMember } from "$lib/types";
  import { slide } from "svelte/transition";
  import { MENU, menus } from "$lib/menus";
  import { groupMembersProxy } from "@stores/group_members";
  import GroupViewMemberItem from "./GroupView_MemberItem.svelte";
  import { current_groupStore, groupsProxy } from "@stores/group";
  import { current_user, userProxy, users } from "@stores/groupUsernames";
  import { transactionsProxy } from "@stores/group_transactions";
  import Modal from "./Modal.svelte";
  import { base } from "$app/paths";
  import { getBackendURL } from "$lib/shareCountAPI";
  import Share from "./Share.svelte";
  import CurrencySelector from "./CurrencySelector.svelte";
  import { fade } from "svelte/transition";

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
  let group_modified = $state(structuredClone($state.snapshot(group)));
  let modal: Modal | null = $state(null);
  let current_user_uuid = $state("");
  onMount(async () => {
    if (!creating) {
      clean();
      //The members are not there yet, but there were added before
      original_members = await groupMembersProxy.synchronize(group.token);
      modified_members = structuredClone(original_members);

      await userProxy.synchronize_store(group.token);
      current_user_uuid = $users[group.token]?.member_uuid ?? "";
    } else {
      edit = true;
      members_to_add.push(create_unique_member());
    }
  });
  let members_to_delete: GroupMember[] = [];
  let members_to_add: GroupMember[] = $state([]);
  let check_validity = $derived(validate(modified_members, members_to_add));
  function clean() {
    members_to_add = [];
    members_to_delete = [];
    group_modified = structuredClone($state.snapshot(group));
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
    const inPending = members_to_add.some((item) => item.nickname === inName);
    const inModified = modified_members.some(
      (item) => item.nickname === inName
    );
    return !(inPending || inModified);
  }

  function is_present_once(inName: string): boolean {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map();
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
    inMembersToAdd: GroupMember[]
  ): boolean {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const set = new Set();
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

  function build_share_url() {
    const newurl = `${window.location.origin}${base}/?url=${getBackendURL()}&id=${group.token}`;
    return newurl;
  }

  async function synchronize() {
    await groupMembersProxy.synchronize(group.token).then((members) => {
      original_members = members;
      modified_members = structuredClone(original_members);
    });

    transactionsProxy.synchronize(group.token);
  }
</script>

<main
  in:fade
  class="flex flex-col w-full justify-center text-base md:text-md lg:text-lg"
>
  <button
    type="button"
    class="grid grid-rows-2 bg-base-100 w-sm sm:w-md shadow-md p-4 rounded-md hover:shadow-lg cursor-pointer transition-shadow text-left focus:outline-none focus:ring-2 focus:ring-primary"
    onclick={() => {
      if (!edit && current_user_uuid) {
        current_groupStore.set(group);
        current_user.set($users[group.token]);
        goto(base + `${menus[MENU.EXPENSES].path}?id=${group.token}`);
      }
    }}
    disabled={edit || !current_user_uuid}
  >
    <h1
      class="row-start-1 text-xl font-semibold text-ellipsis whitespace-nowrap overflow-hidden"
    >
      {group_modified.name}
    </h1>

    {#if current_user_uuid}
      <div class="row-start-2 text-sm">
        {`${get_member_from_uuid(current_user_uuid)?.nickname} (me)`}
      </div>
    {:else}
      <div class="row-start-2 text-sm text-error">No user selected.</div>
    {/if}
  </button>
  <div class="flex flex-row gap-2 mt-2 justify-end w-sm sm:w-md">
    {#if creating}
      <button
        class="btn btn-error"
        onclick={() => {
          groupMembersProxy.delete_local_members_from_group(group.token);
          onDone();
          clean();
        }}
      >
        Cancel
      </button>
    {:else}
      <Share
        text="Welcome to your new trip"
        title={`sharecount to ${group_modified.name}`}
        url={build_share_url()}
      />
      <button
        class="btn btn-error"
        onclick={() => {
          modal?.open(
            "Should I delete this group?",
            {
              text: "Yes, delete",
              callback: () => {
                groupsProxy.delete_local_group(group.token);
                clean();
                onDone();
              },
            },
            {
              text: "No, cancel",
              callback: () => {},
            }
          );
        }}
      >
        Delete
      </button>
      <button
        class="btn btn-primary"
        onclick={() => {
          if (edit) {
            synchronize();
          }
          edit = !edit;

          clean();
        }}
      >
        {edit ? "Cancel Edit" : "Edit"}
      </button>
    {/if}
  </div>
  {#if edit}
    <div
      class="flex flex-col bg-base-100 w-sm sm:w-md shadow-sm"
      transition:slide
    >
      <div class="pl-2">
        <div class="flex flex-row">
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
            <legend class="fieldset-legend">Currency</legend>
            <CurrencySelector bind:current_currency={group_modified.currency_id}
            ></CurrencySelector>
          </fieldset>
        </div>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">Members</legend>
          {#each modified_members as member, id (member.uuid)}
            <GroupViewMemberItem
              current_member={member}
              member_me={current_user_uuid}
              onDelete={async () => {
                if (
                  await transactionsProxy.has_spent(group.token, member.uuid)
                ) {
                  return false;
                } else {
                  members_to_delete.push(member);
                  modified_members.splice(id, 1);
                }
                return true;
              }}
              onChange={(member) => {
                modified_members[id] = member;
                if (!is_present_once(member.nickname)) {
                  return false;
                }
                return true;
              }}
              onMESelect={() => {
                userProxy.set_user_group(group.token, member.uuid);
                current_user_uuid = member.uuid;
              }}
            ></GroupViewMemberItem>
          {/each}

          {#each members_to_add as member, id (member.uuid)}
            <GroupViewMemberItem
              current_member={member}
              member_me={current_user_uuid}
              onDelete={async () => {
                members_to_add.splice(id, 1);
                return true;
              }}
              onChange={(member) => {
                members_to_add[id] = member;
                if (!is_present_once(member.nickname)) {
                  return false;
                }
                return true;
              }}
              onMESelect={() => {
                userProxy.set_user_group(group.token, member.uuid);
                current_user_uuid = member.uuid;
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
      </div>

      <button
        class="btn btn-primary mt-5"
        disabled={!check_validity}
        onclick={async () => {
          if (check_validity) {
            edit = false;

            if (creating) {
              await groupsProxy.add_new_local_group(group_modified);
              await groupsProxy.synchronize();
              await groupMembersProxy.add_members(
                group.token,
                $state.snapshot(members_to_add)
              );
            } else {
              await userProxy.synchronize_store(group.token);
              await groupsProxy.modify_group(group_modified);
              await groupMembersProxy.delete_local_members(members_to_delete);
              await groupMembersProxy.add_members(group.token, members_to_add);
              await groupMembersProxy.rename_members(
                group.token,
                modified_members
              );
              original_members = await groupMembersProxy.get_group_members(
                group.token
              );
              const member = original_members.find((value) => {
                return value.uuid == current_user_uuid;
              });
              if (member) {
                userProxy.set_user_group(group.token, member.uuid);
              }
              try {
                await groupMembersProxy.synchronize(group.token);
              } catch (error) {
                console.error("Failed to synchronize group members:", error);
              }
            }
            onDone();
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
