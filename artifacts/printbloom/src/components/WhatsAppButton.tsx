import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ChevronDown } from "lucide-react";
import { useGetSettings } from "@workspace/api-client-react";
import { getBusinessName } from "@/lib/brand-settings";

const QUICK_REPLIES = [
  "I'd like to get a price quote for a frame or photo print",
  "Can I track my existing order?",
  "I need help with a custom photo or frame project",
  "What are your delivery options?",
];

function WhatsAppIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M16 1C7.716 1 1 7.716 1 16c0 2.628.677 5.098 1.864 7.25L1 31l7.967-2.087A14.938 14.938 0 0016 31c8.284 0 15-6.716 15-15S24.284 1 16 1z"
        fill="currentColor"
      />
      <path
        d="M23.5 20.31c-.31-.156-1.838-.906-2.122-.006-.288.9-1.125 1.125-1.969.75-.843-.375-3.562-2.25-5.062-5.25-.375-.75-.188-1.5.187-1.969.375-.468.844-.468 1.125-.468.281 0 .469.281.75.844.281.562.844 1.687.938 1.781.093.094.187.281 0 .563-.188.281-.281.375-.375.469-.094.093-.188.281-.094.468.094.188.75 1.219 1.594 2.063.844.843 1.781 1.125 2.156 1.218.375.094.563.094.75-.187.188-.281.75-.938.938-1.219.187-.281.375-.25.75-.094.375.156 2.25 1.063 2.625 1.219.375.156.625.25.719.375.094.594.094 1.125-.188 1.688-.281.562-.938 1.031-1.781 1.031a7.781 7.781 0 01-2.906-.562L23.5 20.31z"
        fill="white"
      />
    </svg>
  );
}

export function WhatsAppButton() {
  const { data: settings } = useGetSettings();
  const businessName = getBusinessName(settings);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  if (!settings?.whatsappNumber) return null;

  const openChat = (text?: string) => {
    const msg = encodeURIComponent(text || message || settings.whatsappMessage || "Hello! I'm interested in your services.");
    window.open(`https://wa.me/${settings.whatsappNumber}?text=${msg}`, "_blank");
  };

  const handleSend = () => {
    if (!message.trim()) return;
    openChat(message.trim());
    setMessage("");
  };

  return (
    <>
      {/* Popup Chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 26, stiffness: 380 }}
            className="fixed bottom-28 right-4 sm:right-6 z-50 w-[340px] sm:w-[380px] rounded-2xl overflow-hidden shadow-2xl shadow-black/25"
            style={{ maxWidth: "calc(100vw - 2rem)" }}
          >
            {/* Header */}
            <div className="bg-[#075e54] px-4 py-3 flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center text-white">
                  <WhatsAppIcon size={24} />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#075e54]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{businessName}</p>
                <p className="text-green-300 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                  Online · Replies instantly
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={18} className="text-white/80" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="bg-[#ece5dd] px-4 py-5 space-y-3" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c8baac' fill-opacity='0.18'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E\")" }}>
              {/* Greeting Bubble */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm max-w-[85%]"
              >
                <p className="text-[13px] text-gray-800 leading-relaxed">
                  Hi there! 👋 Welcome to <strong>{businessName}</strong>.<br />
                  How can we help with your studio, print or frame project today?
                </p>
                <p className="text-[10px] text-gray-400 text-right mt-1.5">Just now</p>
              </motion.div>

              {/* Quick Replies */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                {QUICK_REPLIES.map((reply, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.07 }}
                    onClick={() => openChat(reply)}
                    className="block w-auto text-left bg-white/90 hover:bg-white text-[12.5px] text-gray-700 font-medium px-4 py-2.5 rounded-full shadow-sm border border-white/80 transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] truncate max-w-full"
                  >
                    {reply}
                  </motion.button>
                ))}
              </motion.div>
            </div>

            {/* Input */}
            <div className="bg-[#f0f0f0] px-3 py-2.5 flex items-center gap-2 border-t border-gray-200">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder="Type your message..."
                className="flex-1 bg-white rounded-full px-4 py-2 text-sm outline-none placeholder:text-gray-400 shadow-sm"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSend}
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  message.trim() ? "bg-[#25D366] text-white shadow-sm" : "bg-gray-300 text-gray-400"
                }`}
              >
                <Send size={15} />
              </motion.button>
            </div>

            {/* Scroll-down indicator (decorative) */}
            <div className="bg-[#f0f0f0] flex justify-center pb-2">
              <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center opacity-70">
                <ChevronDown size={14} className="text-white" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button — bottom offset honours iOS safe-area-inset-bottom
          so the button doesn't overlap the iPhone home-indicator bar. */}
      <div
        className="fixed right-4 sm:right-6 z-50"
        style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Ping rings */}
        {!isOpen && (
          <>
            <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
            <span className="absolute -inset-2 rounded-full bg-[#25D366] animate-ping opacity-15" style={{ animationDelay: "0.4s" }} />
          </>
        )}

        <motion.button
          onClick={() => setIsOpen(o => !o)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          className="relative w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xl shadow-green-500/40 transition-shadow hover:shadow-green-500/60"
          aria-label="Chat on WhatsApp"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
                <X size={24} />
              </motion.div>
            ) : (
              <motion.div key="wa" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }}>
                <WhatsAppIcon size={28} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Notification dot */}
        {!isOpen && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-white text-[9px] font-bold flex items-center justify-center"
          >
            1
          </motion.span>
        )}
      </div>
    </>
  );
}
