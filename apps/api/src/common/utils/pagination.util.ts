import type { PaginatedResponse } from '@diriddle/shared-types';

export interface CursorPayload {
  id: string;
  createdAt?: string | Date;
  t?: string;
}

export function encodeCursor(createdAtOrPayload: Date | CursorPayload, id?: string): string {
  if (createdAtOrPayload instanceof Date) {
    return Buffer.from(
      JSON.stringify({ t: createdAtOrPayload.toISOString(), id: id ?? '' }),
    ).toString('base64url');
  }

  const payload = createdAtOrPayload;
  const dateStr =
    payload.t ??
    (payload.createdAt instanceof Date ? payload.createdAt.toISOString() : payload.createdAt);
  const date = dateStr ? new Date(dateStr) : new Date();
  return Buffer.from(
    JSON.stringify({ t: date.toISOString(), id: payload.id }),
  ).toString('base64url');
}

export function decodeCursor(cursor?: string | null): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    const t = parsed?.t ?? parsed?.createdAt;
    const id = parsed?.id;
    if (t && id) {
      const date = new Date(t);
      if (!isNaN(date.getTime())) {
        return { createdAt: date, id };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function buildPaginatedResponse<T>(
  items: T[],
  limit: number,
  getCursor: (item: T) => { id: string; createdAt: string | Date } | { createdAt: Date; id: string },
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = pageItems[pageItems.length - 1];

  let nextCursor: string | null = null;
  if (hasMore && lastItem) {
    const c = getCursor(lastItem);
    if ('createdAt' in c && c.createdAt !== undefined) {
      const date = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt);
      nextCursor = encodeCursor(date, c.id);
    } else {
      nextCursor = encodeCursor(c as any);
    }
  }

  return {
    data: pageItems,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

