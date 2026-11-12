<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { goto } from "$app/navigation";
  import type { Group, GroupMember } from "#lib/types";
  import { groupMembersProxy } from "#stores/group_members";
  import GroupViewMemberItem from "./GroupView_MemberItem.svelte";
  import { groupsProxy } from "#stores/group";
  import { userProxy, users } from "#stores/groupUsernames";
  import { transactionsProxy } from "#stores/group_transactions";
  import Modal from "./Modal.svelte";
  import { resolve } from "$app/paths";
  import CurrencySelector from "./CurrencySelector.svelte";
  import { fade } from "svelte/transition";
  import { CircleAlertIcon, PlusIcon } from "@lucide/svelte";

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
  let group_modified = $state(
    untrack(() => structuredClone($state.snapshot(group)))
  );
  let modal: Modal | null = $state(null);
  let current_user_uuid = $state("");
  onMount(async () => {
    if (!creating) {
      clean();
      //The members are not there yet, but there were added before
      original_members = await groupMembersProxy.get_local_members(group.token);
      modified_members = structuredClone(original_members);

      await userProxy.synchronize_store(group.token);
      current_user_uuid = $users[group.token]?.member_uuid ?? "";
    } else {
      members_to_add.push(create_unique_member());
      // Default "me" to the first participant so the new group can be opened.
      current_user_uuid = members_to_add[0].uuid;
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
    while (!check_unicity(`Person ${member_number}`)) {
      member_number += 1;
    }
    return groupMembersProxy.create_group_member(`Person ${member_number}`);
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
    return inName.trim() !== "" && map.get(inName) === 1;
  }

  function validate(
    inMembersModified: GroupMember[],
    inMembersToAdd: GroupMember[]
  ): boolean {
    const all = [...inMembersToAdd, ...inMembersModified];
    if (all.some((member) => member.nickname.trim() === "")) return false;
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

<main
  class="mx-auto w-full max-w-2xl px-4 pt-4 pb-32 flex flex-col gap-4"
  in:fade
>
  <h1 class="px-1 text-2xl font-semibold tracking-tight">
    {creating ? "New group" : "Edit group"}
  </h1>

  <section
    class="bg-base-100 border border-base-300 rounded-box p-4 grid gap-4 sm:grid-cols-[1fr_11rem]"
  >
    <label class="flex flex-col gap-1.5 min-w-0">
      <span class="text-sm font-medium text-base-content/70">Name</span>
      <input
        class="input w-full"
        type="text"
        placeholder="Trip to Lisbon, flatmates…"
        maxlength="250"
        bind:value={group_modified.name}
      />
    </label>
    <label class="flex flex-col gap-1.5 min-w-0">
      <span class="text-sm font-medium text-base-content/70">Currency</span>
      <CurrencySelector
        class="w-full"
        bind:current_currency={group_modified.currency_id}
      ></CurrencySelector>
    </label>
  </section>

  <section class="bg-base-100 border border-base-300 rounded-box">
    <div class="flex items-baseline justify-between px-4 pt-4 pb-1">
      <h2 class="font-semibold">Participants</h2>
      <span class="text-sm text-base-content/55">
        {modified_members.length + members_to_add.length}
        {modified_members.length + members_to_add.length === 1
          ? "person"
          : "people"}
      </span>
    </div>
    <p class="px-4 pb-2 text-sm text-base-content/60">
      Pick which one is you to see your own balance.
    </p>
    <ul class="divide-y divide-base-300 border-t border-base-300">
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
    </ul>
    <button
      type="button"
      class="btn btn-ghost w-full justify-start gap-2 rounded-t-none border-t border-base-300 px-4 h-12 font-normal text-primary"
      onclick={() => {
        members_to_add.push(create_unique_member());
      }}
    >
      <PlusIcon size={18} />
      Add participant
    </button>
  </section>

  {#if !check_validity}
    <div role="alert" class="alert alert-error alert-soft">
      <CircleAlertIcon size={20} />
      <span>Each participant needs a unique, non-empty name.</span>
    </div>
  {/if}

  <div
    class="fixed inset-x-0 bottom-0 z-10 bg-base-100/90 backdrop-blur border-t border-base-300 pb-[env(safe-area-inset-bottom)]"
  >
    <div class="mx-auto max-w-2xl px-4 py-3 flex items-center gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => goto(resolve("/"))}
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary ml-auto px-8"
        disabled={!check_validity}
        onclick={async () => {
          if (check_validity) {
            if (creating) {
              await groupsProxy.add_new_local_group(group_modified);
              groupsProxy.synchronize();
              await groupMembersProxy.add_members(
                group.token,
                $state.snapshot(members_to_add)
              );
              if (
                members_to_add.some((member) => member.uuid === current_user_uuid)
              ) {
                await userProxy.set_user_group(group.token, current_user_uuid);
              }
            } else {
              await userProxy.synchronize_store(group.token);
              await groupsProxy.modify_group(group_modified);
              await groupMembersProxy.delete_local_members(members_to_delete);
              await groupMembersProxy.add_members(group.token, members_to_add);
              await groupMembersProxy.rename_members(modified_members);
              original_members = await groupMembersProxy.get_group_members(
                group.token
              );
              const member = original_members.find((value) => {
                return value.uuid == current_user_uuid;
              });
              if (member) {
                userProxy.set_user_group(group.token, member.uuid);
              }
              groupMembersProxy.synchronize(group.token);
            }
            onDone();
            clean();
            goto(resolve("/"));
          }
        }}
        >{creating ? "Create group" : "Save"}
      </button>
    </div>
  </div>
</main>

<Modal bind:this={modal}></Modal>

