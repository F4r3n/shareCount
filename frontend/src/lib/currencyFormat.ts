
export function getDecimalSeparator(locale?: Intl.LocalesArgument): string {
  const numberWithDecimalSeparator = 1.1;
  const r = Intl.NumberFormat(locale).formatToParts(numberWithDecimalSeparator).find(part => part.type === 'decimal')
  if (r) {
    return r.value
  }
  throw new Error("Invalid decimal")
}

export function getLengthOfFraction(currency: string, locale?: Intl.LocalesArgument): number {
  const numberFormatUSD = new Intl.NumberFormat(locale, { style: 'currency', currency });
  return numberFormatUSD.formatToParts(1)
    .find(part => part.type === "fraction")
    ?.value.length ?? 0;
}

export function getCurrencySymbol(currency: string, locale?: Intl.LocalesArgument) {
  let result = "";
  try {
    result = (0).toLocaleString(
      locale,
      {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }
    ).replace(/\d/g, '').trim()
  } catch {
    throw new Error("Invalid currency")
  }
  return result;
}

