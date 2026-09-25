import React from 'react';

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  onClear?: () => void;
  icon?: string;
  count?: number;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  isActive,
  onClick,
  onClear,
  icon,
  count,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg type-label-code-bold transition-all duration-100 cursor-pointer shrink-0 border select-none press-xs ${
        isActive
          ? 'bg-[#3D4A5C] text-white border-[#1B1B1B] shadow-hard-sm'
          : 'bg-[#FAF9F7] text-[#44474C] border-[#3D4A5C]/30 hover:border-[#3D4A5C] hover:text-[#1B1B1B] hover:bg-[#FFFFFF]'
      }`}
    >
      {icon && (
        <span className="material-symbols-outlined text-[15px]">{icon}</span>
      )}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`type-nano-code px-1.5 py-0.5 rounded-xs font-mono font-bold ${
            isActive ? 'bg-white text-[#3D4A5C]' : 'bg-[#E0DFDE] text-[#44474C]'
          }`}
        >
          {count}
        </span>
      )}
      {onClear && isActive && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="ml-0.5 hover:opacity-80 p-0.5 rounded-xs cursor-pointer"
          aria-label={`Xóa bộ lọc ${label}`}
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </span>
      )}
    </button>
  );
};
