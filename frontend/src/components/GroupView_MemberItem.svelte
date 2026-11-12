<script lang="ts">
    import type { GroupMember } from "#lib/types";
    import { XIcon } from "@lucide/svelte";
    import { fade } from "svelte/transition";
    import { untrack } from "svelte";
    let {
        current_member,
        member_me,
        onDelete,
        onChange,
        onMESelect,
    }: {
        current_member: GroupMember;
        member_me: string;
        onDelete: () => Promise<boolean>;
        onChange: (member: GroupMember) => boolean;
        onMESelect: () => void;
    } = $props();

    let member = $state(
        untrack(() => structuredClone($state.snapshot(current_member))),
    );
    let error_message = $state("");
    let is_me = $derived(member_me == member.uuid);
</script>

<li class="px-4 py-2.5">
    <div class="flex items-center gap-2">
        <input
            type="text"
            class="input input-sm flex-1 min-w-0 {error_message
                ? 'input-error'
                : 'input-ghost'}"
            aria-label="Participant name"
            placeholder="Name"
            bind:value={member.nickname}
            onchange={() => {
                error_message = onChange(member)
                    ? ""
                    : "This name is empty or already used";
            }}
        />
        {#if is_me}
            <span class="badge badge-primary badge-soft shrink-0">Me</span>
        {:else}
            <button
                type="button"
                class="btn btn-ghost btn-xs shrink-0 text-base-content/60"
                onclick={onMESelect}
            >
                That's me
            </button>
        {/if}
        <button
            type="button"
            class="btn btn-ghost btn-sm btn-square shrink-0 text-base-content/50 hover:text-error"
            aria-label="Remove {member.nickname}"
            onclick={async () => {
                if (!(await onDelete())) {
                    error_message = "Has expenses, so it cannot be removed";
                    setTimeout(() => (error_message = ""), 2500);
                }
            }}
        >
            <XIcon size={16} />
        </button>
    </div>
    {#if error_message}
        <p class="pt-1 text-xs text-error" transition:fade={{ duration: 150 }}>
            {error_message}
        </p>
    {/if}
</li>
