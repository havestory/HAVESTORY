import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetAdminMe } from '@workspace/api-client-react';
import { StudioLoader } from '@/components/StudioLoader';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { data, isLoading, isError, error, refetch } = useGetAdminMe({ query: { staleTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false } as any });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && ((isError && (error as any)?.status === 401) || (!isError && !data?.authenticated))) {
      setLocation('/admin/login');
    }
  }, [isLoading, isError, error, data, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <StudioLoader label="Loading HAVESTORY admin" />
      </div>
    );
  }

  if (isError && (error as any)?.status !== 401) {
    return <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <section role="alert" className="w-full max-w-md rounded-xl border border-border bg-card p-7 text-center">
        <h1 className="font-serif text-3xl">The workspace could not connect</h1>
        <p className="mt-3 text-sm text-muted-foreground">Your session could not be checked. Please retry; if this continues, check the API and database deployment.</p>
        <button type="button" onClick={() => void refetch()} className="mt-5 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Retry connection</button>
      </section>
    </main>;
  }

  if (isError || !data?.authenticated) {
    return null;
  }

  return <>{children}</>;
}
