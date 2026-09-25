import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { EditorForm } from '../components/editor/EditorForm';
import { db } from '../db/database';
import type { Item } from '../types/item';

export const EditScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const item = useLiveQuery<Item | undefined>(
    async () => {
      if (!id) return undefined;
      return db.items.get(id);
    },
    [id]
  );

  if (!item && item !== undefined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="type-headline-xs text-[#BA1A1A]">Không tìm thấy mục cần sửa</p>
        <button
          onClick={() => navigate('/')}
          className="mt-3 px-4 py-2 bg-[#3D4A5C] text-white rounded-lg text-xs font-mono font-bold shadow-hard-xs hover:bg-[#1B1B1B] transition cursor-pointer press-xs"
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

  return <EditorForm initialItem={item} isEditing={true} />;
};
