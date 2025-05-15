<script lang="ts">
    import type { ModalButton } from "./ModalTypes";
    let {
        title,
        yesButton,
        noButton,
    }: {
        title : string
        yesButton: ModalButton;
        noButton: ModalButton;
    } = $props();
    let modal : HTMLDialogElement | null = $state(null);
    export function open() {
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
            <button
                class="btn btn-error w-full sm:w-auto"
                type="button"
                onclick={yesButton.callback}
            >
                {yesButton.text}
            </button>
            <form method="dialog" class="w-full sm:w-auto">
                <button
                    class="btn w-full sm:w-auto"
                    type="submit"
                    onclick={noButton.callback}>{noButton.text}</button
                >
            </form>
        </div>
    </div>
</dialog>
