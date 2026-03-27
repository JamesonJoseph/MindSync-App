export function serializeDocument(doc) {
    if (!doc) {
        return {};
    }
    const output = {};
    for (const [key, value] of Object.entries(doc)) {
        if (key === "_id" && value) {
            output[key] = String(value);
            continue;
        }
        output[key] = value instanceof Date ? value.toISOString() : value;
    }
    return output;
}
export function serializeDocuments(docs) {
    return docs.map((doc) => serializeDocument(doc));
}
