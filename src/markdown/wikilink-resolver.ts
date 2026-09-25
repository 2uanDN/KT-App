import { db } from '../db/database';
import type { Item } from '../types/item';

export interface WikiLinkMatch {
  raw: string;
  target: string;
  alias?: string;
}

export const extractWikiLinks = (markdown: string): WikiLinkMatch[] => {
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const matches: WikiLinkMatch[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    matches.push({
      raw: match[0],
      target: match[1].trim(),
      alias: match[2]?.trim(),
    });
  }
  return matches;
};

export const resolveWikiLink = async (target: string): Promise<Item | null> => {
  // First attempt: ID lookup
  const byId = await db.items.get(target);
  if (byId) return byId;

  // Second attempt: Title lookup (case-insensitive)
  const allItems = await db.items.toArray();
  const lowerTarget = target.toLowerCase();
  const byTitle = allItems.find(
    (item) => item.title.toLowerCase() === lowerTarget
  );
  return byTitle || null;
};
