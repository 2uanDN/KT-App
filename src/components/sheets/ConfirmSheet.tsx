import React from 'react';
import { Sheet } from './Sheet';
import type { Item } from '../../types/item';

interface ConfirmSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  item?: Item | null;
  embedCount?: number;
  title?: string;
  customMessage?: string;
  confirmLabel?: string;
  isDestructive?: boolean;
}

const typeLabel = (type: string) => {
  switch (type) {
    case 'note':
      return 'Ghi chú';
    case 'file':
      return 'Tệp tài liệu';
    case 'link':
      return 'Liên kết';
    default:
      return 'Mục';
  }
};

export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  isOpen,
  onClose,
  onConfirm,
  item,
  embedCount = 0,
  title = 'Xác nhận xóa',
  customMessage,
  confirmLabel = 'Xóa mục',
  isDestructive = true,
}) => {
  const getMessage = () => {
    if (customMessage) return customMessage;
    if (!item) return 'Bạn có chắc chắn muốn thực hiện hành động này?';

    const name = `"${item.title}"`;
    if (item.type === 'note') {
      return `Xóa ghi chú ${name}. Các tệp và liên kết đã chèn trong ghi chú vẫn được giữ nguyên.`;
    }
    if (embedCount > 0) {
      return `${typeLabel(item.type)} này đang nằm trong ${embedCount} ghi chú. Xóa sẽ gỡ ${typeLabel(item.type).toLowerCase()} khỏi các ghi chú đó (hiển thị [Đã xóa]).`;
    }
    return `Xóa ${typeLabel(item.type).toLowerCase()} ${name}. Thao tác này không thể hoàn tác.`;
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="type-body-sm leading-relaxed text-[#1B1B1B] break-words [overflow-wrap:anywhere]">{getMessage()}</p>

        <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#3D4A5C]/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono font-bold text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] transition cursor-pointer press-xs"
          >
            HỦY
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition shadow-hard-xs cursor-pointer press-sm border ${
              isDestructive
                ? 'bg-[#BA1A1A] text-white hover:bg-[#93000A] border-[#93000A]'
                : 'bg-[#3D4A5C] text-white hover:bg-[#1B1B1B] border-[#1B1B1B]'
            }`}
          >
            {confirmLabel.toUpperCase()}
          </button>
        </div>
      </div>
    </Sheet>
  );
};
