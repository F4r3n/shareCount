<script lang="ts">
    import type { ModalButton } from "./ModalTypes";

    let modal: HTMLDialogElement | null = $state(null);
    let title = $state("");
    let message = $state("");
    let yesButton: ModalButton | null = $state(null);
    let noButton: ModalButton | null = $state(null);

    export function open(
        inTitle: string,
        yes: ModalButton,
        no: ModalButton,
        inMessage: string = "",
    ) {
        yesButton = yes;
        noButton = no;
        title = inTitle;
        message = inMessage;
        modal?.showModal();
    }

    export function close() {
        modal?.close();
    }
</script>

<dialog
    class="modal modal-bottom sm:modal-middle"
    bind:this={modal}
    aria-modal="true"
    aria-labelledby="modal-title"
>
    <div class="modal-box">
        <h3 id="modal-title" class="text-lg font-semibold">
            {title}
        </h3>
        {#if message}
            <p class="py-2 text-sm text-base-content/70">{message}</p>
        {/if}
        <div class="modal-action">
            {#if noButton}
                <form method="dialog">
                    <button
                        class="btn btn-ghost"
                        type="submit"
                        onclick={noButton.callback}>{noButton.text}</button
                    >
                </form>
            {/if}
            {#if yesButton}
                <button
                    class="btn {yesButton.variant === 'primary'
                        ? 'btn-primary'
                        : 'btn-error'}"
                    type="button"
                    onclick={yesButton.callback}
                >
                    {yesButton.text}
                </button>
            {/if}
        </div>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button aria-label="Close">close</button>
    </form>
</dialog>
