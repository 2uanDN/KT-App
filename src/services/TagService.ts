import { tagRepo } from '../db/repos/TagRepo';
import { db } from '../db/database';
import type { Tag } from '../types/tag';

class TagService {
  private pendingTagPromises = new Map<string, Promise<Tag>>();

  normalizeTagName(name: string): string {
    return name.toLowerCase().trim().replace(/^#+/, '').replace(/\s+/g, '-');
  }

  async getAllTags(): Promise<Tag[]> {
    return tagRepo.getAll();
  }

  async getTagById(id: string): Promise<Tag | undefined> {
    return tagRepo.getById(id);
  }

  async getOrCreateTag(rawName: string): Promise<Tag> {
    const clean = this.normalizeTagName(rawName);
    if (!clean) {
      throw new Error('Tên thẻ không hợp lệ');
    }

    // Reuse existing in-flight creation promise to prevent concurrency race conditions
    if (this.pendingTagPromises.has(clean)) {
      return this.pendingTagPromises.get(clean)!;
    }

    const promise = (async () => {
      try {
        const existing = await tagRepo.getByName(clean);
        if (existing) return existing;

        const newTag: Tag = {
          id: crypto.randomUUID(),
          name: clean,
          createdAt: Date.now(),
        };
        await tagRepo.add(newTag);
        return newTag;
      } finally {
        this.pendingTagPromises.delete(clean);
      }
    })();

    this.pendingTagPromises.set(clean, promise);
    return promise;
  }

  async deleteTag(id: string): Promise<void> {
    // Remove tag reference from all items
    const items = await db.items.where('tags').equals(id).toArray();
    for (const item of items) {
      const updatedTags = item.tags.filter((t) => t !== id);
      await db.items.update(item.id, { tags: updatedTags });
    }
    await tagRepo.delete(id);
  }

  async getTagItemCount(tagId: string): Promise<number> {
    return db.items.where('tags').equals(tagId).count();
  }
}

export const tagService = new TagService();

