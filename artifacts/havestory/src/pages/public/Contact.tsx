import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSubmitMessage, useGetSettings } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Phone, Mail, Clock, Send, MessageCircle, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  phone: z.string().min(9, 'Valid phone is required'),
  email: z.string().email('Valid email is required').optional().or(z.literal('')),
  subject: z.string().min(2, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

const inputClass = 'h-12 rounded-2xl border border-border bg-white px-4 text-sm font-medium text-foreground shadow-none transition focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10';
const labelClass = 'text-[10px] font-black uppercase tracking-[.14em] text-muted-foreground';

export default function Contact() {
  const { data: settings } = useGetSettings();
  const { toast } = useToast();
  const submitMessage = useSubmitMessage();

  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { fullName: '', phone: '', email: '', subject: '', message: '' },
  });

  function onSubmit(values: z.infer<typeof contactSchema>) {
    submitMessage.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: 'Message sent', description: 'We have received your message and will reply shortly.' });
        form.reset();
      },
      onError: () => toast({ title: 'Could not send message', description: 'Please try again or call the studio directly.', variant: 'destructive' }),
    });
  }

  const address = settings?.address || '123 Printing Ave, Colombo, Sri Lanka';
  const phone = settings?.phone || '+94 11 234 5678';
  const email = settings?.email || 'hello@havestory.com';

  return (
    <div className="hsx-page hsx-contact-page">
      <header className="hsx-page-hero hsx-contact-hero">
        <div>
          <span>Contact the studio</span>
          <h1>Bring us the photo.<br />We’ll help with the rest.</h1>
        </div>
        <div>
          <p>From one meaningful frame to a complete gallery wall, tell us what you are planning and we will reply with a clear next step.</p>
          <Link href="/store" className="hsx-text-link">Browse the shop <ArrowRight /></Link>
        </div>
      </header>

      <div className="hsx-contact-layout hsx-contact-compact">
        <aside className="hsx-contact-info hsx-contact-info-clean">
          <div className="hsx-contact-aside-intro">
            <span>Studio details</span>
            <h2>Let’s make something worth keeping.</h2>
          </div>

          <section className="hsx-contact-block">
            <h3>Visit Us</h3>
            <div className="hsx-contact-detail-row">
              <MapPin aria-hidden="true" />
              <div><span>Workshop</span><p>{address}</p></div>
            </div>
            <div className="hsx-contact-detail-row">
              <Clock aria-hidden="true" />
              <div><span>Hours</span><p>Mon – Fri · 9:00 AM – 6:00 PM<br />Sat · 9:00 AM – 1:00 PM</p></div>
            </div>
          </section>

          <section className="hsx-contact-block hsx-contact-reach">
            <h3>Reach Out</h3>
            <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="hsx-contact-detail-row">
              <Phone aria-hidden="true" />
              <div><span>Call Us</span><p>{phone}</p></div>
            </a>
            <a href={`mailto:${email}`} className="hsx-contact-detail-row">
              <Mail aria-hidden="true" />
              <div><span>Email</span><p>{email}</p></div>
            </a>
          </section>

          {settings?.whatsappNumber && (
            <a href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="hsx-contact-whatsapp">
              <MessageCircle aria-hidden="true" />
              <span>Chat on WhatsApp</span>
              <ArrowRight aria-hidden="true" />
            </a>
          )}
        </aside>

        <section className="hsx-contact-form hsx-contact-form-clean">
          <div className="hsx-contact-form-heading">
            <span>Start a conversation</span>
            <h2>Send an Inquiry</h2>
            <p>Share a few details about your project and our team will get back to you within 24 hours.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="hsx-contact-form-fields">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem><FormLabel className={labelClass}>Full Name *</FormLabel><FormControl><Input placeholder="John Doe" className={inputClass} {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel className={labelClass}>Phone Number *</FormLabel><FormControl><Input type="tel" placeholder="+94 77 123 4567" className={inputClass} {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                )} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel className={labelClass}>Email <span className="normal-case tracking-normal">(optional)</span></FormLabel><FormControl><Input type="email" placeholder="john@example.com" className={inputClass} {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                )} />
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem><FormLabel className={labelClass}>Subject *</FormLabel><FormControl><Input placeholder="Custom frame inquiry" className={inputClass} {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="message" render={({ field }) => (
                <FormItem><FormLabel className={labelClass}>Message Details *</FormLabel><FormControl><Textarea placeholder="Tell us about your project, dimensions, and any specific materials you have in mind…" className="min-h-[132px] resize-y rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-foreground shadow-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
              )} />
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">We usually reply within one business day.</p>
                <Button type="submit" size="lg" className="h-12 w-full gap-3 rounded-2xl bg-secondary px-7 text-xs font-black uppercase tracking-[.12em] text-secondary-foreground shadow-sm transition hover:-translate-y-0.5 sm:w-auto" disabled={submitMessage.isPending}>
                  {submitMessage.isPending ? 'Sending…' : 'Send Message'}
                  {!submitMessage.isPending && <Send aria-hidden="true" className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </Form>
        </section>
      </div>
    </div>
  );
}
