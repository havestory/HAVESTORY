import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: "spring", damping: 22, stiffness: 320 }}
            className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-red-400 via-red-500 to-rose-500" />

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base leading-snug">{title}</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</p>
                </div>
                <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg transition-colors shrink-0 -mt-0.5">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>

              {/* Warning note */}
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
                <p className="text-xs text-red-600 font-medium">This action cannot be undone.</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onConfirm(); onCancel(); }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-red-500/25"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

