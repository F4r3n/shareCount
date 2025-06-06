
export function getUTC() : string {
    return new Date().toISOString().replace("Z", "")
}

export function formatDate(date : Date) : string {
    return date.toISOString().replace("Z", "")
}