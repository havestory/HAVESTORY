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

  if (isLoading) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Workshop Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your site's content and business details.</p>
        </div>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={updateSettings.isPending} className="rounded-none bg-primary gap-2 px-6">
          <Save className="w-4 h-4" /> {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Form {...form}>
        <form className="space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="rounded-none w-full justify-start h-12 bg-transparent border-b border-border p-0 gap-6">
              <TabsTrigger value="general" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 h-12">General</TabsTrigger>
              <TabsTrigger value="hero" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 h-12">Hero Section</TabsTrigger>
              <TabsTrigger value="contact" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 h-12">Contact Info</TabsTrigger>
              <TabsTrigger value="social" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 h-12">Social & Links</TabsTrigger>
            </TabsList>
            
            <div className="pt-6">
              <TabsContent value="general" className="m-0">
                <Card className="rounded-none border-border shadow-sm">
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <FormField control={form.control} name="businessName" render={({ field }) => (
                        <FormItem><FormLabel>Business Name</FormLabel><FormControl><Input className="rounded-none" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="tagline" render={({ field }) => (
                        <FormItem><FormLabel>Tagline</FormLabel><FormControl><Input className="rounded-none" {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="aboutStory" render={({ field }) => (
                      <FormItem><FormLabel>About Story</FormLabel><FormControl><Textarea className="rounded-none min-h-[100px]" {...field} /></FormControl></FormItem>
                    )} />
                    <div className="grid grid-cols-3 gap-6">
                      <FormField control={form.control} name="ordersCompletedCount" render={({ field }) => (
                        <FormItem><FormLabel>Orders Completed (Stat)</FormLabel><FormControl><Input type="number" className="rounded-none" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="happyClientsPercent" render={({ field }) => (
                        <FormItem><FormLabel>Happy Clients % (Stat)</FormLabel><FormControl><Input type="number" className="rounded-none" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="starRating" render={({ field }) => (
                        <FormItem><FormLabel>Star Rating (Stat)</FormLabel><FormControl><Input type="number" step="0.1" className="rounded-none" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hero" className="m-0">
                <Card className="rounded-none border-border shadow-sm">
                  <CardContent className="p-6 space-y-6">
                    <FormField control={form.control} name="heroTitle" render={({ field }) => (
                      <FormItem><FormLabel>Hero Title</FormLabel><FormControl><Input className="rounded-none text-lg font-serif" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="heroSubtitle" render={({ field }) => (
                      <FormItem><FormLabel>Hero Subtitle</FormLabel><FormControl><Textarea className="rounded-none" {...field} /></FormControl></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-6">
                      <FormField control={form.control} name="heroCtaText" render={({ field }) => (
                        <FormItem><FormLabel>Primary CTA Text</FormLabel><FormControl><Input className="rounded-none" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="heroCtaLink" render={({ field }) => (
                        <FormItem><FormLabel>Primary CTA Link</FormLabel><FormControl><Input className="rounded-none" {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="heroBgImage" render={({ field }) => (
                      <FormItem><FormLabel>Background Image URL</FormLabel><FormControl><Input className="rounded-none" {...field} /></FormControl></FormItem>
                    )} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contact" className="m-0">
                <Card className="rounded-none border-border shadow-sm">
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" className="rounded-none" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input className="rounded-none" {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem><FormLabel>Physical Address</FormLabel><FormControl><Textarea className="rounded-none" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Number (Floating Button)</FormLabel>
                        <FormControl><Input className="rounded-none" placeholder="e.g. +94771234567" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="social" className="m-0">
                <Card className="rounded-none border-border shadow-sm">
                  <CardContent className="p-6 space-y-6">
                    <FormField control={form.control} name="facebookUrl" render={({ field }) => (
                      <FormItem><FormLabel>Facebook URL</FormLabel><FormControl><Input className="rounded-none" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="instagramUrl" render={({ field }) => (
                      <FormItem><FormLabel>Instagram URL</FormLabel><FormControl><Input className="rounded-none" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="website" render={({ field }) => (
                      <FormItem><FormLabel>Website / External Link</FormLabel><FormControl><Input className="rounded-none" {...field} /></FormControl></FormItem>
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