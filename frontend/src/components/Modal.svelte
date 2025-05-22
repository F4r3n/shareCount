<script lang="ts">
    import type { ModalButton } from "./ModalTypes";

    let modal: HTMLDialogElement | null = $state(null);
    let title = $state("");
    let yesButton: ModalButton | null = $state(null);
    let noButton: ModalButton | null = $state(null);

    export function open(inTitle : string, yes : ModalButton, no : ModalButton) {
        yesButton = yes;
        noButton = no;
        title = inTitle
        modal?.showModal();
    }

    export function close() {
        modal?.close();
    }
</script>

<dialog
    id="my_modal_1"
    class="modal"
    bind:this={modal}
    aria-modal="true"
    aria-labelledby="modal-title"
    aria-describedby="modal-desc"
>
    <div class="modal-box w-full max-w-xs sm:max-w-lg p-6 rounded-lg">
        <h3 id="modal-title" class="text-lg font-bold">
            {title}
        </h3>
        <div class="modal-action flex flex-col sm:flex-row gap-2">
            {#if yesButton}
                <button
                    class="btn btn-error w-full sm:w-auto"
                    type="button"
                    onclick={yesButton.callback}
                >
                    {yesButton.text}
                </button>
            {/if}

            {#if noButton}
            <form method="dialog" class="w-full sm:w-auto">
                <button
                    class="btn w-full sm:w-auto"
                    type="submit"
                    onclick={noButton.callback}>{noButton.text}</button
                >
            </form>
            {/if}
        </div>
    </div>
</dialog>
