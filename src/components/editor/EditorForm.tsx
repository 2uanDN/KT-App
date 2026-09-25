import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TypeSwitcher } from './TypeSwitcher';
import { FormBar } from './FormBar';
import { BodyEditor } from './BodyEditor';
import { KeepSwitch } from './KeepSwitch';
import { PinSwitch } from './PinSwitch';
import { InlineError } from '../feedback/InlineError';
import { TagPicker } from '../sheets/TagPicker';
import { CollectionPicker } from '../sheets/CollectionPicker';
import { InsertSheet } from '../sheets/InsertSheet';
import { ConfirmSheet } from '../sheets/ConfirmSheet';
import { fileService } from '../../services/FileService';
import { linkMetaService } from '../../services/LinkMetaService';
import { itemService } from '../../services/ItemService';
import { db } from '../../db/database';
import type { Item, ItemType, EmbedRef, FileType, FileItem, LinkItem, QueuedFileDraft } from '../../types/item';

interface EditorFormProps {
  initialItem?: Item;
  isEditing?: boolean;
  defaultType?: ItemType;
}

export const EditorForm: React.FC<EditorFormProps> = ({
  initialItem,
  isEditing = false,
  defaultType = 'note',
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<ItemType>(initialItem?.type || defaultType);

  useEffect(() => {
    if (!isEditing && defaultType && !initialItem) {
      setType(defaultType);
    }
  }, [defaultType, isEditing, initialItem]);
  const [title, setTitle] = useState(initialItem?.title || '');
  const [isPinned, setIsPinned] = useState(initialItem?.isPinned || false);
  const [tags, setTags] = useState<string[]>(
    Array.from(new Set(initialItem?.tags || []))
  );
  const [collections, setCollections] = useState<string[]>(
    Array.from(new Set(initialItem?.collections || []))
  );
  const [keepLong, setKeepLong] = useState(
    initialItem ? initialItem.status === 'saved' : true
  );

  // Note specific
  const [noteBody, setNoteBody] = useState(
    initialItem?.type === 'note' ? initialItem.body : ''
  );
  const [embeds, setEmbeds] = useState<EmbedRef[]>(
    initialItem?.type === 'note' ? initialItem.embeds || [] : []
  );

  // File specific (Multi-file queue)
  const [fileCaption, setFileCaption] = useState(
    initialItem?.type === 'file' ? initialItem.caption : ''
  );
  const [fileQueue, setFileQueue] = useState<QueuedFileDraft[]>(() => {
    if (initialItem?.type === 'file') {
      const fi = initialItem as FileItem;
      if (fi.files && fi.files.length > 0) {
        return fi.files.map((sf) => ({
          id: sf.id,
          storedFile: sf,
          originalFilename: sf.originalFilename,
          fileSizeBytes: sf.fileSizeBytes,
          fileType: sf.fileType,
          mimeType: sf.mimeType,
          isImage: fileService.isImage(sf.originalFilename, sf.mimeType),
          isThumbnail: fi.thumbnailFileId ? fi.thumbnailFileId === sf.id : Boolean(sf.isThumbnail),
        }));
      } else if (fi.opfsPath) {
        const isImg = fileService.isImage(fi.originalFilename, fi.mimeType);
        return [
          {
            id: fi.id,
            originalFilename: fi.originalFilename,
            fileSizeBytes: fi.fileSizeBytes,
            fileType: fi.fileType,
            mimeType: fi.mimeType,
            isImage: isImg,
            isThumbnail: Boolean(fi.thumbnailBlobUrl),
          },
        ];
      }
    }
    return [];
  });
  const [fileError, setFileError] = useState<string | null>(null);
  const [openMenuFileId, setOpenMenuFileId] = useState<string | null>(null);

  // Link specific
  const [url, setUrl] = useState(initialItem?.type === 'link' ? initialItem.url : '');
  const [reason, setReason] = useState(initialItem?.type === 'link' ? initialItem.reason : '');
  const [duplicateItem, setDuplicateItem] = useState<Item | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // UI Sheets & Form States
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [showInsertSheet, setShowInsertSheet] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load tag objects for display
  const tagObjects = useLiveQuery(
    async () => {
      if (tags.length === 0) return [];
      return db.tags.where('id').anyOf(tags).toArray();
    },
    [tags]
  ) || [];

  const collectionObjects = useLiveQuery(
    async () => {
      if (collections.length === 0) return [];
      return db.collections.where('id').anyOf(collections).toArray();
    },
    [collections]
  ) || [];

  const isDirty = Boolean(
    title !== (initialItem?.title || '') ||
    (type === 'note' && noteBody !== (initialItem?.type === 'note' ? initialItem.body : '')) ||
    (type === 'file' && fileQueue.length > 0) ||
    (type === 'link' && url !== (initialItem?.type === 'link' ? initialItem.url : '')) ||
    (type === 'file' && initialItem?.type === 'file' && (initialItem as FileItem).caption !== fileCaption) ||
    (type === 'link' && initialItem?.type === 'link' && (initialItem as LinkItem).reason !== reason) ||
    tags.length > 0 ||
    collections.length > 0
  );

  // Handle URL changes & validation / duplicate check (no auto metadata fetch)
  useEffect(() => {
    if (type !== 'link' || !url.trim()) {
      setDuplicateItem(null);
      setUrlError(null);
      return;
    }

    if (!linkMetaService.isValidUrl(url)) {
      setUrlError('Địa chỉ URL chưa đúng định dạng');
      return;
    }
    setUrlError(null);

    // Check duplicate
    itemService.checkDuplicateUrl(url, initialItem?.id).then((dup) => {
      setDuplicateItem(dup);
    });
  }, [url, type, initialItem?.id]);

  // Handle Multi-File Selection
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(e.target.files || []);
    if (incomingFiles.length === 0) return;

    setFileError(null);
    const newQueueItems: QueuedFileDraft[] = [];
    const errors: string[] = [];

    for (const file of incomingFiles) {
      const validation = fileService.validateFile(file);
      if (!validation.ok) {
        errors.push(validation.error || `Tệp ${file.name} không hợp lệ`);
        continue;
      }

      const isImg = validation.isImage ?? fileService.isImage(file.name, file.type);
      const detectedType: FileType = validation.detectedType || (isImg ? 'image' : 'pdf');

      newQueueItems.push({
        id: crypto.randomUUID(),
        file,
        originalFilename: file.name,
        fileSizeBytes: file.size,
        fileType: detectedType,
        mimeType: file.type || 'application/octet-stream',
        isImage: isImg,
        isThumbnail: false,
      });
    }

    if (errors.length > 0) {
      setFileError(errors.join('. '));
    }

    if (newQueueItems.length > 0) {
      setFileQueue((prev) => {
        let next = [...prev, ...newQueueItems];
        // Ensure default thumbnail is set to the first image file if none is chosen yet
        const hasThumb = next.some((item) => item.isThumbnail);
        if (!hasThumb) {
          const firstImageIdx = next.findIndex((item) => item.isImage);
          if (firstImageIdx !== -1) {
            next = next.map((item, idx) => ({
              ...item,
              isThumbnail: idx === firstImageIdx,
            }));
          }
        }
        // Auto title from first file if title is currently empty
        if (!title && next.length > 0) {
          const cleanName = next[0].originalFilename.replace(/\.[^/.]+$/, '');
          setTitle(cleanName);
        }
        return next;
      });
    }

    // Reset input value so same files can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggleThumbnail = (fileId: string) => {
    setFileQueue((prev) =>
      prev.map((item) => {
        if (item.id === fileId) {
          return { ...item, isThumbnail: !item.isThumbnail };
        }
        // Only one file can be thumbnail at a time
        return { ...item, isThumbnail: false };
      })
    );
    setOpenMenuFileId(null);
  };

  const handleRemoveFile = (fileId: string) => {
    setFileQueue((prev) => {
      let next = prev.filter((item) => item.id !== fileId);
      // If no thumbnail remains selected, automatically default to first remaining image
      const hasThumb = next.some((item) => item.isThumbnail);
      if (!hasThumb) {
        const firstImageIdx = next.findIndex((item) => item.isImage);
        if (firstImageIdx !== -1) {
          next = next.map((item, idx) => ({
            ...item,
            isThumbnail: idx === firstImageIdx,
          }));
        }
      }
      return next;
    });
    setOpenMenuFileId(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleInsertWikiLink = (target: string, alias?: string) => {
    const linkSyntax = alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
    setNoteBody((prev) => prev + `\n${linkSyntax}\n`);
  };

  const handleInsertEmbed = (embed: EmbedRef) => {
    setEmbeds((prev) => [...prev, embed]);
  };

  const canSubmit = (() => {
    if (isSubmitting) return false;
    if (type === 'note') {
      return Boolean(noteBody.trim() || title.trim());
    }
    if (type === 'file') {
      return fileQueue.length > 0;
    }
    if (type === 'link') {
      return Boolean(url.trim() && !urlError);
    }
    return false;
  })();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (isEditing && initialItem) {
        // UPDATE Existing
        const baseUpdates = {
          title: title.trim() || undefined,
          tags,
          collections,
          isPinned,
          status: keepLong ? ('saved' as const) : ('inbox' as const),
          savedAt: keepLong ? initialItem.savedAt || Date.now() : null,
        };

        if (initialItem.type === 'note') {
          await itemService.updateItem(initialItem.id, {
            ...baseUpdates,
            body: noteBody,
            embeds,
          });
        } else if (initialItem.type === 'file') {
          await itemService.updateFileItemWithQueue(
            initialItem.id,
            {
              ...baseUpdates,
              caption: fileCaption,
              displayName: title.trim() || undefined,
            },
            fileQueue
          );
        } else if (initialItem.type === 'link') {
          const currentLink = initialItem as LinkItem;
          await itemService.updateItem(initialItem.id, {
            ...baseUpdates,
            url: linkMetaService.normalizeUrl(url),
            domain: linkMetaService.parseDomain(url),
            reason,
            fetchedTitle: currentLink.fetchedTitle || null,
            previewImageUrl: currentLink.previewImageUrl || null,
          });
        }

        navigate(`/items/${initialItem.id}`, { replace: true });
      } else {
        // CREATE New
        await itemService.createItem(
          {
            type,
            title: title.trim() || undefined,
            tags,
            collections,
            isPinned,
            body: noteBody,
            embeds,
            fileQueue: type === 'file' ? fileQueue : undefined,
            displayName: title.trim() || undefined,
            caption: fileCaption,
            url,
            reason,
          },
          keepLong
        );

        // Routing destination after save per spec (keepLong ? '/' : '/inbox')
        const destination = keepLong ? '/' : '/inbox';
        navigate(destination, { replace: true });
      }
    } catch (err: unknown) {
      console.error('Failed to save item:', err);
      setFormError((err as Error)?.message || 'Không thể lưu mục. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#ffffff] min-h-screen">
      <FormBar
        title={isEditing ? 'Chỉnh sửa tri thức' : 'Lưu tri thức mới'}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
        canSubmit={canSubmit}
      />

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full pb-20">
        {formError && <InlineError message={formError} />}

        {/* Type Switcher (only selectable during creation) */}
        {!isEditing && (
          <div>
            <label className="type-label-code-bold text-[#3D4A5C] mb-1.5 block">
              Loại tri thức
            </label>
            <TypeSwitcher selectedType={type} onChange={setType} />
          </div>
        )}

        {/* 1. NOTE FORM */}
        {type === 'note' && (
          <div className="space-y-3">
            <div>
              <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
                Tiêu đề (Tùy chọn — tự động lấy từ dòng đầu)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề hoặc để trống..."
                className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
              />
            </div>

            <div>
              <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
                Nội dung Ghi chú
              </label>
              <BodyEditor
                value={noteBody}
                onChange={setNoteBody}
                onOpenInsertSheet={() => setShowInsertSheet(true)}
              />
            </div>
          </div>
        )}

        {/* 2. FILE FORM (Multi-File Queue) */}
        {type === 'file' && (
          <div className="space-y-4">
            {/* File Queue Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="type-label-code-bold text-[#3D4A5C]">
                    Danh sách tệp trong hàng chờ ({fileQueue.length})
                  </label>
                  {fileQueue.length > 0 && (
                    <span className="type-nano-code font-mono text-[#75777D]">
                      · Tổng: {formatFileSize(fileQueue.reduce((acc, f) => acc + (f.fileSizeBytes || 0), 0))}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#3D4A5C] hover:text-[#1B1B1B] bg-[#FAF9F7] hover:bg-[#FFFFFF] px-2.5 py-1 rounded-md transition cursor-pointer border border-[#3D4A5C] shadow-hard-xs press-xs"
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  <span>THÊM TỆP</span>
                </button>
              </div>

              {/* Hidden multi-file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*,.jpg,.jpeg,.png,.webp,.svg,.bmp,.tiff,.tif,.heic,.heif,.md,.markdown,text/markdown,text/plain"
                onChange={handleFilesSelected}
                className="hidden"
              />

              {/* Drop / Selection Zone when queue is empty */}
              {fileQueue.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#3D4A5C] rounded-lg p-6 text-center bg-[#FAF9F7] hover:bg-[#FFFFFF] shadow-hard-xs transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[36px] text-[#3D4A5C] mb-1.5">
                    upload_file
                  </span>
                  <p className="type-headline-xs text-[#1B1B1B]">
                    Nhấn để chọn tệp (hỗ trợ chọn nhiều tệp)
                  </p>
                  <p className="type-nano-code text-[#44474C] mt-1">
                    PDF, Hình ảnh (JPG, PNG, WEBP, SVG, BMP, TIFF, HEIC...), Markdown • Tối đa 50MB/tệp
                  </p>
                </div>
              ) : (
                /* File Queue List */
                <div className="space-y-2">
                  <div className="divide-y divide-[#3D4A5C]/20 bg-[#FAF9F7] border border-[#3D4A5C] rounded-lg overflow-visible shadow-hard-xs">
                    {fileQueue.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 flex items-center justify-between gap-2.5 hover:bg-white transition relative"
                      >
                        {/* File Icon & Info */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 border ${
                              item.isThumbnail
                                ? 'bg-[#3D4A5C] text-white border-[#1B1B1B]'
                                : item.isImage
                                ? 'bg-[#A8C5B8] text-[#1B1B1B] border-[#3D4A5C]/30'
                                : item.fileType === 'pdf'
                                ? 'bg-[#D4A5A5] text-[#1B1B1B] border-[#3D4A5C]/30'
                                : 'bg-[#E0DFDE] text-[#1B1B1B] border-[#3D4A5C]/30'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {item.isImage ? 'image' : item.fileType === 'pdf' ? 'picture_as_pdf' : 'description'}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <p className="type-code-sm font-bold text-[#1B1B1B] truncate max-w-full min-w-0">
                                {item.originalFilename}
                              </p>
                              {item.isThumbnail && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-xs bg-[#3D4A5C] text-white type-nano-code font-bold shrink-0">
                                  THUMBNAIL
                                </span>
                              )}
                            </div>
                            <p className="type-nano-code text-[#44474C] mt-0.5">
                              #{idx + 1} · {formatFileSize(item.fileSizeBytes)} · {item.fileType.toUpperCase()}
                            </p>
                          </div>
                        </div>

                        {/* Actions Menu (•••) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuFileId(openMenuFileId === item.id ? null : item.id)
                            }
                            className="w-8 h-8 rounded-md flex items-center justify-center text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] transition cursor-pointer"
                            aria-label="Tùy chọn tệp"
                          >
                            <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                          </button>

                          {/* Dropdown Menu */}
                          {openMenuFileId === item.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => setOpenMenuFileId(null)}
                                aria-hidden="true"
                              />
                              <div className="absolute right-0 top-full mt-1 z-30 w-52 bg-white border-2 border-[#3D4A5C] rounded-lg shadow-hard-lg py-1 text-xs">
                                {/* Thumbnail action (only for image files) */}
                                {item.isImage && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleThumbnail(item.id)}
                                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FAF9F7] text-[#1B1B1B] font-medium cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">
                                      {item.isThumbnail ? 'hide_image' : 'photo_size_select_actual'}
                                    </span>
                                    <span>
                                      {item.isThumbnail ? 'Bỏ chọn thumbnail' : 'Chọn làm thumbnail'}
                                    </span>
                                  </button>
                                )}

                                {/* Delete action */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFile(item.id)}
                                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FFDAD6] text-[#BA1A1A] font-medium cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                  <span>Xóa khỏi danh sách</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {fileError && <InlineError message={fileError} className="mt-2" />}
            </div>

            {/* Display Title */}
            <div>
              <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
                Tên hiển thị tri thức
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tên gợi nhớ cho bộ tệp này..."
                className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
              />
            </div>

            {/* Caption */}
            <div>
              <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
                Chú thích (Vì sao lưu tệp này?)
              </label>
              <textarea
                value={fileCaption}
                onChange={(e) => setFileCaption(e.target.value)}
                placeholder="Ghi chú thêm về nội dung hoặc mục đích của tệp..."
                rows={3}
                className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* 3. LINK FORM */}
        {type === 'link' && (
          <div className="space-y-3">
            <div>
              <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
                Địa chỉ Web (URL)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-[#3D4A5C]">
                  link
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full pl-9 pr-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
                />
              </div>
              {urlError && <InlineError message={urlError} className="mt-1" />}
              {/* Duplicate URL Non-blocking warning */}
              {duplicateItem && (
                <div className="mt-2 p-2.5 bg-[#FAF9F7] border border-[#3D4A5C] rounded-lg text-xs flex items-center justify-between text-[#44474C] shadow-hard-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">info</span>
                    <span>Liên kết này đã có trong kho:</span>
                  </div>
                  <Link
                    to={`/items/${duplicateItem.id}`}
                    className="font-bold text-[#3D4A5C] underline truncate max-w-[140px]"
                  >
                    {duplicateItem.title}
                  </Link>
                </div>
              )}
            </div>

            <div>
              <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
                Tiêu đề bài viết / Trang web
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tiêu đề trang hoặc tên gợi nhớ..."
                className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
              />
            </div>

            <div>
              <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
                Lý do giữ (Vì sao giữ lại liên kết này?)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ý tưởng hoặc thông tin quan trọng rút ra..."
                rows={3}
                className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* METADATA: TAGS & COLLECTIONS */}
        <div className="pt-2 border-t border-[#3D4A5C]/20 space-y-3">
          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="type-label-code-bold text-[#3D4A5C]">
                Thẻ (Tags)
              </label>
              <button
                type="button"
                onClick={() => setShowTagPicker(true)}
                className="type-label-code-bold text-[#3D4A5C] hover:text-[#1B1B1B] flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>GÁN THẺ</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-[#FAF9F7] rounded-lg border border-[#3D4A5C] shadow-hard-xs">
              {tagObjects.length === 0 ? (
                <span className="text-xs text-[#75777D] italic font-mono">Chưa gán thẻ nào</span>
              ) : (
                tagObjects.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#FFFFFF] text-[#3D4A5C] border border-[#3D4A5C]/30 text-xs font-mono font-bold shadow-hard-xs"
                  >
                    <span>#{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((id) => id !== tag.id))}
                      className="hover:opacity-75 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Collections */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="type-label-code-bold text-[#3D4A5C]">
                Bộ sưu tập
              </label>
              <button
                type="button"
                onClick={() => setShowColPicker(true)}
                className="type-label-code-bold text-[#3D4A5C] hover:text-[#1B1B1B] flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>CHỌN BỘ</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-[#FAF9F7] rounded-lg border border-[#3D4A5C] shadow-hard-xs">
              {collectionObjects.length === 0 ? (
                <span className="text-xs text-[#75777D] italic font-mono">Chưa vào bộ sưu tập nào</span>
              ) : (
                collectionObjects.map((col) => (
                  <span
                    key={col.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#FFFFFF] text-[#1B1B1B] border border-[#3D4A5C] text-xs font-medium shadow-hard-xs"
                  >
                    <span className="material-symbols-outlined text-[14px] text-[#3D4A5C]">folder</span>
                    <span>{col.name}</span>
                    <button
                      type="button"
                      onClick={() => setCollections(collections.filter((id) => id !== col.id))}
                      className="hover:opacity-75 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Pin Switch */}
          <PinSwitch isPinned={isPinned} onChange={setIsPinned} />

          {/* Keep Switch (Giữ lâu dài vs Hộp chờ) */}
          <KeepSwitch keepLong={keepLong} onChange={setKeepLong} />
        </div>
      </div>

      {/* Sheets & Dialogs */}
      <TagPicker
        isOpen={showTagPicker}
        onClose={() => setShowTagPicker(false)}
        selectedTagIds={tags}
        onChange={setTags}
      />

      <CollectionPicker
        isOpen={showColPicker}
        onClose={() => setShowColPicker(false)}
        selectedCollectionIds={collections}
        onChange={setCollections}
      />

      <InsertSheet
        isOpen={showInsertSheet}
        onClose={() => setShowInsertSheet(false)}
        onInsertWikiLink={handleInsertWikiLink}
        onInsertEmbed={handleInsertEmbed}
        currentNoteId={initialItem?.id}
      />

      <ConfirmSheet
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => navigate(-1)}
        title="Rời khỏi trang?"
        customMessage="Bạn có thay đổi chưa lưu. Nếu rời đi, các thông tin vừa nhập sẽ bị mất."
        confirmLabel="Rời đi"
        isDestructive={true}
      />
    </div>
  );
};

