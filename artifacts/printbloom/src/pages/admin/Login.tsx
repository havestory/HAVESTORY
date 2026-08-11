import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'wouter';
import { useAdminLogin } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Printer, ArrowLeft } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const pinSchema = z.object({
  pin: z.string().min(1, 'PIN is required'),
});

// Resolve API base — works in both dev (Vite proxy) and production (Vercel)
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useAdminLogin();

  // step: 'credentials' | 'pin'
  const [step, setStep] = useState<'credentials' | 'pin'>('credentials');
  const [pinLoading, setPinLoading] = useState(false);

  const credForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  });

  // Step 1 — username + password
  function onCredSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: (res) => {
        if (res.success) {
          if (res.requiresPin) {
            // Move to PIN step
            setStep('pin');
          } else {
            // No PIN required (staff login without PIN)
            toast({ title: 'Welcome back!', description: 'Logged in successfully.' });
            setLocation('/admin');
          }
        } else {
          toast({ title: 'Login failed', description: (res as any).message || 'Invalid credentials.', variant: 'destructive' });
        }
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || err?.message || 'Invalid credentials.';
        toast({ title: 'Login failed', description: msg, variant: 'destructive' });
      },
    });
  }

  // Step 2 — PIN verification
  async function onPinSubmit(values: z.infer<typeof pinSchema>) {
    setPinLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/verify-pin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: values.pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: 'Welcome back!', description: 'Logged in successfully.' });
        setLocation('/admin');
      } else {
        const errMsg = data?.error || data?.message || 'Incorrect PIN.';
        toast({ title: 'Incorrect PIN', description: errMsg, variant: 'destructive' });
        pinForm.setError('pin', { message: errMsg });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setPinLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-secondary/10 via-background to-background pointer-events-none" />

      <div className="w-full max-w-md bg-card border border-border shadow-xl p-8 relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center mb-4">
            <Printer className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-serif text-center font-semibold text-primary mb-1">HAVESTORY Admin</h1>
          <p className="text-sm text-muted-foreground text-center">
            {step === 'credentials' ? 'Sign in to manage your workshop.' : 'Enter your security PIN to continue.'}
          </p>
        </div>

        {/* Step indicator */}
        {step === 'pin' && (
          <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => { setStep('credentials'); pinForm.reset(); }}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <span className="ml-auto">Step 2 of 2 — PIN verification</span>
          </div>
        )}

        {/* STEP 1 — Credentials */}
        {step === 'credentials' && (
          <Form {...credForm}>
            <form onSubmit={credForm.handleSubmit(onCredSubmit)} className="space-y-6">
              <FormField
                control={credForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-semibold">Username</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="username"
                        placeholder="Enter username"
                        className="rounded-none border-b-2 border-x-0 border-t-0 focus-visible:ring-0 focus-visible:border-secondary transition-colors px-0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={credForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-semibold">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Enter password"
                        className="rounded-none border-b-2 border-x-0 border-t-0 focus-visible:ring-0 focus-visible:border-secondary transition-colors px-0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full rounded-none h-12 text-sm tracking-wide bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? 'Checking...' : 'Continue →'}
              </Button>
            </form>
          </Form>
        )}

        {/* STEP 2 — PIN */}
        {step === 'pin' && (
          <Form {...pinForm}>
            <form onSubmit={pinForm.handleSubmit(onPinSubmit)} className="space-y-6">
              <FormField
                control={pinForm.control}
                name="pin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-semibold">Security PIN</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Enter PIN"
                        maxLength={10}
                        className="rounded-none border-b-2 border-x-0 border-t-0 focus-visible:ring-0 focus-visible:border-secondary transition-colors px-0 text-center text-xl tracking-[0.5em]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full rounded-none h-12 text-sm tracking-wide bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold"
                disabled={pinLoading}
              >
                {pinLoading ? 'Verifying...' : 'Sign In'}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
