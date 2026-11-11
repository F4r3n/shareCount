export interface ModalButton {
    text: string,
    callback: () => void,
    /** Style of the confirm button (defaults to "error"). */
    variant?: "primary" | "error",
}
