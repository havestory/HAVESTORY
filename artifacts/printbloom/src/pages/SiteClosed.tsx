import { motion } from "framer-motion";
import { useGetSettings } from "@workspace/api-client-react";
import { Clock, Mail, Phone, MessageCircle } from "lucide-react";

export default function SiteClosed() {
  const { data: settings } = useGetSettings();
  const s = settings as any;

  const businessName = s?.businessName || "PrintBloom";
  const message = s?.siteClosedMessage || "We are currently closed for maintenance. We will be back soon!";
  const email = s?.email || "";
  const phone = s?.phone || "";
  const whatsapp = s?.whatsappNumber || "";
  const logoUrl = s?.logoUrl || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full text-center"
      >
        {/* Logo / Icon */}
        <div className="flex justify-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={businessName} className="h-16 object-contain" />
          ) : (
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center shadow-xl shadow-pink-500/25">
              <Clock size={36} className="text-white" />
            </div>
          )}
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-gray-900 mb-3">
          {businessName}
        </h1>
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-700 text-sm font-semibold">Temporarily Closed</span>
        </div>

        {/* Message */}
        <p className="text-gray-600 text-lg leading-relaxed mb-10 max-w-md mx-auto">
          {message}
        </p>

        {/* Contact options */}
        {(email || phone || whatsapp) && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-3">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Get in touch</p>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-green-50 hover:bg-green-100 transition-colors text-green-700 font-medium text-sm"
              >
                <MessageCircle size={18} className="text-green-500 shrink-0" />
                WhatsApp: {whatsapp}
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700 font-medium text-sm"
              >
                <Phone size={18} className="text-gray-400 shrink-0" />
                {phone}
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700 font-medium text-sm"
              >
                <Mail size={18} className="text-gray-400 shrink-0" />
                {email}
              </a>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-8">© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
      </motion.div>
    </div>
  );
}
