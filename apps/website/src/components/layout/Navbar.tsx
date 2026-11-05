'use client';

import { Activity, ArrowUpRight, BookOpen, Cpu, Menu, Radio, Sliders, Terminal, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: '/docs', label: 'Documentation', icon: BookOpen, isPrimary: true },
    { href: '#architecture', label: 'Architecture', icon: Cpu },
    { href: '#playground', label: 'Playground', icon: Terminal },
    { href: '#recipes', label: 'Recipes', icon: Zap },
    { href: '#providers', label: 'Providers', icon: Radio },
    { href: '#benchmarks', label: 'Benchmarks', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#070b12]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-2.5 group cursor-pointer shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 p-0.5 shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#070b12] rounded-[10px] flex items-center justify-center">
              <Zap className="w-4 h-4 text-sky-400 fill-sky-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              CONVEY
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                pre-release
              </span>
            </span>
          </div>
        </Link>

        {/* Center Nav Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-300">
          {navLinks.map((link) => {
            const Icon = link.icon;
            if (link.href.startsWith('/')) {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 transition-colors ${
                    link.isPrimary ? 'text-white font-semibold hover:text-sky-400' : 'hover:text-sky-400'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${link.isPrimary ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            }
            return (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 hover:text-sky-400 transition-colors"
              >
                <Icon className="w-3.5 h-3.5 text-slate-400" />
                <span>{link.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/docs/quickstart#start-the-operator-console"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Console Setup</span>
            <ArrowUpRight className="w-3 h-3 text-slate-500" />
          </Link>

          <a
            href="https://github.com/hamidrezakks/convey"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
            className="hidden xs:inline-flex p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="GitHub Repository"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span className="sr-only">GitHub</span>
          </a>

          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-lg shadow-sky-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <span>Get Started</span>
          </Link>

          {/* Mobile Hamburger Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            className="lg:hidden p-2 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-sky-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu Overlay */}
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="lg:hidden absolute inset-x-0 top-full max-h-[calc(100dvh-4rem-1px)] z-50 bg-[#070b12] border-b border-slate-800 p-4 overflow-y-auto overscroll-contain space-y-4 shadow-xl"
        >
          {/* Main Navigation Links */}
          <div className="grid grid-cols-2 gap-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 px-3 pb-1 col-span-2">
              Navigation
            </div>
            {navLinks.map((link) => {
              const Icon = link.icon;
              if (link.href.startsWith('/')) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-white font-medium text-sm transition-colors"
                  >
                    <Icon className="w-4 h-4 text-sky-400" />
                    <span>{link.label}</span>
                  </Link>
                );
              }
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900/80 transition-colors text-sm font-medium"
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span>{link.label}</span>
                </a>
              );
            })}
          </div>

          {/* Quick External Tools */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 px-3 pb-1">
              Setup & Resources
            </div>
            <Link
              href="/docs/quickstart#start-the-operator-console"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 hover:border-slate-700 text-sm font-medium"
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Operator Console Setup</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            <Link
              href="/docs/api-reference"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 hover:border-slate-700 text-sm font-medium"
            >
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>API Reference</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            <a
              href="https://github.com/hamidrezakks/convey"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 hover:border-slate-700 text-sm font-medium"
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 fill-current text-slate-300" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>GitHub Repository</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>

          {/* Bottom Quick CTA */}
          <div className="pt-2">
            <Link
              href="/docs/quickstart"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-sky-500/20"
            >
              <span>Open the Setup Guide</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
