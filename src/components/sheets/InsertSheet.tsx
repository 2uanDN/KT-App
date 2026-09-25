import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from './Sheet';
import { db } from '../../db/database';
import type { Item, EmbedRef } from '../../types/item';

interface InsertSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertWikiLink: (target: string, alias?: string) => void;
  onInsertEmbed: (embed: EmbedRef) => void;
  currentNoteId?: string;
}

export const InsertSheet: React.FC<InsertSheetProps> = ({
  isOpen,
  onClose,
  onInsertWikiLink,
  onInsertEmbed,
  currentNoteId,
}) => {
  const [tab, setTab] = useState<'all' | 'files' | 'links' | 'notes'>('all');
  const [query, setQuery] = useState('');

  const allItems = useLiveQuery(() => db.items.toArray(), []) || [];

  const candidateItems = allItems.filter(
    (item) => item.id !== currentNoteId
  );

  const filteredItems = candidateItems.filter((item) => {
    if (tab === 'files' && item.type !== 'file') return false;
    if (tab === 'links' && item.type !== 'link') return false;
    if (tab === 'notes' && item.type !== 'note') return false;
    if (query.trim() && !item.title.toLowerCase().includes(query.toLowerCase().trim())) {
      return false;
    }
    return true;
  });

  const handleSelect = (item: Item) => {
    if (item.type === 'note') {
      // Insert as standard WikiLink [[Title]]
      onInsertWikiLink(item.title);
    } else {
      // Insert as EmbedRef
      const embed: EmbedRef = {
        id: crypto.randomUUID(),
        position: 0,
        targetItemId: item.id,
        targetType: item.type as 'file' | 'link',
        snapshotTitle: item.title,
        isBroken: false,
      };
      onInsertEmbed(embed);
      // Also can insert inline reference `[[item.title]]`
      onInsertWikiLink(item.title);
    }
    onClose();
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Chèn Liên Kết / Tệp Đính Kèm">
      <div className="space-y-3">
        {/* Type tabs */}
        <div className="flex border-b border-[#3D4A5C]/20 text-xs font-mono">
          <button
            onClick={() => setTab('all')}
            className={`flex-1 py-1.5 text-center type-label-code-bold cursor-pointer ${
              tab === 'all'
                ? 'border-b-2 border-[#3D4A5C] text-[#3D4A5C]'
                : 'text-[#75777D] hover:text-[#1B1B1B]'
            }`}
          >
            TẤT CẢ
          </button>
          <button
            onClick={() => setTab('notes')}
            className={`flex-1 py-1.5 text-center type-label-code-bold cursor-pointer ${
              tab === 'notes'
                ? 'border-b-2 border-[#3D4A5C] text-[#3D4A5C]'
                : 'text-[#75777D] hover:text-[#1B1B1B]'
            }`}
          >
            GHI CHÚ
          </button>
          <button
            onClick={() => setTab('files')}
            className={`flex-1 py-1.5 text-center type-label-code-bold cursor-pointer ${
              tab === 'files'
                ? 'border-b-2 border-[#3D4A5C] text-[#3D4A5C]'
                : 'text-[#75777D] hover:text-[#1B1B1B]'
            }`}
          >
            TỆP
          </button>
          <button
            onClick={() => setTab('links')}
            className={`flex-1 py-1.5 text-center type-label-code-bold cursor-pointer ${
              tab === 'links'
                ? 'border-b-2 border-[#3D4A5C] text-[#3D4A5C]'
                : 'text-[#75777D] hover:text-[#1B1B1B]'
            }`}
          >
            LIÊN KẾT
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm kiếm mục cần chèn..."
          className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-xs bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
        />

        {/* Items List */}
        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {filteredItems.length === 0 ? (
            <p className="text-xs text-[#75777D] py-6 text-center italic font-mono">
              Không tìm thấy mục nào.
            </p>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border border-[#3D4A5C]/30 hover:border-[#3D4A5C] bg-[#FAF9F7] hover:bg-[#FFFFFF] text-left transition cursor-pointer shadow-hard-xs hover:shadow-hard-sm press-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="material-symbols-outlined text-[16px] text-[#3D4A5C] shrink-0">
                    {item.type === 'note' ? 'description' : item.type === 'file' ? 'draft' : 'link'}
                  </span>
                  <span className="text-xs font-bold text-[#1B1B1B] truncate min-w-0 flex-1">
                    {item.title}
                  </span>
                </div>
                <span className="type-nano-code font-bold uppercase px-1.5 py-0.5 bg-[#FFFFFF] border border-[#3D4A5C]/30 rounded-xs shrink-0 text-[#3D4A5C]">
                  {item.type}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </Sheet>
  );
};
