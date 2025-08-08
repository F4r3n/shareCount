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
  let original_members: GroupMember[] = $state([]);
  let modal: Modal | null = $state(null);
  let current_user_uuid = $state("");
  onMount(async () => {
    original_members = await groupMembersProxy.synchronize(group.token);
  });

  function get_member_from_uuid(uuid: string): GroupMember | null {
    let member = original_members.find((value) => {
      return value.uuid === uuid;
    });

    if (member) return member;
    return null;
  }

  function build_share_url() {
    const newurl = `${window.location.origin}${base}/?url=${getBackendURL()}&id=${group.token}`;
    return newurl;
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
      {group.name}
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
    <Share
      text="Welcome to your new trip"
      title={`sharecount to ${group.name}`}
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
              onDone();
            },
          },
          {
            text: "No, cancel",
            callback: () => {},
          },
        );
      }}
    >
      Delete
    </button>
    <button
      class="btn btn-primary"
      onclick={() => {
        goto(base + `/group?id=${group.token}`);
      }}
    >
      {edit ? "Cancel Edit" : "Edit"}
    </button>
  </div>
</main>
<Modal bind:this={modal}></Modal>

<style>
</style>
