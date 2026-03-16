import { AppBootstrapProvider } from '@/components/AppBootstrapProvider';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppBootstrapProvider>
      <DashboardShell>{children}</DashboardShell>
    </AppBootstrapProvider>
  );
}
