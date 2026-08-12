import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useGetSettings, useUpdateSettings } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Save, Send, Loader2, CheckCircle, Calendar } from 'lucide-react';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const form = useForm({ defaultValues: settings || {} });

  useEffect(() => {
    if (settings) form.reset(settings);
  }, [settings, form]);

  const onSubmit = (data: any) => {
    updateSettings.mutate({ data }, {
      onSuccess: () => toast({ title: 'Settings Updated', description: 'Changes saved successfully.' }),
      onError: () => toast({ title: 'Error', description: 'Failed to update settings', variant: 'destructive' }),
    });
  };

  const handleSendNow = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/finance/send-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSendResult({ ok: true, msg: 'Report sent successfully!' });
      } else {
        setSendResult({ ok: false, msg: data.message || data.error || 'Send failed' });
      }
    } catch {
      setSendResult({ ok: false, msg: 'Network error — could not reach server' });
    } finally {
      setSending(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading settings...</div>;

  const inputClass = "rounded-none border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-base shadow-none transition-colors";
  const labelClass = "section-label";

  const triggerCls = "rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-secondary px-0 h-12 uppercase tracking-widest text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Workshop Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your site's content and business details.</p>
        </div>
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={updateSettings.isPending}
          className="rounded-none bg-secondary text-secondary-foreground btn-glow uppercase text-xs tracking-widest px-6 h-10 font-semibold gap-2"
        >
          <Save className="w-4 h-4" /> {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Form {...form}>
        <form className="space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="rounded-none w-full justify-start h-12 bg-transparent border-b border-border p-0 gap-8 overflow-x-auto">
              <TabsTrigger value="general" className={triggerCls}>General</TabsTrigger>
              <TabsTrigger value="hero"    className={triggerCls}>Hero Section</TabsTrigger>
              <TabsTrigger value="contact" className={triggerCls}>Contact Info</TabsTrigger>
              <TabsTrigger value="social"  className={triggerCls}>Social &amp; Links</TabsTrigger>
              <TabsTrigger value="reports" className={triggerCls}>Automated Reports</TabsTrigger>
            </TabsList>

            <div className="pt-8">
              {/* ── General ── */}
              <TabsContent value="general" className="m-0 space-y-6">
                <Card className="rounded-none border-border shadow-sm card-accent-l-indigo bg-card">
                  <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <FormField control={form.control} name="businessName" render={({ field }) => (
                        <FormItem><FormLabel className={labelClass}>Business Name</FormLabel><FormControl><Input className={inputClass} {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="tagline" render={({ field }) => (
                        <FormItem><FormLabel className={labelClass}>Tagline</FormLabel><FormControl><Input className={inputClass} {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="aboutStory" render={({ field }) => (
                      <FormItem><FormLabel className={labelClass}>About Story</FormLabel><FormControl><Textarea className={`${inputClass} min-h-[120px] resize-y py-2`} {...field} /></FormControl></FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
                      <FormField control={form.control} name="ordersCompletedCount" render={({ field }) => (
                        <FormItem><FormLabel className={labelClass}>Orders Completed</FormLabel><FormControl><Input type="number" className={inputClass} {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="happyClientsPercent" render={({ field }) => (
                        <FormItem><FormLabel className={labelClass}>Happy Clients %</FormLabel><FormControl><Input type="number" className={inputClass} {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="starRating" render={({ field }) => (
                        <FormItem><FormLabel className={labelClass}>Star Rating</FormLabel><FormControl><Input type="number" step="0.1" className={inputClass} {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Hero Section ── */}
              <TabsContent value="hero" className="m-0 space-y-6">
                <Card className="rounded-none border-border shadow-sm card-accent-l-amber bg-card">
                  <CardContent className="p-8 space-y-8">
                    <FormField control={form.control} name="heroTitle" render={({ field }) => (
                      <FormItem><FormLabel className={labelClass}>Hero Title</FormLabel><FormControl><Input className={`${inputClass} font-serif text-2xl py-2`} {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="heroSubtitle" render={({ field }) => (
                      <FormItem><FormLabel className={labelClass}>Hero Subtitle</FormLabel><FormControl><Textarea className={`${inputClass} resize-none py-2`} {...field} /></FormControl></FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                      <FormField control={form.control} name="heroCtaText" render={({ field }) => (
                        <FormItem><FormLabel className={labelClass}>Primary CTA Text</FormLabel><FormControl><Input className={inputClass} {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="heroCtaLink" render={({ field }) => (
                        <FormItem><FormLabel className={labelClass}>Primary CTA Link</FormLabel><FormControl><Input className={inputClass} {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="heroBgImage" render={({ field }) => (
                      <FormItem><FormLabel className={labelClass}>Background Image URL</FormLabel><FormControl><Input className={inputClass} {...field} /></FormControl></FormItem>
                    )} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Contact Info ── */}
              <TabsContent value="contact" className="m-0 space-y-6">
                <Card className="rounded-none border-border shadow-sm card-accent-l-blue bg-card">
                  <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel className={labelClass}>Email Address</FormLabel><FormControl><Input type="email" className={inputClass} {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel className={labelClass}>Phone Number</FormLabel><FormControl><Input className={inputClass} {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem><FormLabel className={labelClass}>Physical Address</FormLabel><FormControl><Textarea className={`${inputClass} resize-y py-2`} {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>WhatsApp Number</FormLabel>
                        <FormControl><Input className={inputClass} placeholder="e.g. +94771234567" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Social & Links ── */}
              <TabsContent value="social" className="m-0 space-y-6">
                <Card className="rounded-none border-border shadow-sm card-accent-l-green bg-card">
                  <CardContent className="p-8 space-y-8">
                    <FormField control={form.control} name="facebookUrl" render={({ field }) => (
                      <FormItem><FormLabel className={labelClass}>Facebook URL</FormLabel><FormControl><Input className={inputClass} {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="instagramUrl" render={({ field }) => (
                      <FormItem><FormLabel className={labelClass}>Instagram URL</FormLabel><FormControl><Input className={inputClass} {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="website" render={({ field }) => (
                      <FormItem><FormLabel className={labelClass}>Website / External Link</FormLabel><FormControl><Input className={inputClass} {...field} /></FormControl></FormItem>
                    )} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Automated Reports ── */}
              <TabsContent value="reports" className="m-0 space-y-6">
                {/* Gmail SMTP reminder */}
                <div className="flex items-start gap-3 bg-secondary/8 border border-secondary/20 p-4 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">Gmail SMTP required.</span>{' '}
                    Reports are sent via Gmail. Configure <span className="font-mono text-xs bg-muted px-1">Gmail User</span> and{' '}
                    <span className="font-mono text-xs bg-muted px-1">App Password</span> in your server environment variables
                    (<code className="text-xs">GMAIL_USER</code> / <code className="text-xs">GMAIL_APP_PASSWORD</code>)
                    or via the Email Notifications panel in admin settings.
                  </div>
                </div>

                {/* Monthly finance report card */}
                <Card className="rounded-none border-border shadow-sm card-accent-l-amber bg-card">
                  <CardContent className="p-8 space-y-6">
                    <div>
                      <p className="section-label mb-1">Monthly Finance Report</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically email a finance summary on the 1st of every month covering
                        income, expenses, net profit, current balance and inventory snapshot for the prior month.
                      </p>
                    </div>

                    {/* Enable toggle */}
                    <FormField
                      control={form.control}
                      name="financeReportEmailEnabled"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>Enable Monthly Report Email</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-4 pt-1">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={!!field.value}
                                onClick={() => field.onChange(field.value ? 0 : 1)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  field.value ? 'bg-secondary' : 'bg-muted'
                                }`}
                              >
                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                  field.value ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </button>
                              <span className="text-sm text-muted-foreground">
                                {field.value ? 'Enabled — will send on 1st of each month' : 'Disabled'}
                              </span>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Recipient */}
                    <FormField
                      control={form.control}
                      name="financeReportEmailRecipient"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>Recipient Email Address</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="owner@example.com"
                              className={inputClass}
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Schedule note */}
                    <div className="bg-muted/40 border border-border p-4 text-xs text-muted-foreground space-y-1">
                      <p className="font-semibold text-foreground">Schedule</p>
                      <p>Reports run automatically on the <strong>1st of each month</strong> between 1–6 AM server time.</p>
                      <p>The report covers the <strong>prior calendar month</strong> — e.g., a report sent on 1 September covers August.</p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Save first, then send */}
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-none border-secondary/40 text-secondary hover:bg-secondary/10 uppercase text-xs tracking-widest font-semibold gap-2"
                        onClick={async () => {
                          // Save settings first, then send
                          await new Promise<void>((resolve) => {
                            form.handleSubmit((data) => {
                              updateSettings.mutate({ data }, {
                                onSuccess: () => resolve(),
                                onError:   () => resolve(),
                              });
                            })();
                          });
                          await handleSendNow();
                        }}
                        disabled={sending || updateSettings.isPending}
                      >
                        {sending
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                          : <><Send className="w-4 h-4" />Send Report Now (Prior Month)</>
                        }
                      </Button>

                      {sendResult && (
                        <div className={`flex items-center gap-2 text-sm font-medium ${sendResult.ok ? 'text-green-600' : 'text-destructive'}`}>
                          <CheckCircle className="w-4 h-4" />
                          {sendResult.msg}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
