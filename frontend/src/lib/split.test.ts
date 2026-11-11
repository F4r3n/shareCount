import { describe, expect, it } from "vitest";
import Big from "big.js";
import { splitAmount } from "./split";

function sum(values: Big[]): Big {
  return values.reduce((acc, v) => acc.plus(v), new Big(0));
}

describe("splitAmount", () => {
  it("keeps decimals instead of rounding to cents", () => {
    const shares = splitAmount(new Big("10"), 3);
    expect(shares.map((s) => s.toString())).toEqual([
      "3.3333333333",
      "3.3333333333",
      "3.3333333334",
    ]);
    expect(sum(shares).eq(new Big("10"))).toBe(true);
  });

  it("splits evenly when divisible", () => {
    const shares = splitAmount(new Big("12.5"), 2);
    expect(shares.map((s) => s.toString())).toEqual(["6.25", "6.25"]);
  });

  it("always sums to the total", () => {
    for (const total of ["0.01", "100", "99.99", "1234.567"]) {
      for (let n = 1; n <= 7; ++n) {
        expect(sum(splitAmount(new Big(total), n)).eq(new Big(total))).toBe(true);
      }
    }
  });

  it("returns nothing for zero people", () => {
    expect(splitAmount(new Big("10"), 0)).toEqual([]);
  });
});
