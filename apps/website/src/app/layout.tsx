import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | Convey',
    default: 'Convey — Planetary-Scale Communication Infrastructure & Messaging Gateway',
  },
  description:
    'High-throughput, fault-tolerant notification engine and message gateway. Sub-15ms send acceptance, zero-trust envelope encryption, 88+ turnkey provider integrations, transactional outbox, and autonomous WhatsApp session cost optimization.',
  keywords: [
    'convey',
    'notification engine',
    'transactional outbox',
    'elysia',
    'bun',
    'bullmq',
    'postgresql',
    'redis',
    'messaging gateway',
    'email',
    'sms',
    'whatsapp',
    'push notifications',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#070b12] text-slate-100 antialiased selection:bg-cyan-500/20 selection:text-cyan-300">
        <RootProvider theme={{ enabled: true, defaultTheme: 'dark' }}>{children}</RootProvider>
      </body>
    </html>
  );
}
