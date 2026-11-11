<script lang="ts">
    import { CheckIcon, Share2Icon } from "lucide-svelte";
    import { onDestroy } from "svelte";
    let { url, title, text }: { url: string; title: string; text: string } =
        $props();

    let feedback = $state("");
    let timer: ReturnType<typeof setTimeout> | undefined;
    onDestroy(() => clearTimeout(timer));

    function show(message: string) {
        feedback = message;
        clearTimeout(timer);
        timer = setTimeout(() => (feedback = ""), 1800);
    }

    async function share() {
        const shareData = { title, text, url };
        if (navigator.share && navigator.canShare?.(shareData) !== false) {
            try {
                await navigator.share(shareData);
                return;
            } catch (e) {
                // The user closed the share sheet: nothing to do.
                if (e instanceof DOMException && e.name === "AbortError") return;
                // Otherwise fall back to copying the link.
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            show("Link copied");
        } catch {
            // Clipboard unavailable (e.g. plain http): let the user copy it.
            window.prompt("Copy this link to invite people:", url);
        }
    }
</script>

<div class={feedback ? "tooltip tooltip-open tooltip-bottom" : ""} data-tip={feedback}>
    <button
        class="btn btn-ghost btn-circle btn-sm"
        aria-label="Share group"
        title="Share group"
        onclick={share}
    >
        {#if feedback}
            <CheckIcon size={18} class="text-success"></CheckIcon>
        {:else}
            <Share2Icon size={18}></Share2Icon>
        {/if}
    </button>
</div>
