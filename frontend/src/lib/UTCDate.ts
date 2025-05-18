
export function getUTC() : string {
    return new Date().toISOString().replace("Z", "")
}