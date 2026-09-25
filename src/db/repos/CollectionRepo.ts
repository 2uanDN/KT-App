import { db } from '../database';
import type { Collection } from '../../types/collection';

export class CollectionRepo {
  async getById(id: string): Promise<Collection | undefined> {
    return db.collections.get(id);
  }

  async getByName(name: string): Promise<Collection | undefined> {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return undefined;
    const all = await db.collections.toArray();
    return all.find((c) => c.name.trim().toLowerCase() === trimmed);
  }

  async getAll(): Promise<Collection[]> {
    return db.collections.orderBy('createdAt').reverse().toArray();
  }

  async add(collection: Collection): Promise<string> {
    return db.collections.add(collection);
  }

  async update(id: string, patch: Partial<Collection>): Promise<number> {
    return db.collections.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    return db.collections.delete(id);
  }
}

export const collectionRepo = new CollectionRepo();

