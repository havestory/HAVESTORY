import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSubmitMessage, useGetSettings } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';

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
      <div className="bg-primary text-primary-foreground py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl lg:text-6xl font-serif mb-6 leading-[1.1]">Let's discuss your next project.</h1>
            <p className="text-lg text-primary-foreground/80 font-light max-w-md">
              Whether it's a bespoke wedding invitation or a large-scale commercial banner run, our workshop is ready.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-8 lg:pl-12 lg:border-l border-primary-foreground/20">
            <div>
              <div className="flex items-center gap-3 mb-3 text-secondary">
                <MapPin className="w-5 h-5" />
                <h4 className="font-sans uppercase tracking-widest text-xs font-semibold">Workshop</h4>
              </div>
              <p className="text-sm leading-relaxed opacity-90">{settings?.address || '123 Printing Ave, Colombo, Sri Lanka'}</p>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-3 text-secondary">
                <Clock className="w-5 h-5" />
                <h4 className="font-sans uppercase tracking-widest text-xs font-semibold">Hours</h4>
              </div>
              <p className="text-sm leading-relaxed opacity-90">Mon - Fri: 9:00 AM - 6:00 PM<br/>Sat: 9:00 AM - 1:00 PM<br/>Sun: Closed</p>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-3 text-secondary">
                <Phone className="w-5 h-5" />
                <h4 className="font-sans uppercase tracking-widest text-xs font-semibold">Call Us</h4>
              </div>
              <p className="text-sm leading-relaxed opacity-90">{settings?.phone || '+94 11 234 5678'}</p>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-3 text-secondary">
                <Mail className="w-5 h-5" />
                <h4 className="font-sans uppercase tracking-widest text-xs font-semibold">Email</h4>
              </div>
              <p className="text-sm leading-relaxed opacity-90">{settings?.email || 'hello@havestory.com'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20 w-full flex-1">
        <div className="max-w-3xl mx-auto bg-card border border-border p-8 lg:p-12 shadow-sm">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-serif mb-3">Send an Inquiry</h2>
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
                      <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-semibold">Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" className="rounded-none border-b-2 focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-semibold">Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+94 77 123 4567" className="rounded-none border-b-2 focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0" {...field} />
                      </FormControl>
                      <FormMessage />
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
                      <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-semibold">Email (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" className="rounded-none border-b-2 focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-semibold">Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Business Cards Inquiry" className="rounded-none border-b-2 focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-[10px] tracking-widest text-muted-foreground font-semibold">Message Details</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell us about your project, quantity needed, and any specific materials you have in mind..." 
                        className="rounded-none border-b-2 focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 min-h-[120px] resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 flex justify-end">
                <Button type="submit" size="lg" className="rounded-none h-14 px-10 gap-3" disabled={submitMessage.isPending}>
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