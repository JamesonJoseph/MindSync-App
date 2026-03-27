export function serializeDocument<T extends Record<string, unknown>>(doc: T | null | undefined): Record<string, unknown> {
  if (!doc) {
    return {};
  }

  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(doc)) {
    if (key === "_id" && value) {
      output[key] = String(value);
      continue;
    }

    output[key] = value instanceof Date ? value.toISOString() : value;
  }

  return output;
}

export function serializeDocuments<T extends Record<string, unknown>>(docs: T[]): Record<string, unknown>[] {
  return docs.map((doc) => serializeDocument(doc));
}
