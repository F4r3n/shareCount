<script lang="ts">
    import { getDecimalSeparator } from "$lib/currencyFormat";

    let {
        is_editing,
        number_decimal = 2,
        title,
        onChange,
        value = $bindable(),
    }: {
        is_editing: boolean;
        number_decimal?: number;
        title: string;
        onChange?: (value: string) => void;
        value: string;
    } = $props();
    const decimal = "\\" + getDecimalSeparator()
    const regex =
        number_decimal === 0
            ? "[0-9]+"
            : `[0-9]+(${decimal}[0-9]{1,${number_decimal}})?`;
</script>

<input
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
            onChange(value);
        }
    }}
/>
<p class="m-2 validator-hint">Must be a number</p>
