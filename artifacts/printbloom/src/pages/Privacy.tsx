import { useGetSettings } from "@workspace/api-client-react";
import { Shield } from "lucide-react";
import { getBusinessEmail, getBusinessName, getBusinessWhatsapp } from "@/lib/brand-settings";

function buildDefaultPolicy(settings: any): string {
  const businessName = getBusinessName(settings) || "the business";
  const email = getBusinessEmail(settings);
  const whatsapp = getBusinessWhatsapp(settings);
  return `PRIVACY POLICY

Last updated: January 2025

INFORMATION WE COLLECT
We collect information you provide when placing orders, including your name, phone number, email address, and delivery address. We also collect files and design assets you upload for your print jobs.

HOW WE USE YOUR INFORMATION
We use your information to:
• Process and fulfil your print orders
• Send order confirmations and tracking updates via WhatsApp or email
• Respond to your enquiries and provide customer support
• Improve our products and services

DATA STORAGE
Your order data and uploaded files are stored securely on our servers. We do not sell or share your personal information with third parties for marketing purposes.

PAYMENT INFORMATION
We do not store credit card or bank details. Payment proofs you upload are used solely to verify your payment and are kept confidential.

YOUR RIGHTS
You may request to view, update, or delete your personal data at any time by contacting us directly.

CONTACT US
If you have any questions about this Privacy Policy, please contact us at:
Email: ${email || "Use the website contact form"}
WhatsApp: ${whatsapp || "Use the website WhatsApp button"}`;
}

export default function Privacy() {
  const { data: settings } = useGetSettings();
  const businessName = getBusinessName(settings as any);
  const content = (settings as any)?.privacyPolicy || buildDefaultPolicy(settings as any);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 mb-4">
          <Shield size={26} className="text-pink-600" />
        </div>
        <h1 className="text-3xl font-display font-extrabold text-gray-900">Privacy Policy</h1>
        <p className="text-gray-500 mt-2 text-sm">How {businessName || "the business"} collects, uses, and protects your information</p>
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
