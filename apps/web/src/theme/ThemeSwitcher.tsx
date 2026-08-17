import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '../i18n/context';
import { cn } from '../lib/utils';
import type { Theme } from './ThemeContext';
import { useTheme } from './ThemeContext';

export interface ThemeSwitcherProps {
  className?: string;
  variant?: 'navbar' | 'compact' | 'segmented';
}

export function ThemeSwitcher({ className, variant = 'navbar' }: ThemeSwitcherProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useI18n();
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

  const handleSelectTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsOpen(false);

    const themeName =
      newTheme === 'light'
        ? t('common.themeLight')
        : newTheme === 'dark'
          ? t('common.themeDark')
          : `${t('common.themeSystem')} (${resolvedTheme === 'dark' ? t('common.themeDark') : t('common.themeLight')})`;

    toast.success(themeName, {
      description: t('common.switchedTheme'),
    });
  };

  const getThemeIcon = () => {
    if (theme === 'system') {
      return <Monitor className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />;
    }
    if (resolvedTheme === 'dark') {
      return <Moon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />;
    }
    return <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  };

  const getThemeLabel = () => {
    if (theme === 'system') return t('common.themeSystem');
    if (theme === 'light') return t('common.themeLight');
    return t('common.themeDark');
  };

  if (variant === 'segmented') {
    return (
      <div
        className={cn(
          'h-9 inline-flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-900/80 border border-slate-300/80 dark:border-slate-800 gap-1 select-none',
          className,
        )}
      >
        <button
          type="button"
          onClick={() => handleSelectTheme('light')}
          title={t('common.themeLight')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap',
            theme === 'light'
              ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
          )}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>{t('common.themeLight')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTheme('dark')}
          title={t('common.themeDark')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap',
            theme === 'dark'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
          )}
        >
          <Moon className="w-3.5 h-3.5" />
          <span>{t('common.themeDark')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTheme('system')}
          title={t('common.themeSystem')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap',
            theme === 'system'
              ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
          )}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>{t('common.themeSystem')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      <button
        type="button"
        aria-label={t('common.theme')}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'h-9 flex items-center gap-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-xs group select-none whitespace-nowrap shrink-0',
          isOpen &&
            'border-sky-500/50 ring-2 ring-sky-500/20 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white',
        )}
      >
        {getThemeIcon()}

        {variant !== 'compact' && (
          <span className="font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap hidden xl:inline">
            {getThemeLabel()}
          </span>
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
          className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-64 p-1.5 bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 mb-1">
            <div className="flex items-center gap-1.5">
              <Sun className="w-3 h-3 text-amber-500" />
              <span>{t('common.theme')}</span>
            </div>
            <span className="font-mono text-[9px] text-slate-400">
              {resolvedTheme === 'dark' ? 'Dark Active' : 'Light Active'}
            </span>
          </div>

          {/* Light Theme Option */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelectTheme('light')}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors group text-left rtl:text-right cursor-pointer',
              theme === 'light'
                ? 'bg-amber-500/10 text-amber-900 dark:text-amber-300 font-medium border border-amber-500/30'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/90 hover:text-slate-900 dark:hover:text-white',
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t('common.themeLight')}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {t('common.themeLightDesc')}
                </div>
              </div>
            </div>
            {theme === 'light' && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />}
          </button>

          {/* Dark Theme Option */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelectTheme('dark')}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors group text-left rtl:text-right cursor-pointer',
              theme === 'dark'
                ? 'bg-indigo-500/10 text-indigo-900 dark:text-indigo-300 font-medium border border-indigo-500/30'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/90 hover:text-slate-900 dark:hover:text-white',
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                <Moon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{t('common.themeDark')}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {t('common.themeDarkDesc')}
                </div>
              </div>
            </div>
            {theme === 'dark' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
          </button>

          {/* System Default Option */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelectTheme('system')}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors group text-left rtl:text-right cursor-pointer',
              theme === 'system'
                ? 'bg-sky-500/10 text-sky-900 dark:text-sky-300 font-medium border border-sky-500/30'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/90 hover:text-slate-900 dark:hover:text-white',
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                <Monitor className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {t('common.themeSystem')}
                  </span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {t('common.themeSystemDesc')}
                </div>
              </div>
            </div>
            {theme === 'system' && <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />}
          </button>
        </div>
      )}
    </div>
  );
}
