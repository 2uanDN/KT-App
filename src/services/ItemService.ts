import { db } from '../db/database';
import { fileService } from './FileService';
import { searchService } from './SearchService';
import { linkMetaService } from './LinkMetaService';
import { thumbnailService } from './ThumbnailService';
import { toastStore } from '../store/toastStore';
import type { Item, NoteItem, FileItem, LinkItem, CreateItemDraft, StoredFile, QueuedFileDraft } from '../types/item';

class ItemService {
  private buildItemFromDraft(draft: CreateItemDraft, keepLong: boolean): Item {
    const id = crypto.randomUUID();
    const now = Date.now();
    const status: 'saved' | 'inbox' = keepLong ? 'saved' : 'inbox';
    const savedAt = keepLong ? now : null;

    const base = {
      id,
      status,
      isPinned: draft.isPinned ?? false,
      tags: Array.from(new Set(draft.tags ?? [])),
      collections: Array.from(new Set(draft.collections ?? [])),
      createdAt: now,
      savedAt,
      lastOpenedAt: null,
    };

    if (draft.type === 'note') {
      const body = draft.body ?? '';
      let title = draft.title?.trim();
      if (!title) {
        const firstLine = body.split('\n')[0]?.replace(/^[#*>\s_\-]+/, '').trim();
        title = firstLine ? firstLine.slice(0, 80) : 'Ghi chú không tiêu đề';
      }
      const noteItem: NoteItem = {
        ...base,
        type: 'note',
        title,
        body,
        embeds: draft.embeds ?? [],
      };
      return noteItem;
    }

    if (draft.type === 'file') {
      const displayName = draft.displayName?.trim() || draft.title?.trim() || 'Tệp không tên';
      const fileItem: FileItem = {
        ...base,
        type: 'file',
        title: displayName,
        displayName,
        fileType: draft.fileType ?? 'pdf',
        originalFilename: draft.file?.name ?? draft.fileQueue?.[0]?.originalFilename ?? 'file.bin',
        caption: draft.caption?.trim() ?? '',
        fileSizeBytes: draft.file?.size ?? draft.fileQueue?.reduce((acc, f) => acc + f.fileSizeBytes, 0) ?? 0,
        opfsPath: '', // to be filled after storing
        mimeType: draft.file?.type ?? draft.fileQueue?.[0]?.mimeType ?? 'application/octet-stream',
        files: [],
      };
      return fileItem;
    }

    // Link Item
    const rawUrl = draft.url?.trim() ?? '';
    const domain = linkMetaService.parseDomain(rawUrl);
    const title = draft.title?.trim() || draft.fetchedTitle?.trim() || domain || 'Liên kết web';

    const linkItem: LinkItem = {
      ...base,
      type: 'link',
      title,
      url: linkMetaService.normalizeUrl(rawUrl),
      domain,
      reason: draft.reason?.trim() ?? '',
      fetchedTitle: draft.fetchedTitle ?? null,
      previewImageUrl: draft.previewImageUrl ?? null,
      fetchStatus: 'success',
    };
    return linkItem;
  }

  async checkDuplicateUrl(url: string, excludeItemId?: string): Promise<LinkItem | null> {
    const normalized = linkMetaService.normalizeUrl(url);
    const items = (await db.items.where('type').equals('link').toArray()) as LinkItem[];
    const match = items.find(
      (item) => item.id !== excludeItemId && linkMetaService.normalizeUrl(item.url) === normalized
    );
    return match || null;
  }

  async createItem(draft: CreateItemDraft, keepLong: boolean): Promise<Item> {
    const item = this.buildItemFromDraft(draft, keepLong);

    if (item.type === 'file') {
      const fileItem = item as FileItem;
      const storedFiles: StoredFile[] = [];

      // If draft has fileQueue (multi-file list)
      if (draft.fileQueue && draft.fileQueue.length > 0) {
        let totalSize = 0;
        let chosenThumbnailPath: string | undefined = undefined;
        let chosenThumbnailId: string | undefined = undefined;

        // Ensure default thumbnail is the first image file if none is explicitly marked
        const hasExplicitThumbnail = draft.fileQueue.some((qf) => qf.isThumbnail);
        const firstImageIndex = draft.fileQueue.findIndex(
          (qf) => qf.isImage || fileService.isImage(qf.originalFilename, qf.mimeType)
        );

        for (let i = 0; i < draft.fileQueue.length; i++) {
          const qf = draft.fileQueue[i];
          let opfsPath = '';
          if (qf.file) {
            opfsPath = await fileService.storeFile(qf.file, qf.originalFilename);
          } else if (qf.storedFile) {
            opfsPath = qf.storedFile.opfsPath;
          }

          const isImageFile = qf.isImage || fileService.isImage(qf.originalFilename, qf.mimeType);
          const isThumb = hasExplicitThumbnail ? Boolean(qf.isThumbnail) : i === firstImageIndex;

          const storedFile: StoredFile = {
            id: qf.id || crypto.randomUUID(),
            originalFilename: qf.originalFilename,
            fileSizeBytes: qf.fileSizeBytes,
            opfsPath,
            mimeType: qf.mimeType,
            fileType: qf.fileType,
            isThumbnail: isThumb,
          };
          storedFiles.push(storedFile);
          totalSize += qf.fileSizeBytes;

          // If this file is chosen as thumbnail
          if (isThumb && isImageFile) {
            if (qf.file) {
              const thumb = await thumbnailService.generateImageThumbnail(qf.file);
              if (thumb) {
                chosenThumbnailPath = thumb;
                chosenThumbnailId = storedFile.id;
              }
            } else if (opfsPath) {
              const blob = await fileService.readFile(opfsPath);
              if (blob) {
                const thumb = await thumbnailService.generateImageThumbnail(blob);
                if (thumb) {
                  chosenThumbnailPath = thumb;
                  chosenThumbnailId = storedFile.id;
                }
              }
            }
          }
        }

        fileItem.files = storedFiles;
        fileItem.fileSizeBytes = totalSize;
        if (storedFiles.length > 0) {
          fileItem.opfsPath = storedFiles[0].opfsPath;
          fileItem.originalFilename = storedFiles[0].originalFilename;
          fileItem.fileType = storedFiles[0].fileType;
          fileItem.mimeType = storedFiles[0].mimeType;
        }

        if (chosenThumbnailPath) {
          fileItem.thumbnailBlobUrl = chosenThumbnailPath;
          fileItem.thumbnailFileId = chosenThumbnailId;
        } else {
          fileItem.thumbnailBlobUrl = undefined;
          fileItem.thumbnailFileId = undefined;
        }
      } else if (draft.file) {
        // Fallback for single file
        const opfsPath = await fileService.storeFile(draft.file, draft.file.name);
        fileItem.opfsPath = opfsPath;
        fileItem.fileSizeBytes = draft.file.size;
        fileItem.originalFilename = draft.file.name;

        const isImg = fileService.isImage(draft.file.name, draft.file.type);
        const storedFile: StoredFile = {
          id: crypto.randomUUID(),
          originalFilename: draft.file.name,
          fileSizeBytes: draft.file.size,
          opfsPath,
          mimeType: draft.file.type || 'application/octet-stream',
          fileType: draft.fileType ?? (isImg ? 'image' : 'pdf'),
          isThumbnail: isImg,
        };
        fileItem.files = [storedFile];

        if (isImg) {
          const thumb = await thumbnailService.generateImageThumbnail(draft.file);
          if (thumb) {
            fileItem.thumbnailBlobUrl = thumb;
            fileItem.thumbnailFileId = storedFile.id;
          }
        }
      }
    }

    await db.items.add(item);
    await searchService.add(item);

    toastStore.show(keepLong ? 'Đã lưu vào Thư viện' : 'Đã chuyển vào Hộp chờ', {
      undoFn: async () => {
        await this.deleteItem(item.id, false);
      },
    });

    return item;
  }

  async updateFileItemWithQueue(
    id: string,
    updates: Partial<FileItem>,
    newQueue: QueuedFileDraft[]
  ): Promise<void> {
    const current = (await db.items.get(id)) as FileItem | undefined;
    if (!current || current.type !== 'file') return;

    const existingFiles = current.files || [
      {
        id: current.id,
        originalFilename: current.originalFilename,
        fileSizeBytes: current.fileSizeBytes,
        opfsPath: current.opfsPath,
        mimeType: current.mimeType,
        fileType: current.fileType,
        isThumbnail: Boolean(current.thumbnailBlobUrl),
      },
    ];

    // Find removed files to delete from OPFS
    const retainedIds = new Set(newQueue.map((qf) => qf.id));
    for (const oldFile of existingFiles) {
      if (!retainedIds.has(oldFile.id) && oldFile.opfsPath) {
        await fileService.deleteFile(oldFile.opfsPath);
      }
    }

    // Process new queue
    const updatedStoredFiles: StoredFile[] = [];
    let totalSize = 0;
    let chosenThumbnailPath: string | undefined = undefined;
    let chosenThumbnailId: string | undefined = undefined;

    const hasExplicitThumbnail = newQueue.some((qf) => qf.isThumbnail);
    const firstImageIndex = newQueue.findIndex(
      (qf) => qf.isImage || fileService.isImage(qf.originalFilename, qf.mimeType)
    );

    for (let i = 0; i < newQueue.length; i++) {
      const qf = newQueue[i];
      let opfsPath = '';
      if (qf.file) {
        // Newly added file
        opfsPath = await fileService.storeFile(qf.file, qf.originalFilename);
      } else if (qf.storedFile) {
        // Existing file
        opfsPath = qf.storedFile.opfsPath;
      } else {
        const existing = existingFiles.find((f) => f.id === qf.id);
        opfsPath = existing?.opfsPath || '';
      }

      const isImageFile = qf.isImage || fileService.isImage(qf.originalFilename, qf.mimeType);
      const isThumb = hasExplicitThumbnail ? Boolean(qf.isThumbnail) : i === firstImageIndex;

      const stored: StoredFile = {
        id: qf.id,
        originalFilename: qf.originalFilename,
        fileSizeBytes: qf.fileSizeBytes,
        opfsPath,
        mimeType: qf.mimeType,
        fileType: qf.fileType,
        isThumbnail: isThumb,
      };
      updatedStoredFiles.push(stored);
      totalSize += qf.fileSizeBytes;

      if (isThumb && isImageFile) {
        chosenThumbnailId = stored.id;
        if (qf.file) {
          const thumb = await thumbnailService.generateImageThumbnail(qf.file);
          if (thumb) chosenThumbnailPath = thumb;
        } else if (current.thumbnailFileId === stored.id && current.thumbnailBlobUrl) {
          // Keep existing thumbnail
          chosenThumbnailPath = current.thumbnailBlobUrl;
        } else if (stored.opfsPath) {
          // Generate thumbnail from existing stored file
          const blob = await fileService.readFile(stored.opfsPath);
          if (blob) {
            const thumb = await thumbnailService.generateImageThumbnail(blob);
            if (thumb) chosenThumbnailPath = thumb;
          }
        }
      }
    }

    // Clean up old thumbnail if it was replaced or removed
    if (
      current.thumbnailBlobUrl &&
      (!chosenThumbnailPath || chosenThumbnailPath !== current.thumbnailBlobUrl)
    ) {
      await fileService.deleteFile(current.thumbnailBlobUrl);
    }

    const patch: Partial<FileItem> = {
      ...updates,
      files: updatedStoredFiles,
      fileSizeBytes: totalSize,
      thumbnailBlobUrl: chosenThumbnailPath || undefined,
      thumbnailFileId: chosenThumbnailId || undefined,
    };

    if (updatedStoredFiles.length > 0) {
      patch.opfsPath = updatedStoredFiles[0].opfsPath;
      patch.originalFilename = updatedStoredFiles[0].originalFilename;
      patch.fileType = updatedStoredFiles[0].fileType;
      patch.mimeType = updatedStoredFiles[0].mimeType;
    }

    await db.items.update(id, patch as Partial<Item>);
    const updated = await db.items.get(id);
    if (updated) {
      await searchService.update(updated);
    }
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<void> {
    const current = await db.items.get(id);
    if (!current) return;

    const patch: Partial<Item> = { ...updates };
    if (patch.tags) {
      patch.tags = Array.from(new Set(patch.tags));
    }
    if (patch.collections) {
      patch.collections = Array.from(new Set(patch.collections));
    }

    // Auto title fix for note if title empty
    if (current.type === 'note' && (patch as Partial<NoteItem>).body !== undefined && !patch.title) {
      const body = (patch as Partial<NoteItem>).body || '';
      const firstLine = body.split('\n')[0]?.replace(/^[#*>\s_\-]+/, '').trim();
      patch.title = firstLine ? firstLine.slice(0, 80) : 'Ghi chú không tiêu đề';
    }

    await db.items.update(id, patch);
    const updated = await db.items.get(id);
    if (updated) {
      await searchService.update(updated);
    }
  }

  async moveItem(id: string, to: 'saved' | 'inbox'): Promise<void> {
    const current = await db.items.get(id);
    if (!current) return;

    const patch =
      to === 'saved'
        ? { status: 'saved' as const, savedAt: Date.now() }
        : { status: 'inbox' as const, savedAt: null };

    await db.items.update(id, patch);
    const updated = await db.items.get(id);
    if (updated) {
      await searchService.update(updated);
    }

    const label = to === 'saved' ? 'Đã chuyển vào Thư viện' : 'Đã chuyển về Hộp chờ';
    toastStore.show(label, {
      undoFn: async () => {
        await this.moveItem(id, to === 'saved' ? 'inbox' : 'saved');
      },
    });
  }

  async togglePin(id: string): Promise<void> {
    const item = await db.items.get(id);
    if (!item) return;

    const newPinned = !item.isPinned;
    await db.items.update(id, { isPinned: newPinned });
    const updated = await db.items.get(id);
    if (updated) {
      await searchService.update(updated);
    }

    toastStore.show(newPinned ? 'Đã ghim mục' : 'Đã bỏ ghim', {
      undoFn: async () => {
        await this.togglePin(id);
      },
    });
  }

  async touchOpened(id: string): Promise<void> {
    await this.markAsOpened(id);
  }

  async markAsOpened(id: string): Promise<void> {
    const item = await db.items.get(id);
    if (item) {
      await db.items.update(id, { lastOpenedAt: Date.now() });
    }
  }

  async deleteItem(id: string, showToast = true): Promise<void> {
    const item = await db.items.get(id);
    if (!item) return;

    // Disconnect broken embeds in other notes
    if (item.type === 'file' || item.type === 'link') {
      await this.markEmbedsAsBroken(id);
    }

    // Delete stored file blobs if FileItem
    if (item.type === 'file') {
      const fileItem = item as FileItem;
      if (fileItem.files && fileItem.files.length > 0) {
        for (const f of fileItem.files) {
          if (f.opfsPath) {
            await fileService.deleteFile(f.opfsPath);
          }
        }
      } else if (fileItem.opfsPath) {
        await fileService.deleteFile(fileItem.opfsPath);
      }

      if (fileItem.thumbnailBlobUrl) {
        await fileService.deleteFile(fileItem.thumbnailBlobUrl);
      }
    }

    await db.items.delete(id);
    await searchService.remove(id);

    if (showToast) {
      toastStore.show('Đã xóa mục');
    }
  }

  async getEmbedCount(targetId: string): Promise<number> {
    const notes = (await db.items.where('type').equals('note').toArray()) as NoteItem[];
    return notes.filter((n) => n.embeds?.some((e) => e.targetItemId === targetId)).length;
  }

  private async markEmbedsAsBroken(deletedId: string): Promise<void> {
    const notes = (await db.items.where('type').equals('note').toArray()) as NoteItem[];
    for (const note of notes) {
      if (!note.embeds || note.embeds.length === 0) continue;
      let hasChange = false;
      const updated = note.embeds.map((e) => {
        if (e.targetItemId === deletedId && !e.isBroken) {
          hasChange = true;
          return { ...e, isBroken: true };
        }
        return e;
      });
      if (hasChange) {
        await db.items.update(note.id, { embeds: updated } as unknown as Partial<Item>);
        const fresh = await db.items.get(note.id);
        if (fresh) {
          await searchService.update(fresh);
        }
      }
    }
  }
}

export const itemService = new ItemService();

