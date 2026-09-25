import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Item, NoteItem, FileItem, LinkItem, StoredFile } from '../../types/item';
import { itemService } from '../../services/ItemService';
import { fileService, formatFileSize, getTotalFileSize, getFileCategoryTag } from '../../services/FileService';
import { db } from '../../db/database';
import { useOPFSUrl } from '../../hooks/useOPFSUrl';
import { CollectionPicker } from '../sheets/CollectionPicker';
import { ConfirmSheet } from '../sheets/ConfirmSheet';
import { ImageViewerModal } from '../viewer/ImageViewerModal';
import { toastStore } from '../../store/toastStore';

interface ItemCardProps {
  item: Item;
  variant?: 'library' | 'inbox';
  onOpen: (id: string) => void;
}

export const getTypeTheme = (item: Item) => {
  switch (item.type) {
    case 'note':
      return {
        label: 'Ghi chú',
        icon: 'description',
        accentColor: '#E8D4B8',
        accentBgClass: 'bg-[#E8D4B8]',
        borderTopColor: 'border-t-[#E8D4B8]',
        textAccent: 'text-[#8A5A00]',
      };
    case 'file': {
      const fi = item as FileItem;
      const isMedia = fi.fileType === 'image';
      const isPdf = fi.fileType === 'pdf';
      const isCode = fi.fileType === 'markdown';

      const color = isMedia ? '#A8C5B8' : isCode ? '#B9B08A' : '#D4A5A5';
      const bgClass = isMedia ? 'bg-[#A8C5B8]' : isCode ? 'bg-[#B9B08A]' : 'bg-[#D4A5A5]';
      const textClass = isMedia ? 'text-[#2E6B48]' : isCode ? 'text-[#634040]' : 'text-[#BA1A1A]';

      return {
        label: 'Tệp tài liệu',
        icon: isMedia ? 'image' : isPdf ? 'picture_as_pdf' : 'draft',
        accentColor: color,
        accentBgClass: bgClass,
        borderTopColor: `border-t-[${color}]`,
        textAccent: textClass,
      };
    }
    case 'link':
      return {
        label: 'Liên kết',
        icon: 'link',
        accentColor: '#B9B08A',
        accentBgClass: 'bg-[#B9B08A]',
        borderTopColor: 'border-t-[#B9B08A]',
        textAccent: 'text-[#3D4A5C]',
      };
  }
};

const formatDate = (timestamp: number | null) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Thumbnail Preview Component for FileItem
const FileThumbnailPreview: React.FC<{
  thumbnailPath: string;
  title: string;
  imageCount: number;
  onViewImage: () => void;
}> = ({ thumbnailPath, title, imageCount, onViewImage }) => {
  const { url, loading } = useOPFSUrl(thumbnailPath);

  if (loading || !url) {
    return (
      <div className="w-full h-40 bg-[#FAF9F7] flex items-center justify-center border-b border-[#3D4A5C]/20 animate-pulse">
        <span className="w-5 h-5 border-2 border-[#3D4A5C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-44 sm:h-48 bg-[#F3F3F3] overflow-hidden flex items-center justify-center border-b border-[#3D4A5C]/20 group-hover:brightness-[1.02] transition">
      {/* Soft blurred ambient backdrop */}
      <img
        src={url}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover blur-xl opacity-20 scale-125 pointer-events-none select-none"
      />
      {/* High-res uncropped main image */}
      <img
        src={url}
        alt={title}
        className="relative z-10 max-h-full max-w-full w-auto h-auto object-contain p-2 transition-transform duration-200 ease-out group-hover:scale-[1.02]"
        loading="lazy"
      />

      {/* Floating 'Xem ảnh' button directly on thumbnail for quick instant access */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onViewImage();
        }}
        className="absolute bottom-2 right-2 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1B1B1B]/90 hover:bg-[#1B1B1B] active:scale-95 text-white text-[11px] font-mono font-bold shadow-hard-xs border border-white/20 transition cursor-pointer"
        title="Xem ảnh gốc hoàn chỉnh"
        aria-label="Xem ảnh gốc"
      >
        <span className="material-symbols-outlined text-[15px]">visibility</span>
        <span>XEM ẢNH</span>
        {imageCount > 1 && (
          <span className="bg-white/30 px-1 py-0.2 rounded text-[10px] font-mono font-bold">
            {imageCount}
          </span>
        )}
      </button>
    </div>
  );
};

export const ItemCard: React.FC<ItemCardProps> = ({ item, variant = 'library', onOpen }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [embedCount, setEmbedCount] = useState(0);
  const [copiedNote, setCopiedNote] = useState(false);

  const handleCopyNote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const note = item as NoteItem;
    const textToCopy = note.body || note.title || '';
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedNote(true);
      toastStore.show('Đã sao chép nội dung ghi chú');
      setTimeout(() => setCopiedNote(false), 2000);
    } catch {
      toastStore.show('Không thể sao chép nội dung');
    }
  };

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const linkItem = item as LinkItem;
    if (linkItem.url) {
      try {
        window.open(linkItem.url, '_blank', 'noopener,noreferrer');
      } catch {
        toastStore.show('Không thể mở liên kết');
      }
    }
  };

  // Load tag names
  const tags = useLiveQuery(
    async () => {
      if (!item.tags || item.tags.length === 0) return [];
      return db.tags.where('id').anyOf(item.tags).toArray();
    },
    [item.tags]
  ) || [];

  // Extract all image files in this item's queue/files list
  const imageFiles: StoredFile[] = useMemo(() => {
    if (item.type !== 'file') return [];
    const fi = item as FileItem;
    const list: StoredFile[] = [];

    if (fi.files && fi.files.length > 0) {
      for (const f of fi.files) {
        if (f.fileType === 'image' || fileService.isImage(f.originalFilename, f.mimeType)) {
          list.push(f);
        }
      }
    } else if (fi.opfsPath && (fi.fileType === 'image' || fileService.isImage(fi.originalFilename, fi.mimeType))) {
      list.push({
        id: fi.id,
        originalFilename: fi.originalFilename,
        fileSizeBytes: fi.fileSizeBytes,
        opfsPath: fi.opfsPath,
        mimeType: fi.mimeType,
        fileType: fi.fileType,
        isThumbnail: Boolean(fi.thumbnailBlobUrl),
      });
    }

    return list;
  }, [item]);

  const hasImageFiles = imageFiles.length > 0;

  // Context line
  const contextLine = (() => {
    switch (item.type) {
      case 'note': {
        const lines = (item as NoteItem).body.split('\n').filter((l) => l.trim().length > 0);
        return lines.length > 0 ? lines[0].replace(/^[#*>\s_\-]+/, '').slice(0, 120) : '';
      }
      case 'file':
        return (item as FileItem).caption || '';
      case 'link':
        return (item as LinkItem).reason || '';
    }
  })();

  // Multi-file filenames display strategy
  const fileListInfo = (() => {
    if (item.type !== 'file') return null;
    const fi = item as FileItem;
    const files =
      fi.files && fi.files.length > 0
        ? fi.files.map((f) => ({
            id: f.id,
            name: f.originalFilename,
            type: f.fileType,
            size: f.fileSizeBytes,
            isThumbnail: fi.thumbnailFileId ? fi.thumbnailFileId === f.id : Boolean(f.isThumbnail),
          }))
        : fi.originalFilename
        ? [
            {
              id: fi.id,
              name: fi.originalFilename,
              type: fi.fileType,
              size: fi.fileSizeBytes,
              isThumbnail: Boolean(fi.thumbnailBlobUrl),
            },
          ]
        : [];

    const totalCount = files.length;
    const displayedFiles = files.slice(0, 3);
    const remainingCount = totalCount > 3 ? totalCount - 3 : 0;

    return {
      files,
      displayedFiles,
      remainingCount,
      totalCount,
    };
  })();

  // Total file size and category tag for FileItem
  const { totalFileBytes, fileCategoryTag } = useMemo(() => {
    if (item.type !== 'file') return { totalFileBytes: 0, fileCategoryTag: '' };
    const fi = item as FileItem;
    const total = getTotalFileSize(fi);
    const tag = getFileCategoryTag(fi);
    return { totalFileBytes: total, fileCategoryTag: tag };
  }, [item]);

  const linkDomain = item.type === 'link' ? (item as LinkItem).domain : null;

  const handleOpenDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const count = await itemService.getEmbedCount(item.id);
    setEmbedCount(count);
    setShowDeleteConfirm(true);
  };

  const handleSaveToCollection = async (selectedIds: string[]) => {
    await itemService.updateItem(item.id, { collections: selectedIds });
  };

  const fileItem = item.type === 'file' ? (item as FileItem) : null;
  const hasThumbnail = Boolean(fileItem?.thumbnailBlobUrl);
  const theme = getTypeTheme(item);

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => onOpen(item.id)}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(item.id)}
        aria-label={`${theme.label}: ${item.title}`}
        className="group relative bg-[#FAF9F7] rounded-lg border border-[#3D4A5C] shadow-hard-md hover:border-[#1B1B1B] hover:shadow-hard-sm transition-all duration-150 overflow-hidden text-left cursor-pointer flex flex-col"
      >
        {/* 6px Top Accent Strip (dimension.accent-strip 6px) */}
        <div
          className="h-1.5 w-full shrink-0 border-b border-[#3D4A5C]/20"
          style={{ backgroundColor: theme.accentColor }}
        />

        {/* Thumbnail Preview: Only shown if user selected a file as thumbnail */}
        {hasThumbnail && fileItem?.thumbnailBlobUrl && (
          <FileThumbnailPreview
            thumbnailPath={fileItem.thumbnailBlobUrl}
            title={item.title}
            imageCount={imageFiles.length}
            onViewImage={() => setShowImageViewer(true)}
          />
        )}

        {/* Card Body: 12px padding (layout.card.padding 12px) */}
        <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            {/* Header: Accent dot + Type label and Pin/Status badges */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {/* 10px accent dot (dimension.accent-dot 10px) */}
                <span
                  className="w-2.5 h-2.5 rounded-xs border border-[#3D4A5C]/40 shrink-0"
                  style={{ backgroundColor: theme.accentColor }}
                />
                <span className="type-label-code-bold text-[#3D4A5C] truncate">
                  {item.type === 'file' ? (
                    <>Tệp tài liệu · {fileCategoryTag} · {formatFileSize(totalFileBytes)}</>
                  ) : (
                    theme.label
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.type === 'file' && fileListInfo && fileListInfo.totalCount > 1 && (
                  <span
                    className="px-1.5 py-0.5 rounded-xs type-nano-code font-bold bg-[#E8E8E8] text-[#3D4A5C] border border-[#3D4A5C]/30 shrink-0"
                    title={`${fileListInfo.totalCount} tệp trong bộ tri thức`}
                  >
                    {fileListInfo.totalCount} TỆP
                  </span>
                )}
                {item.isPinned && (
                  <span
                    className="material-symbols-outlined text-[16px] text-[#3D4A5C]"
                    title="Đã ghim"
                  >
                    push_pin
                  </span>
                )}
                {item.status === 'inbox' && variant === 'library' && (
                  <span className="px-1.5 py-0.5 rounded-sm type-nano-code font-bold bg-[#E0DFDE] text-[#1B1B1B] border border-[#3D4A5C]/30">
                    HỘP CHỜ
                  </span>
                )}
              </div>
            </div>

            {/* Title - Protected against overflow */}
            <h2 className="type-headline-xs text-[#1B1B1B] group-hover:text-[#3D4A5C] line-clamp-2 leading-snug mb-1 break-words [overflow-wrap:anywhere]">
              {item.title}
            </h2>

            {/* Context line */}
            {contextLine && (
              <p className="type-body-sm text-[#44474C] line-clamp-2 leading-relaxed mb-2 break-words [overflow-wrap:anywhere]">
                {contextLine}
              </p>
            )}

            {/* File Attachments List: Each file on its own line */}
            {fileListInfo && fileListInfo.totalCount > 0 && (
              <div className="space-y-1.5 mb-2.5">
                {fileListInfo.displayedFiles.map((file, idx) => (
                  <div
                    key={file.id || idx}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm bg-[#FFFFFF] border border-[#3D4A5C]/20 type-code-sm text-[#1B1B1B] max-w-full min-w-0 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px] shrink-0 text-[#3D4A5C]">
                      {file.type === 'image'
                        ? 'image'
                        : file.type === 'pdf'
                        ? 'picture_as_pdf'
                        : file.type === 'markdown'
                        ? 'description'
                        : 'draft'}
                    </span>
                    <span
                      className="truncate min-w-0 flex-1 font-mono text-[11px] text-[#1B1B1B] font-medium"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                    <span className="type-nano-code text-[#75777D] font-mono shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                    {file.isThumbnail && (
                      <span className="px-1.5 py-0.5 rounded-xs bg-[#3D4A5C] text-white text-[9px] font-mono font-bold shrink-0">
                        THUMBNAIL
                      </span>
                    )}
                  </div>
                ))}

                {fileListInfo.remainingCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#FFFFFF] border border-dashed border-[#3D4A5C]/40 text-[#3D4A5C]">
                    <span className="material-symbols-outlined text-[14px] shrink-0">
                      more_horiz
                    </span>
                    <span className="type-micro-code font-bold">
                      +{fileListInfo.remainingCount} tệp khác ({fileListInfo.totalCount} tệp trong bộ)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Nút 'Xem ảnh' nếu có image */}
            {hasImageFiles && !hasThumbnail && (
              <div className="mb-2.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImageViewer(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#3D4A5C] hover:bg-[#1B1B1B] active:scale-95 text-white text-xs font-mono font-bold shadow-hard-xs transition cursor-pointer border border-[#1B1B1B]"
                  title="Xem ảnh gốc hoàn chỉnh"
                >
                  <span className="material-symbols-outlined text-[15px]">visibility</span>
                  <span>XEM ẢNH</span>
                  {imageFiles.length > 1 && (
                    <span className="bg-white/20 px-1 py-0.2 rounded-xs text-[10px] font-mono font-bold">
                      {imageFiles.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Note Action: Sao chép button */}
            {item.type === 'note' && (
              <div className="flex items-center justify-end mb-2.5">
                <button
                  type="button"
                  onClick={handleCopyNote}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold shadow-hard-xs transition cursor-pointer border press-xs shrink-0 ${
                    copiedNote
                      ? 'bg-[#CDE8D6] text-[#2E6B48] border-[#2E6B48]'
                      : 'bg-[#FFFFFF] hover:bg-[#E8E8E8] text-[#1B1B1B] border-[#3D4A5C]/40 hover:border-[#1B1B1B]'
                  }`}
                  title="Sao chép nội dung ghi chú"
                  aria-label="Sao chép nội dung ghi chú"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedNote ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedNote ? 'ĐÃ CHÉP' : 'SAO CHÉP'}</span>
                </button>
              </div>
            )}

            {/* Link Domain & Truy Cập Button */}
            {item.type === 'link' && (
              <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                {linkDomain ? (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#FFFFFF] border border-[#3D4A5C]/20 type-label-code text-[#3D4A5C] max-w-[60%] truncate min-w-0">
                    <span className="material-symbols-outlined text-[13px] shrink-0">public</span>
                    <span className="truncate">{linkDomain}</span>
                  </div>
                ) : <div />}
                <button
                  type="button"
                  onClick={handleOpenLink}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#3D4A5C] hover:bg-[#1B1B1B] active:scale-95 text-white text-[11px] font-mono font-bold shadow-hard-xs transition cursor-pointer border border-[#1B1B1B] shrink-0 press-xs ml-auto"
                  title="Truy cập liên kết trong tab mới"
                  aria-label="Truy cập liên kết"
                >
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  <span>TRUY CẬP</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer: Tags and Timestamps */}
          <div className="pt-2 border-t border-[#3D4A5C]/20 flex items-center justify-between text-[11px] text-[#75777D]">
            <div className="flex items-center gap-1 overflow-hidden flex-wrap">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className="type-label-code px-1.5 py-0.5 rounded-xs bg-[#FFFFFF] border border-[#3D4A5C]/20 text-[#3D4A5C]"
                >
                  #{t.name}
                </span>
              ))}
            </div>
            <span className="type-nano-code shrink-0 ml-2 font-mono text-[#75777D]">
              {formatDate(item.savedAt || item.createdAt)}
            </span>
          </div>
        </div>

        {/* Inbox Variant: Action row */}
        {variant === 'inbox' && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="border-t border-[#3D4A5C]/20 bg-[#FFFFFF] px-3 py-2 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => itemService.moveItem(item.id, 'saved')}
                className="inline-flex items-center gap-1 font-bold text-xs text-white bg-[#3D4A5C] hover:bg-[#1B1B1B] px-3 py-1.5 rounded-md border border-[#1B1B1B] shadow-hard-xs transition cursor-pointer press-xs"
              >
                <span className="material-symbols-outlined text-[15px]">bookmark_add</span>
                <span>Giữ lâu dài</span>
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-md text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#FAF9F7] cursor-pointer"
                aria-label="Tùy chọn khác"
              >
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowMenu(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 bottom-full mb-1 z-30 w-48 bg-[#FFFFFF] border-2 border-[#3D4A5C] rounded-lg shadow-hard-lg py-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setShowColPicker(true);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FAF9F7] text-[#1B1B1B] cursor-pointer font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">
                        folder
                      </span>
                      <span>Cho vào bộ sưu tập</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        itemService.togglePin(item.id);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FAF9F7] text-[#1B1B1B] cursor-pointer font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">
                        push_pin
                      </span>
                      <span>{item.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenDelete}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FFDAD6] text-[#BA1A1A] cursor-pointer font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Xóa mục</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </article>

      {/* Full Original Image Viewer Modal */}
      {hasImageFiles && (
        <ImageViewerModal
          isOpen={showImageViewer}
          onClose={() => setShowImageViewer(false)}
          images={imageFiles}
          initialImageId={fileItem?.thumbnailFileId}
          itemTitle={item.title}
        />
      )}

      {/* Collection Picker Dialog */}
      <CollectionPicker
        isOpen={showColPicker}
        onClose={() => setShowColPicker(false)}
        selectedCollectionIds={item.collections || []}
        onChange={handleSaveToCollection}
      />

      {/* Delete Confirmation Sheet */}
      <ConfirmSheet
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => itemService.deleteItem(item.id)}
        item={item}
        embedCount={embedCount}
      />
    </>
  );
};
