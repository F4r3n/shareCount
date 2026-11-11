import Big from "big.js";

/** Number of decimals kept when splitting an amount between debtors. */
export const SPLIT_DECIMALS = 10;


export function splitAmount(
  amount: Big,
  count: number,
  decimals: number = SPLIT_DECIMALS
): Big[] {
  if (count <= 0) return [];
  const base = amount.div(count).round(decimals, Big.roundDown);
  const last = amount.minus(base.times(count - 1));
  return [...Array(count - 1).fill(base), last];
}
