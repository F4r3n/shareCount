
export function getDecimalSeparator(locale?: Intl.Locale): string {
    const numberWithDecimalSeparator = 1.1;
    const r = Intl.NumberFormat(locale).formatToParts(numberWithDecimalSeparator).find(part => part.type === 'decimal')
    if (r) {
        return r.value
    }
    return "."
}

export function getLengthOfFraction(currency: string, locale?: Intl.Locale) : number {
  const numberFormatUSD = new Intl.NumberFormat(locale, { style: 'currency', currency });
  return numberFormatUSD.formatToParts(1)
    .find(part => part.type === "fraction")
    ?.value.length ?? 0;
}

export function getCurrencySymbol (currency: string, locale?: Intl.Locale) {
  return (0).toLocaleString(
    locale,
    {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }
  ).replace(/\d/g, '').trim()
}

