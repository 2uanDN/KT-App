import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { DetailChrome } from '../components/detail/DetailChrome';
import { NoteBody } from '../components/detail/NoteBody';
import { FileViewer } from '../components/detail/FileViewer';
import { LinkPanel } from '../components/detail/LinkPanel';
import { MetaBlock } from '../components/detail/MetaBlock';
import { itemService } from '../services/ItemService';
import { db } from '../db/database';
import type { Item, NoteItem, FileItem, LinkItem } from '../types/item';

export const ItemDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const item = useLiveQuery<Item | undefined>(
    async () => {
      if (!id) return undefined;
      return db.items.get(id);
    },
    [id]
  );

  // Update lastOpenedAt on view
  useEffect(() => {
    if (id) {
      itemService.touchOpened(id);
    }
  }, [id]);

  if (!item && item !== undefined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-[36px] text-[#BA1A1A] mb-2">
          error_outline
        </span>
        <h2 className="type-headline-xs text-[#1B1B1B]">Không tìm thấy mục tri thức</h2>
        <p className="type-body-xs text-[#75777D] mt-1 mb-4">
          Mục này có thể đã bị xóa hoặc không tồn tại.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-[#3D4A5C] hover:bg-[#1B1B1B] text-white rounded-lg text-xs font-mono font-bold border border-[#1B1B1B] shadow-hard-xs transition cursor-pointer press-xs"
        >
          QUAY LẠI THƯ VIỆN
        </button>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <span className="w-6 h-6 border-2 border-[#3D4A5C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const backLabel = item.status === 'inbox' ? 'Hộp chờ' : 'Thư viện';

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF] min-h-screen">
      <DetailChrome item={item} backLabel={backLabel} />

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full pb-20">
        {/* Main Content Component by Type */}
        {item.type === 'note' && (
          <NoteBody
            item={item as NoteItem}
            onOpenItem={(targetId) => navigate(`/items/${targetId}`)}
          />
        )}

        {item.type === 'file' && <FileViewer item={item as FileItem} />}

        {item.type === 'link' && <LinkPanel item={item as LinkItem} />}

        {/* Metadata Block */}
        <MetaBlock item={item} />
      </div>
    </div>
  );
};
