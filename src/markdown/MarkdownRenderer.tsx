import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EmbedRef } from '../types/item';

interface MarkdownRendererProps {
  content: string;
  embeds?: EmbedRef[];
  onOpenItem?: (id: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  embeds = [],
  onOpenItem,
}) => {
  const navigate = useNavigate();

  const handleLinkClick = (target: string) => {
    if (onOpenItem) {
      onOpenItem(target);
    } else {
      navigate(`/items/${target}`);
    }
  };

  // Parse YAML Frontmatter if present
  const { frontmatter, body } = useMemo(() => {
    if (!content.startsWith('---')) {
      return { frontmatter: null, body: content };
    }
    const endMatch = content.indexOf('\n---', 3);
    if (endMatch === -1) {
      return { frontmatter: null, body: content };
    }
    const rawFm = content.slice(3, endMatch).trim();
    const rest = content.slice(endMatch + 4).trim();
    const fmPairs: Record<string, string> = {};
    rawFm.split('\n').forEach((line) => {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k) fmPairs[k] = v;
      }
    });
    return { frontmatter: fmPairs, body: rest };
  }, [content]);

  // Transform inline formatting (Wikilinks [[target|alias]], bold, italic, inline code, links)
  const renderInline = (text: string) => {
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let match;

    while ((match = wikiRegex.exec(text)) !== null) {
      const start = match.index;
      if (start > lastIndex) {
        parts.push(text.substring(lastIndex, start));
      }
      const target = match[1].trim();
      const alias = match[2]?.trim() || target;

      parts.push(
        <button
          key={`wiki-${start}`}
          onClick={(e) => {
            e.stopPropagation();
            handleLinkClick(target);
          }}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#FAF9F7] text-[#3D4A5C] hover:text-[#1B1B1B] hover:border-[#1B1B1B] rounded-xs text-[12px] font-mono font-bold transition cursor-pointer border border-[#3D4A5C] shadow-hard-xs press-xs"
          title={`Mở: ${target}`}
        >
          <span className="material-symbols-outlined text-[13px]">link</span>
          <span>{alias}</span>
        </button>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.map((part, i) => {
      if (typeof part !== 'string') return part;

      const subTokens = part.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
      return subTokens.map((token, j) => {
        if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
          return (
            <code
              key={`c-${i}-${j}`}
              className="bg-[#FAF9F7] px-1.5 py-0.5 rounded-xs font-mono text-[12px] text-[#1B1B1B] border border-[#3D4A5C]/30 shadow-hard-xs"
            >
              {token.slice(1, -1)}
            </code>
          );
        }
        if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
          return <strong key={`b-${i}-${j}`} className="font-bold text-[#1B1B1B]">{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
          return <em key={`i-${i}-${j}`} className="italic text-[#1B1B1B]">{token.slice(1, -1)}</em>;
        }
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          return (
            <a
              key={`a-${i}-${j}`}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3D4A5C] underline font-bold hover:text-[#1B1B1B]"
            >
              {linkMatch[1]}
            </a>
          );
        }
        return token;
      });
    });
  };

  // Split lines into structured blocks
  const blocks = useMemo(() => {
    const lines = body.split('\n');
    const result: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeLines: string[] = [];

    lines.forEach((line, idx) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          result.push(
            <div key={`cb-${idx}`} className="my-3 rounded-lg overflow-hidden border border-[#3D4A5C] bg-[#1B1B1B] text-white shadow-hard-xs">
              {codeLanguage && (
                <div className="bg-[#303030] px-3 py-1 type-nano-code text-[#C5C6CD] border-b border-[#44474C]">
                  {codeLanguage}
                </div>
              )}
              <pre className="p-3 text-[13px] font-mono overflow-x-auto leading-relaxed text-[#F1F1F1]">
                {codeLines.join('\n')}
              </pre>
            </div>
          );
          inCodeBlock = false;
          codeLines = [];
          codeLanguage = '';
        } else {
          inCodeBlock = true;
          codeLanguage = line.slice(3).trim();
          codeLines = [];
        }
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      // Headings
      if (line.startsWith('# ')) {
        result.push(<h1 key={`h1-${idx}`} className="type-headline-lg font-bold mt-5 mb-2 text-[#1B1B1B] pb-1 border-b border-[#3D4A5C]/20">{renderInline(line.slice(2))}</h1>);
        return;
      }
      if (line.startsWith('## ')) {
        result.push(<h2 key={`h2-${idx}`} className="type-headline-md font-bold mt-4 mb-2 text-[#1B1B1B]">{renderInline(line.slice(3))}</h2>);
        return;
      }
      if (line.startsWith('### ')) {
        result.push(<h3 key={`h3-${idx}`} className="type-headline-sm font-bold mt-3 mb-1.5 text-[#3D4A5C]">{renderInline(line.slice(4))}</h3>);
        return;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        result.push(
          <blockquote key={`bq-${idx}`} className="border-l-4 border-[#3D4A5C] bg-[#FAF9F7] pl-3 py-1.5 my-2.5 text-[14px] text-[#44474C] italic rounded-r border-y border-r border-[#3D4A5C]/15">
            {renderInline(line.slice(2))}
          </blockquote>
        );
        return;
      }

      // Checkbox / Tasks
      if (line.match(/^-\s*\[([ xX])\]\s+(.*)/)) {
        const match = line.match(/^-\s*\[([ xX])\]\s+(.*)/)!;
        const checked = match[1].toLowerCase() === 'x';
        return result.push(
          <div key={`task-${idx}`} className="flex items-center gap-2 my-1 text-[14px]">
            <input type="checkbox" checked={checked} readOnly className="rounded-xs text-[#3D4A5C] focus:ring-0 cursor-default" />
            <span className={checked ? 'line-through text-[#75777D]' : 'text-[#1B1B1B]'}>
              {renderInline(match[2])}
            </span>
          </div>
        );
      }

      // Lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        result.push(
          <li key={`li-${idx}`} className="ml-5 list-disc text-[14px] my-0.5 text-[#1B1B1B] leading-relaxed">
            {renderInline(line.slice(2))}
          </li>
        );
        return;
      }

      // Horizontal rule
      if (line.trim() === '---' || line.trim() === '***') {
        result.push(<hr key={`hr-${idx}`} className="my-4 border-[#3D4A5C]/20" />);
        return;
      }

      // Empty line
      if (!line.trim()) {
        result.push(<div key={`sp-${idx}`} className="h-2" />);
        return;
      }

      // Standard paragraph
      result.push(
        <p key={`p-${idx}`} className="type-body-md text-[#1B1B1B] leading-relaxed my-1">
          {renderInline(line)}
        </p>
      );
    });

    return result;
  }, [body]);

  return (
    <div className="markdown-body space-y-1 select-text">
      {/* YAML Frontmatter card if present */}
      {frontmatter && Object.keys(frontmatter).length > 0 && (
        <div className="mb-4 p-3 bg-[#FAF9F7] border border-[#3D4A5C] rounded-lg text-xs font-mono shadow-hard-xs">
          <div className="type-nano-code font-bold text-[#3D4A5C] mb-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">data_object</span>
            <span>METADATA</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[#44474C]">
            {Object.entries(frontmatter).map(([k, v]) => (
              <div key={k} className="flex gap-1.5 truncate">
                <span className="text-[#1B1B1B] font-bold">{k}:</span>
                <span className="truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main markdown content */}
      <div className="text-[14px] leading-relaxed">{blocks}</div>

      {/* Embedded references section */}
      {embeds && embeds.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#3D4A5C]/20">
          <h4 className="type-label-code-bold text-[#3D4A5C] mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">attachment</span>
            <span>MỤC ĐÍNH KÈM ({embeds.length})</span>
          </h4>
          <div className="space-y-2">
            {embeds.map((ref) => {
              if (ref.isBroken) {
                return (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between p-2.5 bg-[#FAF9F7] border border-dashed border-[#BA1A1A]/40 rounded-lg text-[13px] text-[#75777D]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#BA1A1A]">link_off</span>
                      <span className="line-through">{ref.snapshotTitle || 'Mục tham chiếu'}</span>
                    </div>
                    <span className="type-nano-code font-bold bg-[#FFDAD6] text-[#93000A] px-2 py-0.5 rounded-xs">
                      [ĐÃ XÓA]
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={ref.id}
                  onClick={() => handleLinkClick(ref.targetItemId)}
                  className="w-full flex items-center justify-between p-2.5 bg-[#FAF9F7] border border-[#3D4A5C] hover:border-[#1B1B1B] rounded-lg text-[13px] text-left transition group shadow-hard-xs hover:shadow-hard-sm cursor-pointer press-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">
                      {ref.targetType === 'file' ? 'draft' : 'link'}
                    </span>
                    <span className="font-bold text-[#1B1B1B] group-hover:text-[#3D4A5C] truncate">
                      {ref.snapshotTitle}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-[#3D4A5C] group-hover:translate-x-0.5 transition-transform">
                    arrow_forward
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
