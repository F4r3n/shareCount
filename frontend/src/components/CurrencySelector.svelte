<script lang="ts">
    import { getCurrencySymbol } from "$lib/currencyFormat";
    let {
        current_currency = $bindable(),
        onChange,
        class: className = "",
    }: {
        current_currency: string;
        onChange?: (value: string) => void;
        class?: string;
    } = $props();

    let list_currencies = Intl.supportedValuesOf("currency");
</script>

<select
    class="select {className}"
    aria-label="Currency"
    bind:value={current_currency}
    onchange={() => {
        if (onChange) {
            onChange(current_currency);
        }
    }}
>
    <option selected
        >{current_currency} {getCurrencySymbol(current_currency)}</option
    >
    {#each list_currencies as currency (currency)}
        {@const symbol = getCurrencySymbol(currency)}
        {#if symbol !== currency}
            <option value={currency}>{currency} {symbol}</option>
        {:else}
            <option value={currency}>{currency}</option>
        {/if}
    {/each}
</select>
