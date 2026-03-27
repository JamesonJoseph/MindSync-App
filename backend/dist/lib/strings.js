export function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
export function normalizeForCache(value) {
    return normalizeWhitespace(value).toLowerCase();
}
export function truncate(value, maxLength) {
    return value.length <= maxLength ? value : value.slice(0, maxLength);
}
