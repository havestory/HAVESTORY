import { useState, useEffect } from "react";
import { Mail, MailOpen, Trash2, Search, Eye, X, RefreshCw } from "lucide-react";

type Message = {
  id: number;
  messageId: string;
  fullName: string;
  phone: string;
  email?: string | null;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [selected, setSelected] = useState<Message | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      setMessages(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMessages(); }, []);

  const markRead = async (msg: Message) => {
    if (msg.isRead) return;
    await fetch(`/api/messages/${msg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    setMessages(msgs => msgs.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
    setSelected(m => m?.id === msg.id ? { ...m, isRead: true } : m);
  };

  const remove = async (id: number) => {
    await fetch(`/api/messages/${id}`, { method: "DELETE" });
    setDeleteId(null);
    setSelected(s => s?.id === id ? null : s);
    setMessages(msgs => msgs.filter(m => m.id !== id));
  };

  const openMessage = (msg: Message) => {
    setSelected(msg);
    markRead(msg);
  };

  const filtered = messages
    .filter(m => filter === "all" ? true : filter === "unread" ? !m.isRead : m.isRead)
    .filter(m => {
      const q = search.toLowerCase();
      return !q || m.fullName.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q) || m.messageId.toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
    });

  const unreadCount = messages.filter(m => !m.isRead).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Mail size={22} className="text-pink-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Messages</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-pink-500 text-white text-xs font-bold rounded-full">{unreadCount} new</span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Inquiries and messages from your website contact form.</p>
        </div>
        <button onClick={() => fetchMessages()} className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors shrink-0">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3 sm:flex-wrap">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, subject, email..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-200"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "unread", "read"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all capitalize ${filter === f ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent" : "border-gray-200 text-gray-600 hover:border-pink-200"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Message List */}
        <div className="flex-1 min-w-0 w-full">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-20 border border-gray-100" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Mail size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">{search || filter !== "all" ? "No messages match your filter" : "No messages yet"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(msg => {
                const date = new Date(msg.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                const isActive = selected?.id === msg.id;
                return (
                  <div
                    key={msg.id}
                    onClick={() => openMessage(msg)}
                    className={`group bg-white border rounded-xl p-4 cursor-pointer transition-all hover:border-pink-200 hover:shadow-sm ${isActive ? "border-pink-300 ring-1 ring-pink-100 shadow-sm" : "border-gray-100"} ${!msg.isRead ? "border-l-4 border-l-pink-400" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {!msg.isRead ? <Mail size={13} className="text-pink-500 shrink-0" /> : <MailOpen size={13} className="text-gray-300 shrink-0" />}
                          <span className={`text-sm truncate ${!msg.isRead ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>{msg.fullName}</span>
                          <span className="text-[10px] text-gray-400 shrink-0 font-mono">{msg.messageId}</span>
                        </div>
                        <p className={`text-xs truncate ml-5 ${!msg.isRead ? "text-gray-700 font-semibold" : "text-gray-500"}`}>{msg.subject}</p>
                        <p className="text-xs text-gray-400 truncate ml-5 mt-0.5">{msg.message}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{date}</span>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteId(msg.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-red-400 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Message Detail Panel */}
        {selected && (
          <div className="w-full lg:w-96 shrink-0 bg-white border border-gray-100 rounded-2xl shadow-sm lg:sticky top-5 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Message Detail</h3>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">From</div>
                <div className="font-semibold text-gray-900">{selected.fullName}</div>
                <div className="text-xs text-gray-500 mt-0.5">{selected.phone}</div>
                {selected.email && <div className="text-xs text-gray-500">{selected.email}</div>}
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Subject</div>
                <div className="text-sm font-semibold text-gray-900">{selected.subject}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Message</div>
                <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{selected.message}</div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-50">
                <span className="font-mono">{selected.messageId}</span>
                <span>{new Date(selected.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex gap-2">
                {selected.email && (
                  <a
                    href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold rounded-xl"
                  >
                    <Mail size={13} /> Reply via Email
                  </a>
                )}
                <button
                  onClick={() => setDeleteId(selected.id)}
                  className="flex items-center gap-1 px-3 py-2 text-red-500 hover:bg-red-50 text-xs font-semibold rounded-xl border border-red-100 transition-colors"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Message?</h3>
              <p className="text-sm text-gray-500 mb-6">This message will be permanently deleted.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={() => remove(deleteId)} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
