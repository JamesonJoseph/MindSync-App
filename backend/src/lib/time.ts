export function utcNow(): Date {
  return new Date();
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseIsoDateTime(value?: unknown): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parsedDateOnly = parseDateOnly(value);
  if (parsedDateOnly) {
    return parsedDateOnly;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeAllDayDate(value?: unknown): Date | null {
  const parsed = parseIsoDateTime(value);
  if (!parsed) {
    return null;
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0, 0));
}
