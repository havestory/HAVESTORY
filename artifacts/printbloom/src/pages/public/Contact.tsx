import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSubmitMessage, useGetSettings } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Phone, Mail, Clock, Send, MessageCircle } from 'lucide-react';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  phone: z.string().min(9, 'Valid phone is required'),
  email: z.string().email('Valid email is required').optional().or(z.literal('')),
  subject: z.string().min(2, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export default function Contact() {
  const { data: settings } = useGetSettings();
  const { toast } = useToast();
  const submitMessage = useSubmitMessage();

  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      subject: '',
      message: '',
    },
  });

  function onSubmit(values: z.infer<typeof contactSchema>) {
    submitMessage.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: 'Message Sent', description: 'We have received your message and will reply shortly.' });
        form.reset();
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to send message. Please try again or call us directly.', variant: 'destructive' });
      }
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-24 lg:py-32 noise relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <span className="section-label text-secondary block mb-4">GET IN TOUCH</span>
          <h1 className="text-5xl lg:text-6xl font-serif font-bold text-white mb-6">Contact the Studio</h1>
          <p className="text-lg text-primary-foreground/70 font-light max-w-xl mx-auto">
            Whether it's a bespoke gallery wall or a single custom frame, our artisans are ready to help.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20 w-full flex-1 grid lg:grid-cols-5 gap-16">
        
        {/* Contact Info (Left) */}
        <div className="lg:col-span-2 space-y-10">
          <div>
            <h3 className="font-serif text-3xl font-bold mb-6">Visit Us</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/5 text-primary rounded-full flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-widest mb-1 text-muted-foreground">Workshop</h4>
                  <p className="text-sm font-medium">{settings?.address || '123 Printing Ave, Colombo, Sri Lanka'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/5 text-primary rounded-full flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-widest mb-1 text-muted-foreground">Hours</h4>
                  <p className="text-sm font-medium">Mon - Fri: 9:00 AM - 6:00 PM<br/>Sat: 9:00 AM - 1:00 PM</p>
                </div>
              </div>
            </div>
          </div>

          <div className="gold-rule" />

          <div>
            <h3 className="font-serif text-3xl font-bold mb-6">Reach Out</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/5 text-primary rounded-full flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-widest mb-1 text-muted-foreground">Call Us</h4>
                  <p className="text-sm font-medium">{settings?.phone || '+94 11 234 5678'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/5 text-primary rounded-full flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-widest mb-1 text-muted-foreground">Email</h4>
                  <p className="text-sm font-medium">{settings?.email || 'hello@havestory.com'}</p>
                </div>
              </div>
            </div>
          </div>

          {settings?.whatsappNumber && (
            <div className="pt-4">
              <a 
                href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-3 w-full bg-[#25D366] text-white py-4 rounded-[0.25rem] font-bold uppercase tracking-widest text-xs hover:bg-[#20bd5a] transition-colors shadow-sm"
              >
                <MessageCircle className="w-5 h-5" />
                Chat on WhatsApp
              </a>
            </div>
          )}
        </div>

        {/* Form (Right) */}
        <div className="lg:col-span-3 bg-card border border-border p-10 rounded-[0.25rem] shadow-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-serif font-bold mb-2">Send an Inquiry</h2>
            <p className="text-muted-foreground text-sm">Fill out the form below and our team will get back to you within 24 hours.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid sm:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-bold">Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" className="rounded-none border-b-2 border-t-0 border-x-0 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-foreground" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-bold">Phone Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="+94 77 123 4567" className="rounded-none border-b-2 border-t-0 border-x-0 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-foreground" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-bold">Email (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" className="rounded-none border-b-2 border-t-0 border-x-0 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-foreground" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-bold">Subject *</FormLabel>
                      <FormControl>
                        <Input placeholder="Custom Frame Inquiry" className="rounded-none border-b-2 border-t-0 border-x-0 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-foreground" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-bold">Message Details *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell us about your project, dimensions, and any specific materials you have in mind..." 
                        className="rounded-none border-b-2 border-t-0 border-x-0 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 min-h-[120px] resize-y text-foreground" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button type="submit" size="lg" className="w-full sm:w-auto rounded-[0.25rem] h-12 px-10 gap-3 btn-glow bg-secondary text-secondary-foreground uppercase tracking-widest font-bold text-xs border-none shadow-sm" disabled={submitMessage.isPending}>
                  {submitMessage.isPending ? 'Sending...' : 'Send Message'}
                  {!submitMessage.isPending && <Send className="w-4 h-4" />}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
