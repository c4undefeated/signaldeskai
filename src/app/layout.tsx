import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SignalDesk AI — Find High-Intent Leads on Reddit',
  description:
    'AI-powered Reddit lead discovery and conversation intelligence. Find people actively looking for what you sell — scored by buyer intent.',
  keywords: ['lead generation', 'reddit marketing', 'intent detection', 'sales intelligence'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
