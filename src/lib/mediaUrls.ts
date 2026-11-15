/**
 * Normalizes message attachment metadata from the legacy text-backed media_urls column.
 * Database rows may contain JSON text (for example, "[]") while chat components
 * require a string array. Invalid or unsupported values safely become [].
 */
export function normalizeMediaUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    ).map((item) => item.trim());
  }

  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null') return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      ).map((item) => item.trim());
    }
    if (typeof parsed === 'string' && parsed.trim()) {
      return [parsed.trim()];
    }
    return [];
  } catch {
    // Backward compatibility for a legacy row containing one bare URL.
    return /^https?:\/\//i.test(trimmed) ? [trimmed] : [];
  }
}
