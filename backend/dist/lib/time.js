export function utcNow() {
    return new Date();
}
export function parseIsoDateTime(value) {
    if (!value || typeof value !== "string") {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
