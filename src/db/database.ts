import Dexie, { type Table } from 'dexie';
import type { Item } from '../types/item';
import type { Tag } from '../types/tag';
import type { Collection } from '../types/collection';

export interface BinaryBlobEntry {
  id: string; // filename / opfsPath
  blob: Blob;
  mimeType: string;
  createdAt: number;
}

export class KhoTriThucDB extends Dexie {
  items!: Table<Item, string>;
  tags!: Table<Tag, string>;
  collections!: Table<Collection, string>;
  blobs!: Table<BinaryBlobEntry, string>; // Fallback/Cache store for OPFS binary files

  constructor() {
    super('KhoTriThuc');
    this.version(1).stores({
      items: [
        'id',
        'type',
        'status',
        'isPinned',
        'savedAt',        // sort: Mới giữ
        'lastOpenedAt',   // sort: Mới mở
        'title',          // sort: Tiêu đề
        'createdAt',
        '*tags',          // multi-entry index
        '*collections',   // multi-entry index
      ].join(', '),
      tags: 'id, name, createdAt',
      collections: 'id, name, createdAt',
      blobs: 'id, mimeType, createdAt',
    });
  }
}

export const db = new KhoTriThucDB();
