import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SignalDesk AI - Reddit Lead Discovery & Intent Detection',
  description: 'Find high-intent customers on Reddit using AI-powered intent detection and conversation intelligence.',
  keywords: ['lead generation', 'reddit marketing', 'intent detection', 'sales intelligence', 'AI leads'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
