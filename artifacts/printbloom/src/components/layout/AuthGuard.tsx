import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetAdminMe } from '@workspace/api-client-react';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useGetAdminMe();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (isError || !data?.authenticated) {
        setLocation('/admin/login');
      }
    }
  }, [isLoading, isError, data, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isError || !data?.authenticated) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}