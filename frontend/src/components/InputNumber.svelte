<script lang="ts">
    import { getDecimalSeparator } from "$lib/currencyFormat";

    let {
        is_editing,
        number_decimal = undefined,
        title,
        onChange,
        value = $bindable(),
    }: {
        is_editing: boolean;
        number_decimal?: number;
        title: string;
        onChange?: (value: string, valid: boolean) => void;
        value: string;
    } = $props();
    const decimal = "\\" + getDecimalSeparator();
    function create_regex(number_decimal: number | undefined) {
        console.log(number_decimal);
        if (number_decimal === undefined) {
            return `[0-9]+(${decimal}[0-9]+)?`;
        } else if (number_decimal === 0) {
            return "[0-9]+";
        } else {
            return `[0-9]+(${decimal}[0-9]{1,${number_decimal}})?`;
        }
    }
    const regex = create_regex(number_decimal);
    let input: HTMLInputElement | null = null;
</script>

<input
    bind:this={input}
    readonly={!is_editing}
    {title}
    type="text"
    inputmode="numeric"
    placeholder="0"
    pattern={regex}
    class="input validator input-ghost md:input-md lg:input-lg"
    bind:value
    onchange={() => {
        if (onChange) {
            onChange(value, input?.validity.valid ?? false);
        }
    }}
/>
<p class="m-2 validator-hint">Must be a number</p>
