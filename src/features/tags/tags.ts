// Tags are short lower-case words ("trip-goa"). These rules mirror the database check, so anything
// produced here is accepted by the server.

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 24;

/** "#Trip Goa!" -> "trip-goa". Returns null when nothing usable is left. */
export function normalizeTag(input: string): string | null {
  const tag = input
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, MAX_TAG_LENGTH)
    .replace(/[-_]+$/g, '');
  return tag.length > 0 ? tag : null;
}

/** Turns what the user typed ("#trip-goa food, work") into a clean, unique list of at most 10 tags. */
export function parseTagInput(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\s,]+/)) {
    const tag = normalizeTag(part);
    if (tag) seen.add(tag);
    if (seen.size === MAX_TAGS) break;
  }
  return [...seen];
}

/** Adds a tag to a list unless it is a duplicate or the list is full. */
export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return tags;
  return [...tags, tag];
}

export const removeTag = (tags: string[], tag: string) => tags.filter((t) => t !== tag);
