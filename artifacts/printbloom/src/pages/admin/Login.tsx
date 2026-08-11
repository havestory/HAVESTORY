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
import { ArrowLeft } from 'lucide-react';

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
            setStep('pin');
          } else {
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
    <div className="min-h-screen flex bg-background animate-in fade-in">
      {/* Left Branding Side */}
      <div className="hidden lg:flex flex-col flex-1 bg-primary relative overflow-hidden noise justify-center items-center p-12 text-primary-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-secondary/20 via-transparent to-transparent opacity-60" />
        
        <div className="relative z-10 max-w-lg w-full flex flex-col items-center text-center">
          <h1 className="text-6xl font-serif font-bold tracking-tight mb-4 text-white">HAVESTORY</h1>
          <p className="text-xl font-serif text-primary-foreground/80 mb-12 italic">Crafting tangible memories.</p>

          <div className="relative w-64 h-80 mb-12">
            <div className="absolute inset-0 bg-white/10 border border-white/20 transform rotate-[-6deg] animate-float transition-transform"></div>
            <div className="absolute inset-0 bg-secondary/20 border border-secondary/40 transform rotate-[3deg] animate-float-delay transition-transform"></div>
            <div className="absolute inset-0 bg-black/40 border border-white/10 backdrop-blur-sm flex items-center justify-center animate-float-delay-2 p-6 text-center">
              <span className="font-serif text-2xl text-white/90 leading-relaxed italic">
                "Where design meets execution."
              </span>
            </div>
          </div>

          <p className="text-sm tracking-widest uppercase text-primary-foreground/50 font-semibold section-label mt-auto">
            Managing your story gallery since 2019
          </p>
        </div>
      </div>

      {/* Right Form Side */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 relative">
        <div className="w-full max-w-sm space-y-8 animate-fade-up">
          <div className="space-y-2">
            <h2 className="text-3xl font-serif font-semibold text-foreground">Welcome Back</h2>
            <p className="text-sm text-muted-foreground">
              {step === 'credentials' ? 'Sign in to access your workshop dashboard.' : 'Verify your identity to continue.'}
            </p>
          </div>

          {step === 'pin' && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => { setStep('credentials'); pinForm.reset(); }}
                className="flex items-center gap-1 hover:text-foreground transition-colors uppercase tracking-widest font-semibold"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              <span className="ml-auto section-label">Step 2 — Security PIN</span>
            </div>
          )}

          {step === 'credentials' && (
            <Form {...credForm}>
              <form onSubmit={credForm.handleSubmit(onCredSubmit)} className="space-y-8">
                <FormField
                  control={credForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="section-label">Username</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="username"
                          className="rounded-none border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-base"
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
                      <FormLabel className="section-label">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          className="rounded-none border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-base"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full rounded-none h-12 text-xs tracking-widest uppercase font-semibold bg-primary text-primary-foreground btn-glow"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Authenticating...' : 'Sign In →'}
                </Button>
              </form>
            </Form>
          )}

          {step === 'pin' && (
            <Form {...pinForm}>
              <form onSubmit={pinForm.handleSubmit(onPinSubmit)} className="space-y-8">
                <FormField
                  control={pinForm.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="section-label">Security PIN</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={10}
                          className="rounded-none border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-center text-2xl tracking-[0.5em] font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full rounded-none h-12 text-xs tracking-widest uppercase font-semibold bg-primary text-primary-foreground btn-glow"
                  disabled={pinLoading}
                >
                  {pinLoading ? 'Verifying...' : 'Unlock Dashboard'}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}