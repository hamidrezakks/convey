import { Check, ChevronDown, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useI18n } from './context';
import type { SupportedLocale } from './types';

export interface LanguageSwitcherProps {
  className?: string;
  variant?: 'navbar' | 'compact' | 'expanded';
}

export function LanguageSwitcher({ className, variant = 'navbar' }: LanguageSwitcherProps) {
  const { locale, setLocale, config, supportedLocales, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectLanguage = (newLocale: SupportedLocale) => {
    if (newLocale === locale) {
      setIsOpen(false);
      return;
    }

    setLocale(newLocale);
    setIsOpen(false);

    const targetConfig = supportedLocales.find((l) => l.code === newLocale);
    if (targetConfig) {
      toast.success(`${targetConfig.nativeName} (${targetConfig.name})`, {
        description: t('common.success'),
      });
    }
  };

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      <button
        type="button"
        aria-label={t('common.language')}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'h-9 flex items-center gap-2 px-2.5 sm:px-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs group select-none whitespace-nowrap shrink-0',
          isOpen &&
            'border-sky-500/50 ring-2 ring-sky-500/20 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white',
        )}
      >
        <span className="text-base leading-none select-none">{config.flag}</span>
        {variant !== 'compact' && (
          <div className="hidden xl:flex items-center gap-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-200">{config.nativeName}</span>
          </div>
        )}

        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180 text-sky-500 dark:text-sky-400',
          )}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-64 p-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 mb-1">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-sky-500 dark:text-sky-400" />
              <span>{t('common.language')}</span>
            </div>
            <span className="font-mono text-[9px] text-slate-400">8 Supported</span>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1 custom-scrollbar">
            {supportedLocales.map((loc) => {
              const isSelected = loc.code === locale;
              return (
                <button
                  key={loc.code}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectLanguage(loc.code)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors group text-left rtl:text-right cursor-pointer',
                    isSelected
                      ? 'bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-white font-medium border border-sky-500/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/90 hover:text-slate-900 dark:hover:text-white',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0 select-none leading-none">{loc.flag}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {loc.nativeName}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <span>{loc.name}</span>
                        <span>•</span>
                        <span className="truncate">{loc.region}</span>
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
