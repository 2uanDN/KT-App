import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '../components/shell/TopBar';
import { ItemCard } from '../components/list/ItemCard';
import { EmptyState } from '../components/list/EmptyState';
import { db } from '../db/database';
import type { Tag } from '../types/tag';
import type { Item } from '../types/item';

export const TagDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const tag = useLiveQuery<Tag | undefined>(
    async () => {
      if (!id) return undefined;
      return db.tags.get(id);
    },
    [id]
  );

  const items = useLiveQuery<Item[]>(
    async () => {
      if (!id) return [];
      const list = await db.items.where('tags').equals(id).toArray();
      const uniqueMap = new Map<string, Item>();
      for (const item of list) {
        uniqueMap.set(item.id, item);
      }
      return Array.from(uniqueMap.values());
    },
    [id]
  ) || [];

  if (!tag && tag !== undefined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="type-headline-xs text-[#BA1A1A]">Không tìm thấy thẻ</p>
        <button
          onClick={() => navigate('/tags')}
          className="mt-3 px-4 py-2 bg-[#3D4A5C] text-white rounded-lg text-xs font-mono font-bold shadow-hard-xs"
        >
          QUAY LẠI THẺ
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF] min-h-screen">
      <TopBar
        variant="detail"
        backLabel="Thẻ"
        onBack={() => navigate('/tags')}
      />

      {/* Header Banner */}
      <div className="p-4 bg-[#FAF9F7] border-b border-[#3D4A5C]">
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <span className="material-symbols-outlined text-[22px] text-[#3D4A5C] shrink-0">tag</span>
          <h1 className="type-headline-sm text-[#1B1B1B] break-words [overflow-wrap:anywhere] min-w-0 flex-1 font-mono">
            #{tag?.name}
          </h1>
        </div>
        <p className="type-nano-code text-[#44474C]">
          GẮN TRONG {items.length} MỤC TRI THỨC
        </p>
      </div>

      <div className="p-4 flex-1">
        {items.length === 0 ? (
          <EmptyState
            title="Chưa có mục nào gắn thẻ này"
            subtitle="Bạn có thể gán thẻ này khi lưu hoặc chỉnh sửa mục."
            icon="tag"
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onOpen={(itemId) => navigate(`/items/${itemId}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
