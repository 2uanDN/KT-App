import { db } from './database';
import { tagService } from '../services/TagService';
import { collectionService } from '../services/CollectionService';
import { itemService } from '../services/ItemService';
import type { Item } from '../types/item';

let seedExecutionPromise: Promise<void> | null = null;

export async function cleanupDuplicateTagsAndCollections(): Promise<void> {
  try {
    // 1. DEDUPLICATE TAGS
    const allTags = await db.tags.toArray();
    const tagGroupMap = new Map<string, typeof allTags>();

    for (const tag of allTags) {
      const normalized = tagService.normalizeTagName(tag.name);
      if (!tagGroupMap.has(normalized)) {
        tagGroupMap.set(normalized, []);
      }
      tagGroupMap.get(normalized)!.push(tag);
    }

    for (const [, group] of tagGroupMap.entries()) {
      if (group.length > 1) {
        // Sort by createdAt ascending (keep oldest as primary)
        group.sort((a, b) => a.createdAt - b.createdAt);
        const primaryTag = group[0];
        const duplicates = group.slice(1);
        const duplicateIds = new Set(duplicates.map((d) => d.id));

        // Update all items referencing duplicate tags
        const allItems = await db.items.toArray();
        for (const item of allItems) {
          if (item.tags && item.tags.some((t) => duplicateIds.has(t))) {
            const mappedTags = item.tags.map((t) => (duplicateIds.has(t) ? primaryTag.id : t));
            const uniqueTags = Array.from(new Set(mappedTags));
            await db.items.update(item.id, { tags: uniqueTags });
          }
        }

        // Delete duplicate tag records
        for (const dup of duplicates) {
          await db.tags.delete(dup.id);
        }
      }
    }

    // 2. DEDUPLICATE COLLECTIONS
    const allCollections = await db.collections.toArray();
    const colGroupMap = new Map<string, typeof allCollections>();

    for (const col of allCollections) {
      const normalized = col.name.trim().toLowerCase();
      if (!colGroupMap.has(normalized)) {
        colGroupMap.set(normalized, []);
      }
      colGroupMap.get(normalized)!.push(col);
    }

    for (const [, group] of colGroupMap.entries()) {
      if (group.length > 1) {
        // Sort by createdAt ascending (keep oldest as primary)
        group.sort((a, b) => a.createdAt - b.createdAt);
        const primaryCol = group[0];
        const duplicates = group.slice(1);
        const duplicateIds = new Set(duplicates.map((d) => d.id));

        // Update all items referencing duplicate collections
        const allItems = await db.items.toArray();
        for (const item of allItems) {
          if (item.collections && item.collections.some((c) => duplicateIds.has(c))) {
            const mappedCols = item.collections.map((c) => (duplicateIds.has(c) ? primaryCol.id : c));
            const uniqueCols = Array.from(new Set(mappedCols));
            await db.items.update(item.id, { collections: uniqueCols });
          }
        }

        // Delete duplicate collection records
        for (const dup of duplicates) {
          await db.collections.delete(dup.id);
        }
      }
    }

    // 3. CLEAN UP ANY IN-ITEM DUPLICATE ENTRIES
    const allItems = await db.items.toArray();
    for (const item of allItems) {
      let needsUpdate = false;
      const patch: Partial<Item> = {};

      if (item.tags && item.tags.length > 0) {
        const uniqueTags = Array.from(new Set(item.tags));
        if (uniqueTags.length !== item.tags.length) {
          patch.tags = uniqueTags;
          needsUpdate = true;
        }
      }

      if (item.collections && item.collections.length > 0) {
        const uniqueCols = Array.from(new Set(item.collections));
        if (uniqueCols.length !== item.collections.length) {
          patch.collections = uniqueCols;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await db.items.update(item.id, patch);
      }
    }
  } catch (err) {
    console.warn('Database cleanup warning:', err);
  }
}

export async function seedInitialDataIfEmpty(): Promise<void> {
  if (seedExecutionPromise) {
    return seedExecutionPromise;
  }

  seedExecutionPromise = (async () => {
    try {
      // First clean up any existing duplicate entries in the database
      await cleanupDuplicateTagsAndCollections();

      const itemCount = await db.items.count();
      if (itemCount > 0) return;

      // Create initial tags (deduplicated)
      const tagKientruc = await tagService.getOrCreateTag('kientruc');
      const tagPwa = await tagService.getOrCreateTag('pwa');
      const tagHuongdan = await tagService.getOrCreateTag('huongdan');

      // Create initial collection (deduplicated)
      const col = await collectionService.createCollection('Khởi đầu nhanh');

      // 1. Welcome Note with Wikilinks and Markdown
      await itemService.createItem(
        {
          type: 'note',
          title: 'Chào mừng đến với Kho Tri Thức Cá Nhân',
          body: `# Kho Tri Thức Cá Nhân (Local-First PWA)

Ứng dụng ghi chú và lưu trữ tri thức cá nhân hoạt động **hoàn toàn trên thiết bị của bạn**, không cần đăng nhập, không có máy chủ trung gian, bảo mật tuyệt đối.

## 🚀 Các tính năng chính:
- **Local-First & Offline**: Dữ liệu lưu trong IndexedDB & OPFS tốc độ cao.
- **Wikilinks 2 chiều**: Tạo liên kết giữa các ghi chú bằng cú pháp \`[[Tên Ghi Chú]]\`.
- **Hộp chờ (Inbox)**: Lưu nhanh các ý tưởng hoặc liên kết, phân loại và "Giữ lâu dài" sau.
- **Phân loại linh hoạt**: Gắn thẻ \`#tag\`, gom vào **Bộ sưu tập**, ghim lên đầu trang.
- **Đa định dạng**: Hỗ trợ Ghi chú Markdown, Tệp (PDF, Ảnh, Markdown) và Liên kết Web.

---
Thử tạo một ghi chú mới bằng nút **+** màu xanh ở góc phải!`,
          tags: [tagHuongdan.id, tagPwa.id],
          collections: [col.id],
          isPinned: true,
        },
        true // saved
      );

      // 2. Technical Note about Architecture
      await itemService.createItem(
        {
          type: 'note',
          title: 'Kiến trúc Blueprint Local-First',
          body: `## Nguyên tắc cốt lõi:
1. **Không phụ thuộc đám mây**: Thiết bị là nguồn chân lý duy nhất.
2. **Tốc độ phản hồi tức thì**: Sử dụng MiniSearch in-memory index cho kết quả tìm kiếm theo thời gian thực.
3. **An toàn dữ liệu**: Hỗ trợ OPFS (Origin Private File System) lưu trữ nhị phân tới 50MB/tệp.

Liên kết tham khảo: [[Chào mừng đến với Kho Tri Thức Cá Nhân]]`,
          tags: [tagKientruc.id, tagPwa.id],
          collections: [col.id],
          isPinned: false,
        },
        true // saved
      );

      // 3. Sample Link Item in Inbox
      await itemService.createItem(
        {
          type: 'link',
          title: 'Web.dev - Local-first Web Architecture',
          url: 'https://web.dev/explore/progressive-web-apps',
          reason: 'Tài liệu hướng dẫn chuyên sâu về kiến trúc PWA và lưu trữ ngoại tuyến hiện đại.',
          tags: [tagPwa.id],
          collections: [],
          isPinned: false,
        },
        false // in inbox
      );
    } catch (err) {
      console.warn('Seed data initial skipped:', err);
    }
  })();

  return seedExecutionPromise;
}

