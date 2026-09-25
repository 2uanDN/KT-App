import MiniSearch, { type SearchResult } from 'minisearch';
import type { Item, NoteItem, FileItem, LinkItem } from '../types/item';
import { db } from '../db/database';

export interface SearchFilter {
  type?: string;
  status?: string;
}

export interface IndexedDocument {
  id: string;
  type: string;
  status: string;
  title: string;
  body?: string;
  caption?: string;
  reason?: string;
  originalFilename?: string;
  domain?: string;
}

class SearchService {
  private index: MiniSearch<IndexedDocument>;
  private isInitialized = false;

  constructor() {
    this.index = new MiniSearch<IndexedDocument>({
      fields: ['title', 'body', 'caption', 'reason', 'originalFilename', 'domain'],
      storeFields: ['id', 'type', 'status', 'title'],
      searchOptions: {
        boost: {
          title: 3,
          body: 1,
          caption: 2,
          reason: 2,
          originalFilename: 1.5,
          domain: 1,
        },
        fuzzy: 0.2,
        prefix: true,
      },
      tokenize: (text: string) =>
        text
          .toLowerCase()
          .normalize('NFC')
          .split(/[\s\-_,.!?;:()[\]'"]+/)
          .filter(Boolean),
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const items = await db.items.toArray();
      this.index.removeAll();
      if (items.length > 0) {
        this.index.addAll(items.map((item) => this.toDocument(item)));
      }
      this.isInitialized = true;
    } catch (err) {
      console.error('Failed to initialize search index:', err);
    }
  }

  async add(item: Item): Promise<void> {
    await this.initialize();
    try {
      if (this.index.has(item.id)) {
        this.index.discard(item.id);
      }
      this.index.add(this.toDocument(item));
    } catch {
      // Ignored
    }
  }

  async update(item?: Item | null): Promise<void> {
    if (!item) return;
    await this.initialize();
    try {
      if (this.index.has(item.id)) {
        this.index.discard(item.id);
      }
      this.index.add(this.toDocument(item));
    } catch {
      // Ignored
    }
  }

  async remove(id: string): Promise<void> {
    await this.initialize();
    try {
      if (this.index.has(id)) {
        this.index.discard(id);
      }
    } catch {
      // Ignored
    }
  }

  search(query: string, filter?: SearchFilter): SearchResult[] {
    if (!query.trim()) return [];
    try {
      let results = this.index.search(query.trim());
      if (filter?.type && filter.type !== 'all') {
        results = results.filter((r) => r.type === filter.type);
      }
      if (filter?.status) {
        results = results.filter((r) => r.status === filter.status);
      }
      return results;
    } catch {
      return [];
    }
  }

  toDocument(item: Item): IndexedDocument {
    const base: IndexedDocument = {
      id: item.id,
      type: item.type,
      status: item.status,
      title: item.title || '',
    };
    if (item.type === 'note') {
      base.body = (item as NoteItem).body || '';
    } else if (item.type === 'file') {
      const fi = item as FileItem;
      base.caption = fi.caption || '';
      if (fi.files && fi.files.length > 0) {
        base.originalFilename = fi.files.map((f) => f.originalFilename).join(' ');
      } else {
        base.originalFilename = fi.originalFilename || '';
      }
    } else if (item.type === 'link') {
      base.reason = (item as LinkItem).reason || '';
      base.domain = (item as LinkItem).domain || '';
    }
    return base;
  }
}

export const searchService = new SearchService();
