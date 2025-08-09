<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import type { Group, GroupMember } from "$lib/types";
  import { groupMembersProxy } from "@stores/group_members";
  import GroupViewMemberItem from "./GroupView_MemberItem.svelte";
  import { groupsProxy } from "@stores/group";
  import { userProxy, users } from "@stores/groupUsernames";
  import { transactionsProxy } from "@stores/group_transactions";
  import Modal from "./Modal.svelte";
  import { base } from "$app/paths";
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
    let new_member = groupMembersProxy.create_group_member("Name");
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
</script>

<div
  class="flex flex-col centered-editor-card w-full md:w-md max-w-full md:max-w-md"
  in:fade
>
  <div class="pl-2">
    <div class="flex flex-row">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Title</legend>
        <input
          class="input"
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
            if (await transactionsProxy.has_spent(group.token, member.uuid)) {
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
    class="btn btn-primary mt-5 w-full"
    disabled={!check_validity}
    onclick={async () => {
      if (check_validity) {
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
          await groupMembersProxy.rename_members(group.token, modified_members);
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
        goto(base + "/");
      }
    }}
    >Validate
  </button>
</div>

<Modal bind:this={modal}></Modal>

<style>
  .centered-editor-card {
    margin: 0 auto;
    max-width: 100vw;
    display: block;
  }
</style>
