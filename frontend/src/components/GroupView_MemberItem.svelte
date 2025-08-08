<script lang="ts">
    import type { GroupMember } from "$lib/types";
    import { CheckIcon, XIcon } from "lucide-svelte";
    import { fade } from "svelte/transition";
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
    let member = $state(structuredClone($state.snapshot(current_member)));
    let error_message = $state("");
</script>

<div class="join mt-2 items-center">
    <button
        class="btn-xs join-item rounded-full hover:cursor-pointer"
        onclick={async () => {
            let result = await onDelete();
            if (!result) error_message = "Cannot be deleted";
            setTimeout(() => {
                error_message = "";
            }, 1000);
        }}><XIcon></XIcon></button
    >
    {#if error_message}
        <div
            out:fade={{ duration: 200 }}
            class=" {error_message != ''
                ? 'tooltip tooltip-open tooltip-top left-10 text-center'
                : ''}"
            data-tip={error_message != "" ? error_message : ""}
        ></div>
    {/if}
    <input
        type="text"
        class="input join-item {error_message != ''
            ? 'input-error'
            : 'input'}"
        bind:value={member.nickname}
        onchange={() => {
            let result = onChange(member);
            if (!result) error_message = "The name is invalid";
            setTimeout(() => {
                error_message = "";
            }, 1000);
        }}
    />

    {#if member_me == member.uuid}
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
