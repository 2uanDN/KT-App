import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from './Sheet';
import { db } from '../../db/database';
import { collectionService } from '../../services/CollectionService';

interface CollectionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCollectionIds: string[];
  onChange: (collectionIds: string[]) => void;
}

export const CollectionPicker: React.FC<CollectionPickerProps> = ({
  isOpen,
  onClose,
  selectedCollectionIds,
  onChange,
}) => {
  const [newCollectionName, setNewCollectionName] = useState('');

  const rawCollections = useLiveQuery(() => db.collections.orderBy('createdAt').reverse().toArray(), []) || [];

  const collections = useMemo(() => {
    const seen = new Set<string>();
    return rawCollections.filter((col) => {
      const norm = col.name.trim().toLowerCase();
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }, [rawCollections]);

  const handleToggle = (colId: string) => {
    if (selectedCollectionIds.includes(colId)) {
      onChange(selectedCollectionIds.filter((id) => id !== colId));
    } else {
      onChange(Array.from(new Set([...selectedCollectionIds, colId])));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      const created = await collectionService.createCollection(newCollectionName.trim());
      onChange(Array.from(new Set([...selectedCollectionIds, created.id])));
      setNewCollectionName('');
    } catch {
      // ignore
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Chọn Bộ Sưu Tập">
      <div className="space-y-4">
        {/* Create inline */}
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="Tạo bộ sưu tập mới..."
            className="flex-1 px-3 py-1.5 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newCollectionName.trim()}
            className="px-3.5 py-1.5 bg-[#3D4A5C] hover:bg-[#1B1B1B] text-white rounded-lg text-xs font-mono font-bold border border-[#1B1B1B] shadow-hard-xs disabled:opacity-50 transition cursor-pointer press-xs"
          >
            TẠO
          </button>
        </form>

        {/* Collection list */}
        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {collections.length === 0 ? (
            <p className="text-xs text-[#75777D] py-3 text-center italic font-mono">
              Chưa có bộ sưu tập nào. Hãy tạo một bộ sưu tập ở trên.
            </p>
          ) : (
            collections.map((col) => {
              const isSelected = selectedCollectionIds.includes(col.id);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleToggle(col.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition text-left cursor-pointer press-xs ${
                    isSelected
                      ? 'bg-[#FAF9F7] text-[#1B1B1B] font-bold border-2 border-[#3D4A5C] shadow-hard-xs'
                      : 'hover:bg-[#FAF9F7] text-[#1B1B1B] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-[18px] text-[#3D4A5C]">
                      folder
                    </span>
                    <span className="truncate">{col.name}</span>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[18px] text-[#3D4A5C]">
                      check
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="pt-2 border-t border-[#3D4A5C]/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#3D4A5C] hover:bg-[#1B1B1B] text-white rounded-lg text-xs font-mono font-bold border border-[#1B1B1B] shadow-hard-xs transition cursor-pointer press-xs"
          >
            XONG
          </button>
        </div>
      </div>
    </Sheet>
  );
};
