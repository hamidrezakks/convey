import { Check, ChevronDown, Search, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from './badge';

export interface ComboboxItem {
  value: string;
  label: string;
  sublabel?: string;
  group?: string;
  categoryKey?: string;
  badge?: string;
  badgeVariant?: 'cyan' | 'purple' | 'success' | 'warning' | 'default' | 'outline';
  icon?: React.ReactNode;
  keywords?: string[];
}

export interface ComboboxGroup {
  label: string;
  categoryKey?: string;
  items: ComboboxItem[];
}

export interface ComboboxProps {
  items?: ComboboxItem[];
  groups?: ComboboxGroup[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  popoverClassName?: string;
  showCategoryTabs?: boolean;
  clearable?: boolean;
}

export const Combobox: React.FC<ComboboxProps> = ({
  items = [],
  groups,
  value,
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Type to search...',
  disabled = false,
  className,
  triggerClassName,
  popoverClassName,
  showCategoryTabs = true,
  clearable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const comboboxId = useId();

  // Flatten all items from groups if provided
  const allItems = useMemo<ComboboxItem[]>(() => {
    if (groups && groups.length > 0) {
      return groups.flatMap((g) =>
        g.items.map((item) => ({
          ...item,
          group: item.group || g.label,
          categoryKey: item.categoryKey || g.categoryKey,
        })),
      );
    }
    return items;
  }, [groups, items]);

  // Find currently selected item
  const selectedItem = useMemo(() => {
    return allItems.find((item) => item.value === value);
  }, [allItems, value]);

  // Available categories for filter pills
  const categories = useMemo(() => {
    if (!groups || groups.length <= 1) return [];
    return [
      { key: 'ALL', label: 'All', count: allItems.length },
      ...groups.map((g) => ({
        key: g.categoryKey || g.label,
        label: g.label
          .replace(/^──\s*|\s*──$/g, '')
          .replace(/\(\d+\)/g, '')
          .trim(),
        count: g.items.length,
      })),
    ];
  }, [groups, allItems]);

  // Filtered items based on search query and category
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return allItems.filter((item) => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        const itemCat = item.categoryKey || item.group;
        if (itemCat !== selectedCategory && item.group !== selectedCategory) {
          return false;
        }
      }

      if (!query) return true;

      const matchesLabel = item.label.toLowerCase().includes(query);
      const matchesValue = item.value.toLowerCase().includes(query);
      const matchesSublabel = item.sublabel?.toLowerCase().includes(query) ?? false;
      const matchesBadge = item.badge?.toLowerCase().includes(query) ?? false;
      const matchesKeywords = item.keywords?.some((k) => k.toLowerCase().includes(query)) ?? false;

      return matchesLabel || matchesValue || matchesSublabel || matchesBadge || matchesKeywords;
    });
  }, [allItems, searchQuery, selectedCategory]);

  // Group filtered items for display
  const filteredGroups = useMemo(() => {
    const map = new Map<string, ComboboxItem[]>();

    for (const item of filteredItems) {
      const grp = item.group || 'General';
      const list = map.get(grp) || [];
      list.push(item);
      map.set(grp, list);
    }

    return Array.from(map.entries()).map(([label, groupItems]) => ({
      label,
      items: groupItems,
    }));
  }, [filteredItems]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems]);

  // Auto scroll highlighted element into view on keyboard navigation
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.querySelector('[data-highlighted="true"]') as HTMLElement | null;
      highlightedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 30);
    } else {
      setSearchQuery('');
      setSelectedCategory('ALL');
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (filteredItems[highlightedIndex]) {
          handleSelect(filteredItems[highlightedIndex].value);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setIsOpen(false);
        break;
      }
      case 'Tab': {
        setIsOpen(false);
        break;
      }
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={cn('relative w-full select-none', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        id={comboboxId}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all cursor-pointer group hover:border-slate-300 dark:hover:border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500',
          isOpen && 'border-sky-500 ring-1 ring-sky-500 bg-white dark:bg-slate-900',
          disabled && 'cursor-not-allowed opacity-50 bg-slate-100 dark:bg-slate-950',
          triggerClassName,
        )}
      >
        <div className="flex items-center gap-2.5 truncate text-left mr-2 min-w-0">
          {selectedItem ? (
            <>
              {selectedItem.icon}
              {selectedItem.badge && (
                <Badge
                  variant={selectedItem.badgeVariant || 'outline'}
                  className="px-1.5 py-0 text-[10px] font-mono shrink-0"
                >
                  {selectedItem.badge}
                </Badge>
              )}
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{selectedItem.label}</span>
              {selectedItem.sublabel && (
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                  ({selectedItem.sublabel})
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400 dark:text-slate-400">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {clearable && value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-slate-300',
              isOpen && 'rotate-180 text-sky-500 dark:text-sky-400',
            )}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 top-[calc(100%+6px)] z-50 w-full min-w-[320px] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/95 dark:bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95',
            popoverClassName,
          )}
        >
          {/* Search Input Bar */}
          <div className="relative mb-2 px-1">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 pl-9 pr-16 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {filteredItems.length}
                </span>
              </div>
            </div>
          </div>

          {/* Category Filter Tabs (if applicable) */}
          {showCategoryTabs && categories.length > 1 && (
            <div className="flex flex-wrap gap-1 px-1 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer',
                    selectedCategory === cat.key
                      ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent',
                  )}
                >
                  <span>{cat.label}</span>
                  <span
                    className={cn(
                      'text-[9px] px-1 rounded-full font-mono',
                      selectedCategory === cat.key
                        ? 'bg-sky-500 dark:bg-sky-400 text-white dark:text-slate-950 font-bold'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
                    )}
                  >
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Scrollable Results List */}
          <div
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-64 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent"
          >
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                <p>No providers matching &quot;{searchQuery}&quot;</p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('ALL');
                    }}
                    className="mt-2 text-sky-600 dark:text-sky-400 hover:text-sky-500 underline text-xs font-semibold cursor-pointer"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : (
              filteredGroups.map((group) => {
                return (
                  <div key={group.label} className="space-y-1">
                    {/* Group Header */}
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center justify-between">
                      <span>{group.label}</span>
                      <span className="font-mono text-[9px] text-slate-400">{group.items.length}</span>
                    </div>

                    {/* Group Items */}
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const globalIndex = filteredItems.findIndex((i) => i.value === item.value);
                        const isSelected = item.value === value;
                        const isHighlighted = globalIndex === highlightedIndex;

                        return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            data-highlighted={isHighlighted ? 'true' : 'false'}
                            key={item.value}
                            onMouseEnter={() => setHighlightedIndex(globalIndex)}
                            onClick={() => handleSelect(item.value)}
                            className={cn(
                              'group/opt w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors text-left rtl:text-right',
                              isSelected && 'bg-sky-500/15 text-sky-700 dark:text-sky-200 font-semibold',
                              !isSelected &&
                                isHighlighted &&
                                'bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white',
                              !isSelected &&
                                !isHighlighted &&
                                'text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-900/60',
                            )}
                          >
                            <div className="flex items-center gap-2 truncate min-w-0">
                              {item.icon}
                              <span className="truncate">{item.label}</span>
                              {item.sublabel && (
                                <span
                                  className={cn(
                                    'text-[10px] font-mono shrink-0',
                                    isSelected
                                      ? 'text-sky-600 dark:text-sky-300'
                                      : 'text-slate-400 group-hover/opt:text-slate-600 dark:group-hover/opt:text-slate-300',
                                  )}
                                >
                                  ({item.sublabel})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2 rtl:ml-0 rtl:mr-2">
                              {item.badge && (
                                <span
                                  className={cn(
                                    'text-[9px] font-mono px-1.5 py-0.2 rounded border',
                                    item.badge === 'EMAIL' &&
                                      'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20',
                                    item.badge === 'SMS' &&
                                      'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20',
                                    item.badge === 'PUSH' &&
                                      'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20',
                                    item.badge === 'CHAT' &&
                                      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
                                    item.badge === 'TOOL' &&
                                      'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20',
                                    !['EMAIL', 'SMS', 'PUSH', 'CHAT', 'TOOL'].includes(item.badge) &&
                                      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
                                  )}
                                >
                                  {item.badge}
                                </span>
                              )}

                              {isSelected && <Check className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
