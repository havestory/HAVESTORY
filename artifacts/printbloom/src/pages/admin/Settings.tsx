import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useGetSettings, useUpdateSettings } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();

  const form = useForm({
    defaultValues: settings || {}
  });

  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);

  const onSubmit = (data: any) => {
    updateSettings.mutate({ data }, {
      onSuccess: () => {
        toast({ title: 'Settings Updated', description: 'Changes saved successfully.' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to update settings', variant: 'destructive' });
      }
    });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading settings...</div>;

  const inputClass = "rounded-none border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-base shadow-none transition-colors";
  const labelClass = "section-label";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Workshop Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your site's content and business details.</p>
        </div>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={updateSettings.isPending} className="rounded-none bg-primary text-primary-foreground btn-glow uppercase text-xs tracking-widest px-6 h-10 font-semibold gap-2">
          <Save className="w-4 h-4" /> {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Form {...form}>
        <form className="space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="rounded-none w-full justify-start h-12 bg-transparent border-b border-border p-0 gap-8">
              <TabsTrigger value="general" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 h-12 uppercase tracking-widest text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground">General</TabsTrigger>
              <TabsTrigger value="hero" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 h-12 uppercase tracking-widest text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground">Hero Section</TabsTrigger>
              <TabsTrigger value="contact" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 h-12 uppercase tracking-widest text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground">Contact Info</TabsTrigger>
              <TabsTrigger value="social" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 h-12 uppercase tracking-widest text-xs font-semibold text-muted-foreground data-[state=active]:text-foreground">Social & Links</TabsTrigger>
            </TabsList>
            
            <div className="pt-8">
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
            </div>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}