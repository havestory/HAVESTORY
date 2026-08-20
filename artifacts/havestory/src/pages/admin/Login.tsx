import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'wouter';
import { useAdminLogin, useGetSettings } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';

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
  const { data: settings } = useGetSettings();
  const businessName = settings?.businessName || 'HAVESTORY';
  const brandMark = businessName.slice(0, 2).toUpperCase();

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
    <div className="hs-login-page animate-in fade-in">
      <aside className="hs-login-story" aria-label={`${businessName} studio introduction`}>
        <div className="hs-login-orb hs-login-orb-one" />
        <div className="hs-login-orb hs-login-orb-two" />
        <div className="hs-login-story-inner">
          <button type="button" className="hs-login-brand" onClick={() => setLocation('/')} aria-label="Return to website">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="" />
            ) : (
              <span>{brandMark}</span>
            )}
            <strong>{businessName}</strong>
          </button>

          <div className="hs-login-story-copy">
            <span><Sparkles /> Studio control centre</span>
            <h1>Every detail,<br />beautifully organised.</h1>
            <p>{settings?.tagline || 'Manage orders, clients, frames and studio stories from one focused workspace.'}</p>
          </div>

          <div className="hs-login-preview" aria-hidden="true">
            <div><small>01</small><strong>Orders</strong><span>Follow every project</span></div>
            <div><small>02</small><strong>Studio</strong><span>Keep production clear</span></div>
            <div><small>03</small><strong>Gallery</strong><span>Publish finished work</span></div>
          </div>
        </div>
      </aside>

      <main className="hs-login-main">
        <button type="button" className="hs-login-mobile-brand" onClick={() => setLocation('/')}>
          <span>{brandMark}</span>
          <strong>{businessName}</strong>
        </button>

        <div className="hs-login-card animate-fade-up">
          <div className="hs-login-security"><ShieldCheck /> Secure admin access</div>
          <div className="hs-login-heading">
            <h2>{step === 'credentials' ? 'Welcome back.' : 'One more step.'}</h2>
            <p>
              {step === 'credentials' ? `Sign in to open your ${businessName} workspace.` : 'Enter your security PIN to complete sign in.'}
            </p>
          </div>

          <div className="hs-login-progress" aria-label={`Sign-in step ${step === 'credentials' ? '1' : '2'} of 2`}>
            <span className="is-active">1</span><i /><span className={step === 'pin' ? 'is-active' : ''}>2</span>
          </div>

          {step === 'pin' && (
            <div className="hs-login-step-back">
              <button
                type="button"
                onClick={() => { setStep('credentials'); pinForm.reset(); }}
              >
                <ArrowLeft /> Back to credentials
              </button>
              <span>Step 2 of 2</span>
            </div>
          )}

          {step === 'credentials' && (
            <Form {...credForm}>
              <form onSubmit={credForm.handleSubmit(onCredSubmit)} className="hs-login-form">
                <FormField
                  control={credForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="username"
                          className="hs-login-input"
                          placeholder="Enter your username"
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          className="hs-login-input"
                          placeholder="Enter your password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="hs-login-submit"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Authenticating...' : <><LockKeyhole /> Sign in securely <ArrowRight /></>}
                </Button>
              </form>
            </Form>
          )}

          {step === 'pin' && (
            <Form {...pinForm}>
              <form onSubmit={pinForm.handleSubmit(onPinSubmit)} className="hs-login-form">
                <FormField
                  control={pinForm.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Security PIN</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={10}
                          className="hs-login-input hs-login-pin"
                          placeholder="••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="hs-login-submit"
                  disabled={pinLoading}
                >
                  {pinLoading ? 'Verifying...' : <><ShieldCheck /> Unlock dashboard <ArrowRight /></>}
                </Button>
              </form>
            </Form>
          )}
          <button type="button" className="hs-login-return" onClick={() => setLocation('/')}>
            <ArrowLeft /> Return to website
          </button>
        </div>
      </main>
    </div>
  );
}
