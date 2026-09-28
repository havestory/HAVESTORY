import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSubmitMessage, useGetSettings } from '@workspace/api-client-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Phone, Mail, Send, MessageCircle, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { Reveal } from '@/components/public/Reveal';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  phone: z.string().min(9, 'Valid phone is required'),
  email: z.string().email('Valid email is required').optional().or(z.literal('')),
  subject: z.string().min(2, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

const errStyle = { color: '#a63d2f', marginTop: 6 } as const;

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
    <div className="hv-page">
      {/* Hero */}
      <header className="hv-page-hero">
        <div className="hv-container">
          <span className="hv-kicker">Contact the studio</span>
          <h1 className="hv-display hv-display-lg">
            Bring us the photo.<br />
            <em>We&rsquo;ll help with the rest.</em>
          </h1>
          <p className="hv-lede">
            From one meaningful frame to a complete gallery wall, tell us what you are
            planning and we will reply with a clear next step.
          </p>
          <div className="mt-8">
            <Link href="/store" className="hv-text-link">
              Browse the shop <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="hv-hero-ornament" aria-hidden="true" />
      </header>

      {/* Info + form */}
      <section className="hv-section">
        <div className="hv-container">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.45fr] lg:gap-12">
            {/* Info card */}
            <Reveal>
              <aside className="hv-card h-full p-8 md:p-10">
                <span className="hv-kicker">Studio details</span>
                <h2 className="hv-display hv-display-sm mt-4">Let&rsquo;s make something worth keeping.</h2>

                <div className="mt-10 space-y-8">
                  <div>
                    <h3 className="hv-stat-label mb-4">Visit us</h3>
                    <div className="flex gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[rgba(176,124,58,0.12)] text-[#8a5f28]">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a89a8c]">Workshop</p>
                        <p className="mt-1 font-medium">{address}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="hv-stat-label mb-4">Reach out</h3>
                    <div className="space-y-5">
                      <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="flex gap-4 transition-transform hover:-translate-y-0.5">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[rgba(176,124,58,0.12)] text-[#8a5f28]">
                          <Phone className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a89a8c]">Call us</p>
                          <p className="mt-1 font-medium">{phone}</p>
                        </div>
                      </a>
                      <a href={`mailto:${email}`} className="flex gap-4 transition-transform hover:-translate-y-0.5">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[rgba(176,124,58,0.12)] text-[#8a5f28]">
                          <Mail className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a89a8c]">Email</p>
                          <p className="mt-1 font-medium">{email}</p>
                        </div>
                      </a>
                    </div>
                  </div>

                  {settings?.whatsappNumber && (
                    <a
                      href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-4 rounded-2xl border border-[rgba(176,124,58,0.35)] bg-[rgba(176,124,58,0.08)] px-5 py-4 font-semibold text-[#8a5f28] transition hover:-translate-y-0.5"
                    >
                      <span className="flex items-center gap-3">
                        <MessageCircle className="h-5 w-5" aria-hidden="true" />
                        Chat on WhatsApp
                      </span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </aside>
            </Reveal>

            {/* Form card */}
            <Reveal delay={0.12}>
              <section className="hv-card h-full p-8 md:p-10">
                <span className="hv-kicker">Start a conversation</span>
                <h2 className="hv-display hv-display-sm mt-4">Send an inquiry</h2>
                <p className="mt-2 text-[#6f6259]">Share a few details and we will get back to you.</p>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <FormField control={form.control} name="fullName" render={({ field }) => (
                        <FormItem className="hv-field">
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl><input placeholder="John Doe" className="hv-input" {...field} /></FormControl>
                          <FormMessage className="text-xs" style={errStyle} />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem className="hv-field">
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl><input type="tel" placeholder="+94 77 123 4567" className="hv-input" {...field} /></FormControl>
                          <FormMessage className="text-xs" style={errStyle} />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem className="hv-field">
                          <FormLabel>Email (optional)</FormLabel>
                          <FormControl><input type="email" placeholder="john@example.com" className="hv-input" {...field} /></FormControl>
                          <FormMessage className="text-xs" style={errStyle} />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="subject" render={({ field }) => (
                        <FormItem className="hv-field">
                          <FormLabel>Subject *</FormLabel>
                          <FormControl><input placeholder="Custom frame inquiry" className="hv-input" {...field} /></FormControl>
                          <FormMessage className="text-xs" style={errStyle} />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="message" render={({ field }) => (
                      <FormItem className="hv-field">
                        <FormLabel>Message Details *</FormLabel>
                        <FormControl>
                          <textarea
                            placeholder="Tell us about your project, dimensions, and any specific materials you have in mind…"
                            className="hv-textarea"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" style={errStyle} />
                      </FormItem>
                    )} />
                    <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-[#6f6259]">We usually reply within one business day.</p>
                      <button type="submit" className="hv-btn hv-btn-bronze w-full sm:w-auto" disabled={submitMessage.isPending}>
                        {submitMessage.isPending ? 'Sending…' : 'Send Message'}
                        {!submitMessage.isPending && <Send aria-hidden="true" />}
                      </button>
                    </div>
                  </form>
                </Form>
              </section>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
