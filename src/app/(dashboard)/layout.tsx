import { Sidebar } from '@/components/layout/Sidebar';
import { AppBootstrapProvider } from '@/components/AppBootstrapProvider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppBootstrapProvider>
      <div className="flex h-screen bg-zinc-950 overflow-hidden">
        <Sidebar />
        <main className="flex-1 ml-60 overflow-y-auto">
          {children}
        </main>
      </div>
    </AppBootstrapProvider>
  );
}
