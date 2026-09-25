import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '../components/shell/TopBar';
import { EmptyState } from '../components/list/EmptyState';
import { db } from '../db/database';

export const TagsScreen: React.FC = () => {
  const navigate = useNavigate();

  const rawTags = useLiveQuery(() => db.tags.orderBy('name').toArray(), []) || [];

  // Deduplicate display tags by normalized name just in case
  const tags = useMemo(() => {
    const seen = new Set<string>();
    return rawTags.filter((tag) => {
      const norm = tag.name.toLowerCase().trim().replace(/^#+/, '').replace(/\s+/g, '-');
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }, [rawTags]);

  // Count distinct item usage for each tag
  const tagCounts = useLiveQuery(async () => {
    const allItems = await db.items.toArray();
    const map: Record<string, number> = {};
    for (const item of allItems) {
      if (item.tags) {
        const uniqueTagIds = new Set(item.tags);
        for (const tagId of uniqueTagIds) {
          map[tagId] = (map[tagId] || 0) + 1;
        }
      }
    }
    return map;
  }, []) || {};

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF]">
      <TopBar
        variant="list"
        title="Thẻ phân loại"
        onSearchClick={() => navigate('/search')}
      />

      <div className="p-4 flex-1">
        {tags.length === 0 ? (
          <EmptyState
            title="Chưa có thẻ nào"
            subtitle="Bạn có thể tạo thẻ mới khi lưu hoặc chỉnh sửa một mục tri thức."
            icon="tag"
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {tags.map((tag) => {
              const count = tagCounts[tag.id] || 0;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => navigate(`/tags/${tag.id}`)}
                  className="p-3 bg-[#FAF9F7] hover:bg-[#FFFFFF] border border-[#3D4A5C] hover:border-[#1B1B1B] shadow-hard-md hover:shadow-hard-sm rounded-lg flex items-center justify-between text-left transition group cursor-pointer press-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="type-label-code-bold text-[#1B1B1B] group-hover:text-[#3D4A5C] truncate">
                      #{tag.name}
                    </p>
                    <p className="type-nano-code text-[#44474C] mt-1">
                      {count} MỤC
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-[#3D4A5C] group-hover:translate-x-0.5 transition-transform">
                    chevron_right
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
