import { useGetSettings } from "@workspace/api-client-react";
import { FileText } from "lucide-react";
import { getBusinessEmail, getBusinessName, getBusinessWhatsapp } from "@/lib/brand-settings";

function buildDefaultTerms(settings: any): string {
  const businessName = getBusinessName(settings) || "the business";
  const email = getBusinessEmail(settings);
  const whatsapp = getBusinessWhatsapp(settings);
  return `TERMS OF SERVICE

Last updated: January 2025

ACCEPTANCE OF TERMS
By placing an order with ${businessName}, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.

ORDER PLACEMENT
Orders are confirmed once payment is received and verified. We reserve the right to cancel or refuse any order at our discretion.

PRICING & PAYMENT
• All prices are quoted in Sri Lankan Rupees (LKR)
• Prices may change without prior notice
• Full or partial payment may be required before production begins
• Accepted payment methods will be communicated at the time of order

PRODUCTION & TURNAROUND
Turnaround times begin after your design files are approved and payment is confirmed. ${businessName} is not liable for delays caused by circumstances beyond our control.

DESIGN FILES
You are responsible for providing print-ready design files. ${businessName} will not be held responsible for errors in files approved by the customer.

CANCELLATIONS & REFUNDS
• Orders can be cancelled before production begins for a full refund
• Once production has started, cancellations are not accepted
• Defective products will be replaced or refunded at our discretion

INTELLECTUAL PROPERTY
By submitting design files, you confirm you own or have permission to use the content. ${businessName} is not responsible for copyright infringement by the customer.

LIMITATION OF LIABILITY
${businessName}'s liability is limited to the value of the order placed.

CONTACT
For questions about these Terms of Service, please contact:
Email: ${email || "Use the website contact form"}
WhatsApp: ${whatsapp || "Use the website WhatsApp button"}`;
}

export default function Terms() {
  const { data: settings } = useGetSettings();
  const content = (settings as any)?.termsOfService || buildDefaultTerms(settings as any);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 mb-4">
          <FileText size={26} className="text-pink-600" />
        </div>
        <h1 className="text-3xl font-display font-extrabold text-gray-900">Terms of Service</h1>
        <p className="text-gray-500 mt-2 text-sm">Please read our terms and conditions before placing an order</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="prose prose-gray max-w-none">
          {content.split("\n").map((line: string, i: number) => {
            if (!line.trim()) return <div key={i} className="h-3" />;
            if (line === line.toUpperCase() && line.trim().length > 2 && !line.startsWith("•")) {
              return <h2 key={i} className="text-base font-bold text-gray-900 mt-6 mb-2 first:mt-0">{line}</h2>;
            }
            if (line.startsWith("•")) {
              return <p key={i} className="text-sm text-gray-600 leading-relaxed pl-4">{line}</p>;
            }
            return <p key={i} className="text-sm text-gray-600 leading-relaxed">{line}</p>;
          })}
        </div>
      </div>
    </main>
  );
}
