import { db } from '../database';
import type { Item, NoteItem } from '../../types/item';

export class ItemRepo {
  async getById(id: string): Promise<Item | undefined> {
    return db.items.get(id);
  }

  async getAll(): Promise<Item[]> {
    return db.items.toArray();
  }

  async getByStatus(status: 'saved' | 'inbox'): Promise<Item[]> {
    return db.items.where('status').equals(status).toArray();
  }

  async getSaved(): Promise<Item[]> {
    return this.getByStatus('saved');
  }

  async getInbox(): Promise<Item[]> {
    return this.getByStatus('inbox');
  }

  async add(item: Item): Promise<string> {
    return db.items.add(item);
  }

  async update(id: string, patch: Partial<Item>): Promise<number> {
    return db.items.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    return db.items.delete(id);
  }

  async getByTag(tagId: string): Promise<Item[]> {
    return db.items.where('tags').equals(tagId).toArray();
  }

  async getByCollection(collectionId: string): Promise<Item[]> {
    return db.items.where('collections').equals(collectionId).toArray();
  }

  async getAllNotes(): Promise<NoteItem[]> {
    const items = await db.items.where('type').equals('note').toArray();
    return items as NoteItem[];
  }
}

export const itemRepo = new ItemRepo();
