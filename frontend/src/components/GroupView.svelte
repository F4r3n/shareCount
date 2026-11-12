<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import type { Group, GroupMember } from "#lib/types";
  import { MENU, menus } from "#lib/menus";
  import { groupMembersProxy } from "#stores/group_members";
  import { current_groupStore, groupsProxy } from "#stores/group";
  import Modal from "./Modal.svelte";
  import { resolve } from "$app/paths";
  import { getBackendURL } from "#lib/shareCountAPI";
  import Share from "./Share.svelte";
  import { fade } from "svelte/transition";
  import { PencilIcon, Trash2Icon } from "@lucide/svelte";
  import { userProxy, users, current_user } from "#stores/groupUsernames";
  let {
    group,
    onDone,
  }: {
    group: Group;
    onDone: () => void;
  } = $props();
  let edit = $state(false);
  let original_members: GroupMember[] = $state([]);
  let modal: Modal | null = $state(null);
  let current_user_uuid = $state("");
  let user_loaded = $state(false);
  onMount(async () => {
    await userProxy.synchronize_store(group.token);
    current_user_uuid = $users[group.token]?.member_uuid ?? "";
    user_loaded = true;

    original_members = await groupMembersProxy.get_local_members(group.token);
    groupMembersProxy.synchronize(group.token).then((members) => {
      original_members = members;
    });
  });

  function get_member_from_uuid(uuid: string): GroupMember | null {
    let member = original_members.find((value) => {
      return value.uuid === uuid;
    });

    if (member) return member;
    return null;
  }

  function build_share_url() {
    const params = new URLSearchParams({
      url: getBackendURL(),
      id: group.token,
    });
    return `${window.location.origin}${resolve("/")}?${params}`;
  }
</script>

<div
  in:fade
  class="flex items-center gap-2 bg-base-100 border border-base-300 rounded-box pr-2 transition-shadow hover:shadow-md"
>
  <button
    type="button"
    class="flex-1 min-w-0 flex items-center gap-3 p-4 text-left cursor-pointer rounded-box focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default"
    onclick={() => {
      if (edit || !user_loaded) return;
      if (current_user_uuid) {
        current_groupStore.set(group);
        current_user.set($users[group.token]);
        goto(resolve(`${menus[MENU.EXPENSES].path}?id=${group.token}`));
      } else {
        // No member chosen yet: open the settings to pick who "me" is.
        goto(resolve(`/group?id=${group.token}`));
      }
    }}
    disabled={edit}
  >
    <div class="min-w-0">
      <h2 class="font-semibold truncate">{group.name}</h2>
      {#if !user_loaded}
        <p class="text-sm text-base-content/60">&nbsp;</p>
      {:else if current_user_uuid}
        {@const me = get_member_from_uuid(current_user_uuid)}
        <p class="text-sm text-base-content/60 truncate">
          {#if me}You are {me.nickname}{/if}
          {#if me && original_members.length > 0}·{/if}
          {#if original_members.length > 0}
            {original_members.length}
            {original_members.length > 1 ? "members" : "member"}
          {/if}
        </p>
      {:else}
        <p class="text-sm text-warning-content dark:text-warning">
          Tap to choose who you are
        </p>
      {/if}
    </div>
  </button>

  <div class="flex items-center">
    <Share
      text="Welcome to your new trip"
      title={`sharecount to ${group.name}`}
      url={build_share_url()}
    />
    <button
      class="btn btn-ghost btn-circle btn-sm"
      aria-label="Edit group"
      title="Edit group"
      onclick={() => {
        goto(resolve(`/group?id=${group.token}`));
      }}
    >
      <PencilIcon size={18} />
    </button>
    <button
      class="btn btn-ghost btn-circle btn-sm text-error"
      aria-label="Delete group"
      title="Delete group"
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
          }
        );
      }}
    >
      <Trash2Icon size={18} />
    </button>
  </div>
</div>
<Modal bind:this={modal}></Modal>

