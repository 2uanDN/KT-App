import React from 'react';
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer';
import type { NoteItem } from '../../types/item';

interface NoteBodyProps {
  item: NoteItem;
  onOpenItem?: (id: string) => void;
}

export const NoteBody: React.FC<NoteBodyProps> = ({ item, onOpenItem }) => {
  return (
    <div className="bg-[#FFFFFF] rounded-lg border border-[#3D4A5C] p-4 shadow-hard-md min-w-0">
      <h1 className="type-headline-md text-[#1B1B1B] pb-3 border-b border-[#3D4A5C]/20 mb-3 break-words [overflow-wrap:anywhere] leading-snug">
        {item.title}
      </h1>
      <MarkdownRenderer
        content={item.body}
        embeds={item.embeds}
        onOpenItem={onOpenItem}
      />
    </div>
  );
};
