import { collectionRepo } from '../db/repos/CollectionRepo';
import { db } from '../db/database';
import type { Collection } from '../types/collection';
import type { Item } from '../types/item';

class CollectionService {
  private pendingColPromises = new Map<string, Promise<Collection>>();

  async getAllCollections(): Promise<Collection[]> {
    return collectionRepo.getAll();
  }

  async getCollectionById(id: string): Promise<Collection | undefined> {
    return collectionRepo.getById(id);
  }

  async createCollection(name: string): Promise<Collection> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Tên bộ sưu tập không được để trống');
    }
    const key = trimmed.toLowerCase();

    // Prevent concurrent duplicate creation
    if (this.pendingColPromises.has(key)) {
      return this.pendingColPromises.get(key)!;
    }

    const promise = (async () => {
      try {
        const existing = await collectionRepo.getByName(trimmed);
        if (existing) {
          return existing;
        }
        const collection: Collection = {
          id: crypto.randomUUID(),
          name: trimmed,
          createdAt: Date.now(),
        };
        await collectionRepo.add(collection);
        return collection;
      } finally {
        this.pendingColPromises.delete(key);
      }
    })();

    this.pendingColPromises.set(key, promise);
    return promise;
  }

  async updateCollection(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Tên bộ sưu tập không được để trống');
    await collectionRepo.update(id, { name: trimmed });
  }

  async deleteCollection(id: string): Promise<void> {
    // Remove collection reference from all items
    const items = await db.items.where('collections').equals(id).toArray();
    for (const item of items) {
      const updated = item.collections.filter((c) => c !== id);
      await db.items.update(item.id, { collections: updated });
    }
    await collectionRepo.delete(id);
  }

  async getCollectionItems(collectionId: string): Promise<Item[]> {
    return db.items.where('collections').equals(collectionId).toArray();
  }

  async getCollectionItemCount(collectionId: string): Promise<number> {
    return db.items.where('collections').equals(collectionId).count();
  }

  async addItemToCollection(itemId: string, collectionId: string): Promise<void> {
    const item = await db.items.get(itemId);
    if (!item) return;
    const currentCols = item.collections || [];
    if (!currentCols.includes(collectionId)) {
      await db.items.update(itemId, {
        collections: Array.from(new Set([...currentCols, collectionId])),
      });
    }
  }

  async removeItemFromCollection(itemId: string, collectionId: string): Promise<void> {
    const item = await db.items.get(itemId);
    if (!item) return;
    await db.items.update(itemId, {
      collections: (item.collections || []).filter((c) => c !== collectionId),
    });
  }
}

export const collectionService = new CollectionService();

