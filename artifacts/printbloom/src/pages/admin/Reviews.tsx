import { useState, useEffect } from "react";
import { Star, Check, X, Trash2, Pin, PinOff, Clock, Image as ImageIcon, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Review = {
  id: number;
  customerName: string;
  rating: number;
  comment: string;
  photoUrl?: string | null;
  approved: boolean;
  featured: boolean;
  createdAt: string;
};

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} className={i < rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"} />
      ))}
    </div>
  );
}

function ReviewCard({ review, onApprove, onReject, onFeature, onDelete }: {
  review: Review;
  onApprove: () => void;
  onReject: () => void;
  onFeature: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(review.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${review.featured ? "border-pink-200 ring-1 ring-pink-100" : "border-gray-100"}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-gray-900 text-sm">{review.customerName}</span>
              {review.featured && (
                <span className="px-2 py-0.5 bg-pink-50 text-pink-600 text-[10px] font-bold rounded-full border border-pink-100">Featured</span>
              )}
              {!review.approved && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full border border-amber-100 flex items-center gap-1"><Clock size={9} /> Pending</span>
              )}
              {review.approved && (
                <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-full border border-green-100">Approved</span>
              )}
            </div>
            <Stars rating={review.rating} />
            <p className={`text-sm text-gray-600 mt-2 leading-relaxed ${!expanded && "line-clamp-2"}`}>{review.comment}</p>
            {review.comment.length > 100 && (
              <button onClick={() => setExpanded(e => !e)} className="text-xs text-pink-500 hover:text-pink-700 mt-1 flex items-center gap-1">
                {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
              </button>
            )}
            {review.photoUrl && (
              <div className="mt-3">
                <a href={review.photoUrl} target="_blank" rel="noreferrer" className="block w-fit group relative">
                  <img
                    src={review.photoUrl}
                    alt={`${review.customerName}'s photo`}
                    className="w-20 h-20 rounded-xl object-cover border border-gray-100 shadow-sm group-hover:opacity-90 transition-opacity"
                  />
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 rounded-xl transition-opacity">
                    <ImageIcon size={16} className="text-white" />
                  </span>
                </a>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-400">{date}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 flex-wrap">
          {!review.approved ? (
            <>
              <button onClick={onApprove} className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors">
                <Check size={12} /> Approve
              </button>
              <button onClick={onReject} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg border border-red-100 transition-colors">
                <X size={12} /> Reject
              </button>
            </>
          ) : (
            <button onClick={onReject} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg border border-gray-200 transition-colors">
              <X size={12} /> Unapprove
            </button>
          )}
          {review.approved && (
            <button
              onClick={onFeature}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${review.featured
                ? "bg-pink-50 text-pink-600 border-pink-100 hover:bg-pink-100"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {review.featured ? <><PinOff size={12} /> Unfeature</> : <><Pin size={12} /> Feature</>}
            </button>
          )}
          <button onClick={onDelete} className="ml-auto flex items-center gap-1 px-3 py-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminReviews() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "all">("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reviews", { cache: "no-store" });
      const data = await res.json();
      setReviews(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, []);

  const update = async (id: number, data: Partial<Review>) => {
    await fetch(`/api/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await fetchReviews();
  };

  const remove = async (id: number) => {
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    setDeleteId(null);
    await fetchReviews();
  };

  const pending = reviews.filter(r => !r.approved);
  const approved = reviews.filter(r => r.approved);
  const featured = reviews.filter(r => r.featured);
  const withPhotos = reviews.filter(r => r.photoUrl);

  const displayed = tab === "pending" ? pending : tab === "approved" ? approved : reviews;

  const TABS = [
    { key: "pending", label: "Pending", count: pending.length },
    { key: "approved", label: "Approved", count: approved.length },
    { key: "all", label: "All Reviews", count: reviews.length },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Star size={22} className="text-pink-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Customer Reviews</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Approve, feature, and manage customer reviews.</p>
        </div>
        <button onClick={() => fetchReviews()} className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors shrink-0">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total Reviews", val: reviews.length, color: "text-gray-700" },
          { label: "Pending", val: pending.length, color: "text-amber-600" },
          { label: "Approved", val: approved.length, color: "text-green-600" },
          { label: "Featured", val: featured.length, color: "text-pink-600" },
          { label: "With Photos", val: withPhotos.length, color: "text-purple-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-center">
            <div className={`text-lg sm:text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Info about featured */}
      {featured.length > 0 && (
        <div className="bg-pink-50 border border-pink-100 rounded-xl px-4 py-3 text-sm text-pink-700 flex items-center gap-2">
          <Pin size={14} className="shrink-0" />
          <span><strong>{featured.length} featured</strong> review{featured.length !== 1 ? "s" : ""} are pinned to the homepage. The homepage shows up to 4 featured reviews, or falls back to the 4 latest approved reviews.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors relative ${tab === t.key
              ? "text-pink-600 after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-pink-500"
              : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${t.key === "pending" ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-500"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reviews Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/4 mb-3" />
              <div className="h-12 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Star size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">{tab === "pending" ? "No pending reviews" : tab === "approved" ? "No approved reviews yet" : "No reviews yet"}</p>
          {tab === "pending" && <p className="text-sm mt-1">All reviews have been processed.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayed.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              onApprove={() => update(review.id, { approved: true })}
              onReject={() => update(review.id, { approved: false, featured: false })}
              onFeature={() => update(review.id, { featured: !review.featured })}
              onDelete={() => setDeleteId(review.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Review?</h3>
              <p className="text-sm text-gray-500 mb-6">This review will be permanently removed and cannot be recovered.</p>
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
