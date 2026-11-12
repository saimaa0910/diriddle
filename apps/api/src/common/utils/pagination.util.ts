import type { PaginatedResponse } from '@diriddle/shared-types';

export interface CursorPayload {
  id: string;
  createdAt: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string): CursorPayload | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed?.id === 'string' && typeof parsed?.createdAt === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildPaginatedResponse<T>(
  items: T[],
  limit: number,
  getCursor: (item: T) => CursorPayload,
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = pageItems[pageItems.length - 1];

  return {
    data: pageItems,
    next_cursor: hasMore && lastItem ? encodeCursor(getCursor(lastItem)) : null,
    has_more: hasMore,
  };
}
