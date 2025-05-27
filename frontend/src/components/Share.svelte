<script lang="ts">
    import { Share2Icon } from "lucide-svelte";
    let { url, title, text }: { url: string, title : string, text:string } = $props();

</script>

<button
    class="btn btn-ghost rounded-4xl"
    onclick={() => {
        const shareData = {
            title: title,
            text: text,
            url: url,
        };
        if (navigator.share) {
            navigator.share(shareData);
        } else {
            navigator.clipboard.writeText(shareData.url);
        }
    }}
>
    <Share2Icon></Share2Icon>
</button>
