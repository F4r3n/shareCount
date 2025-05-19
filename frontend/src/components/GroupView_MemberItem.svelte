<script lang="ts">
    import type { GroupMember } from "$lib/types";
    import { CheckIcon, XIcon } from "lucide-svelte";

    let {
        current_member,
        error_message,
        member_me,
        onDelete,
        onChange,
        onMESelect,
    }: {
        current_member: GroupMember;
        id: number;
        error_message: string;
        member_me: GroupMember;
        onDelete: () => void;
        onChange: (member: GroupMember) => void;
        onMESelect: () => void;
    } = $props();
</script>

<div class="join mt-2">
    <button
        class="btn-xs btn-ghost join-item rounded-full"
        onclick={() => {
            onDelete();
        }}><XIcon></XIcon></button
    >

    <div
        class=" {error_message != ""
            ? 'tooltip tooltip-open tooltip-top'
            : ''}"
        data-tip={error_message != ""
            ? error_message
            : ""}
    >
        <input
            type="text"
            class="input join-item {error_message != ""
                ? 'input-error'
                : 'input-ghost'}"
            bind:value={current_member.nickname}
            onchange={() => {
                onChange(current_member);
            }}
        />
    </div>

    {#if member_me.nickname == current_member.nickname}
        <div class="flex items-center align-middle">
            <CheckIcon></CheckIcon>
        </div>
    {:else}
        <button
            class="btn join-item rounded-full"
            onclick={() => {
                onMESelect();
            }}>Select</button
        >
    {/if}
</div>
