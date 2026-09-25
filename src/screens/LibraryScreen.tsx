import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '../components/shell/TopBar';
import { FilterBar } from '../components/filter/FilterBar';
import { SortBar } from '../components/filter/SortBar';
import { SortSheet } from '../components/filter/SortSheet';
import { ItemCard } from '../components/list/ItemCard';
import { GroupHeading } from '../components/list/GroupHeading';
import { InboxCountLine } from '../components/list/InboxCountLine';
import { EmptyState } from '../components/list/EmptyState';
import { LoadMoreButton } from '../components/list/LoadMoreButton';
import { PWAInstallButton } from '../components/shell/PWAInstallButton';
import { useLibraryStore } from '../store/libraryStore';
import { usePaginatedItems } from '../hooks/usePaginatedItems';
import { useScrollPreservation } from '../hooks/useScrollPreservation';
import { useInboxCount } from '../hooks/useLiveCount';
import { db } from '../db/database';
import type { Item } from '../types/item';

export const LibraryScreen: React.FC = () => {
  const navigate = useNavigate();
  const listRef = useScrollPreservation('library');
  const [showSortSheet, setShowSortSheet] = useState(false);

  const {
    activeTypeFilter,
    activeTagFilter,
    sortMode,
  } = useLibraryStore();

  const inboxCount = useInboxCount();

  // Load all saved items from Dexie
  const allSavedItems = useLiveQuery(
    () => db.items.where('status').equals('saved').toArray(),
    []
  ) || [];

  // Filter items
  const filteredItems = useMemo(() => {
    return allSavedItems.filter((item) => {
      // 1. Type filter
      if (activeTypeFilter === 'pinned' && !item.isPinned) return false;
      if (activeTypeFilter === 'note' && item.type !== 'note') return false;
      if (activeTypeFilter === 'file' && item.type !== 'file') return false;
      if (activeTypeFilter === 'link' && item.type !== 'link') return false;

      // 2. Tag filter (Additive)
      if (activeTagFilter && (!item.tags || !item.tags.includes(activeTagFilter))) {
        return false;
      }

      return true;
    });
  }, [allSavedItems, activeTypeFilter, activeTagFilter]);

  // Sort items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    return list.sort((a, b) => {
      if (sortMode === 'title') {
        return a.title.localeCompare(b.title, 'vi');
      }
      if (sortMode === 'lastOpenedAt') {
        const timeA = a.lastOpenedAt || 0;
        const timeB = b.lastOpenedAt || 0;
        return timeB - timeA;
      }
      // default: savedAt
      const timeA = a.savedAt || a.createdAt;
      const timeB = b.savedAt || b.createdAt;
      return timeB - timeA;
    });
  }, [filteredItems, sortMode]);

  // Paginated list (10 items/page)
  const {
    items: displayItems,
    hasMore,
    loadMore,
    totalCount,
    visibleCount,
  } = usePaginatedItems<Item>(sortedItems);

  // Group by pinned if viewing 'all' and not filtering to specific type
  const { pinnedItems, regularItems } = useMemo(() => {
    if (activeTypeFilter === 'pinned') {
      return { pinnedItems: [], regularItems: displayItems };
    }
    const pinned = displayItems.filter((i) => i.isPinned);
    const regular = displayItems.filter((i) => !i.isPinned);
    return { pinnedItems: pinned, regularItems: regular };
  }, [displayItems, activeTypeFilter]);

  const hasActiveFilter = activeTypeFilter !== 'all' || activeTagFilter !== null;

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF]" ref={listRef}>
      {/* TopBar with PWA install button and search button */}
      <TopBar
        variant="list"
        title="Thư viện"
        onSearchClick={() => navigate('/search')}
        rightAction={<PWAInstallButton />}
      />

      {/* Filter Bar with Type & Tag chips and 32px overlay */}
      <FilterBar />

      {/* Separate Sort Bar section */}
      <SortBar onOpenSort={() => setShowSortSheet(true)} />

      <div className="p-4 flex-1">
        {/* Inbox count banner */}
        <InboxCountLine />

        {/* Empty States */}
        {allSavedItems.length === 0 && !hasActiveFilter && (
          <EmptyState
            title="Chưa có mục nào được giữ lâu dài"
            subtitle="Các mục trong thư viện là những tri thức quan trọng được lưu giữ vĩnh viễn."
            icon="auto_stories"
            action={
              inboxCount > 0
                ? { label: 'Xem Hộp chờ', to: '/inbox' }
                : { label: 'Tạo tri thức đầu tiên', to: '/save' }
            }
          />
        )}

        {allSavedItems.length > 0 && displayItems.length === 0 && hasActiveFilter && (
          <EmptyState
            title="Không có mục nào khớp"
            subtitle="Hãy thử thay đổi các bộ lọc hiện tại."
            icon="filter_alt_off"
          />
        )}

        {/* Items List */}
        {displayItems.length > 0 && (
          <div className="space-y-4">
            {/* Pinned Group */}
            {pinnedItems.length > 0 && (
              <section className="space-y-2.5">
                <GroupHeading
                  title="ĐÃ GHIM"
                  icon="push_pin"
                  count={pinnedItems.length}
                />
                <div className="grid grid-cols-1 gap-3">
                  {pinnedItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onOpen={(id) => navigate(`/items/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Regular Saved Group */}
            {regularItems.length > 0 && (
              <section className="space-y-2.5">
                {pinnedItems.length > 0 && (
                  <GroupHeading
                    title="ĐÃ GIỮ"
                    icon="bookmark"
                    count={sortedItems.length - pinnedItems.length}
                  />
                )}
                <div className="grid grid-cols-1 gap-3">
                  {regularItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onOpen={(id) => navigate(`/items/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Load more button */}
            <LoadMoreButton
              hasMore={hasMore}
              onLoadMore={loadMore}
              visibleCount={visibleCount}
              totalCount={totalCount}
            />
          </div>
        )}
      </div>

      <SortSheet
        isOpen={showSortSheet}
        onClose={() => setShowSortSheet(false)}
      />
    </div>
  );
};
