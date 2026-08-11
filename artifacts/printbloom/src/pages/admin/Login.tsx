import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'wouter';
import { useAdminLogin } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Printer } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useAdminLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: (res) => {
        if (res.success) {
          toast({ title: 'Success', description: 'Logged in successfully' });
          setLocation('/admin');
        } else {
          toast({ title: 'Error', description: res.message || 'Login failed', variant: 'destructive' });
        }
      },
      onError: () => {
        toast({ title: 'Error', description: 'Invalid credentials', variant: 'destructive' });
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      {/* Decorative background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-secondary/10 via-background to-background pointer-events-none" />
      
      <div className="w-full max-w-md bg-card border border-border shadow-xl p-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center mb-4">
            <Printer className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-serif text-center font-semibold text-primary mb-1">HAVESTORY Admin</h1>
          <p className="text-sm text-muted-foreground text-center">Sign in to manage your workshop.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-semibold">Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter username" className="rounded-none border-b-2 focus-visible:ring-0 focus-visible:border-secondary transition-colors" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-semibold">Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter password" className="rounded-none border-b-2 focus-visible:ring-0 focus-visible:border-secondary transition-colors" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full rounded-none h-12 text-sm tracking-wide" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}