
export function getUTC() : string {
    return new Date().toISOString().replace("Z", "")
}

export function formatDate(date : Date) : string {
    return date.toISOString().replace("Z", "")
}
/**
 * Timestamp (ms) of a stored UTC date such as "2026-11-11T09:05:03.000000".
 * Also accepts older unpadded values like "2026-11-11T9:5:3.000000".
 */
export function parseUTC(value: string): number {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d+))?)?)?/.exec(value);
    if (!m) return 0;
    const [, y, mo, d, h = "0", mi = "0", se = "0", frac = "0"] = m;
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, +se, Math.floor(Number(`0.${frac}`) * 1000));
}

/** Local Date for a "YYYY-MM-DD" day, without the UTC shift of `new Date("YYYY-MM-DD")`. */
export function localDay(day: string): Date {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d);
}
