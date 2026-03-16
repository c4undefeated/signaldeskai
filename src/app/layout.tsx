import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from '@/components/layout/PwaRegister';

export const metadata: Metadata = {
  title: 'SignalDesk AI — Find High-Intent Leads on Reddit',
  description:
    'AI-powered Reddit lead discovery and conversation intelligence. Find people actively looking for what you sell — scored by buyer intent.',
  keywords: ['lead generation', 'reddit marketing', 'intent detection', 'sales intelligence'],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SignalDesk',
  },
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-dvh">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
