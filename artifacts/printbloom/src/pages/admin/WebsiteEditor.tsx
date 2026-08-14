import { useState, useRef, useEffect } from "react";
import { applyThemeVars } from "@/lib/theme-utils";
import { broadcastAdminSave } from "@/lib/home-cache";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Reorder, AnimatePresence, motion } from "framer-motion";
import {
  useGetSettings, useUpdateSettings,
  useListPortfolio, useCreatePortfolioItem, useUpdatePortfolioItem, useDeletePortfolioItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home, Users, User, FileText, Search, Palette, Upload, X,
  Check, ImageIcon, ExternalLink, Globe, Type, AlignLeft,
  Sparkles, ArrowRight, Megaphone, Eye, Images, Star, Trash2,
  Plus, PenLine, Tag,
} from "lucide-react";

const TABS = [
  { id: "home", label: "Home Page", icon: Home },
  { id: "about", label: "About Us", icon: Users },
  { id: "portfolio", label: "Portfolio", icon: Images },
  { id: "privacy", label: "Privacy Policy", icon: FileText },
  { id: "terms", label: "Terms of Service", icon: FileText },
  { id: "seo", label: "SEO Settings", icon: Search },
  { id: "icon", label: "Website Icon", icon: ImageIcon },
  { id: "theme", label: "Color Theme", icon: Palette },
] as const;

type TabId = typeof TABS[number]["id"];

const THEME_PRESETS = [
  {
    id: "light-premium",
    label: "Light Premium",
    desc: "Deep navy type, warm ivory surfaces & gold accents",
    from: "#173A5E",
    to: "#B87919",
    accent: "#8C5B08",
    primary: "220 55% 18%",
    secondary: "38 75% 38%",
  },
  {
    id: "light-editorial",
    label: "Light Editorial",
    desc: "Ivory, warm sand & bold studio charcoal",
    from: "#B88746",
    to: "#6D4C41",
    accent: "#A66A2C",
    primary: "26 32% 16%",
    secondary: "31 53% 44%",
  },
  {
    id: "havestory-gallery",
    label: "Gallery Theme",
    desc: "Warm ivory, walnut & muted bronze",
    from: "#442a22",
    to: "#5d4037",
    accent: "#a67c60",
    primary: "15 34% 20%",
    secondary: "20 19% 44%",
  },
  {
    id: "amber-purple",
    label: "Pink & Purple",
    desc: "Default — romantic & vibrant",
    from: "#ec4899",
    to: "#9333ea",
    accent: "#d946ef",
    primary: "330 85% 55%",
    secondary: "270 70% 60%",
  },
  {
    id: "blue-indigo",
    label: "Blue & Indigo",
    desc: "Professional & trustworthy",
    from: "#3b82f6",
    to: "#6366f1",
    accent: "#4f46e5",
    primary: "217 91% 60%",
    secondary: "239 84% 67%",
  },
  {
    id: "green-teal",
    label: "Green & Teal",
    desc: "Fresh & eco-friendly",
    from: "#22c55e",
    to: "#14b8a6",
    accent: "#10b981",
    primary: "142 71% 45%",
    secondary: "174 72% 40%",
  },
  {
    id: "orange-red",
    label: "Orange & Red",
    desc: "Energetic & bold",
    from: "#f97316",
    to: "#ef4444",
    accent: "#f59e0b",
    primary: "25 95% 53%",
    secondary: "0 84% 60%",
  },
  {
    id: "cyan-blue",
    label: "Cyan & Blue",
    desc: "Cool & modern",
    from: "#06b6d4",
    to: "#3b82f6",
    accent: "#0ea5e9",
    primary: "186 100% 42%",
    secondary: "217 91% 60%",
  },
  {
    id: "rose-amber",
    label: "Rose & Amber",
    desc: "Warm & inviting",
    from: "#f43f5e",
    to: "#f59e0b",
    accent: "#fb7185",
    primary: "350 89% 60%",
    secondary: "43 96% 56%",
  },
];

const inp = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 transition-colors placeholder:text-gray-400";
const ta = `${inp} resize-none`;

function FlatIconLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#1CB0F6"/>
      <path d="M8 8h8v2H8V8zm0 4h8v2H8v-2zm0 4h6v2H8v-2z" fill="white"/>
      <circle cx="22" cy="22" r="6" fill="white"/>
      <path d="M22 18v4l3 2" stroke="#1CB0F6" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function SiteImageUpload({
  label,
  value,
  onChange,
  hint,
  sizeHint,
}: {
  label: string;
  value?: string | null;
  onChange: (url: string) => void;
  hint?: string;
  sizeHint: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlDraft, setUrlDraft] = useState("");
  const [urlPreview, setUrlPreview] = useState("");
  const [urlError, setUrlError] = useState("");

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/upload-image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onChange(data.url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function previewUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) { setUrlError("Please paste an image URL."); return; }
    setUrlPreview(trimmed);
    setUrlError("");
  }

  function applyUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setUrlDraft("");
    setUrlPreview("");
    setMode("upload");
  }

  return (
    <div>
      <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-3">{hint}</p>}

      {/* Mode toggle */}
      <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "upload" ? "bg-white text-amber-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
        >
          <Upload size={11} /> Upload File
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "url" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
        >
          <FlatIconLogo size={11} /> Import from URL
        </button>
      </div>

      {mode === "upload" && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden bg-gray-50/50">
          {value ? (
            <div className="relative group">
              <img src={value} alt="preview" className="w-full max-h-48 object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => ref.current?.click()}
                  className="px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-gray-800 hover:bg-gray-100 flex items-center gap-1.5"
                >
                  <Upload size={12} /> Replace
                </button>
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="px-3 py-1.5 bg-red-50 rounded-lg text-xs font-bold text-red-600 hover:bg-red-100 flex items-center gap-1.5"
                >
                  <X size={12} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => ref.current?.click()}
              className="w-full py-10 flex flex-col items-center gap-2 hover:bg-amber-50/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-stone-100 flex items-center justify-center">
                <ImageIcon size={22} className="text-amber-500" />
              </div>
              <div className="text-sm font-bold text-gray-700">{uploading ? "Uploading..." : "Click to upload image"}</div>
              <div className="text-xs text-gray-400">PNG, JPG, WEBP · Max 10MB</div>
            </button>
          )}
        </div>
      )}

      {mode === "url" && (
        <div className="border-2 border-dashed border-blue-200 rounded-2xl p-4 bg-blue-50/40 space-y-3">
          {/* Flaticon shortcut */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-white border border-blue-100 rounded-xl">
            <FlatIconLogo size={20} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-gray-800">Browse Flaticon</div>
              <div className="text-[10px] text-gray-400">Search for icons &amp; illustrations, then copy the image URL and paste below</div>
            </div>
            <a
              href="https://www.flaticon.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-[#1CB0F6] hover:bg-[#0ea5e9] text-white text-xs font-bold rounded-lg transition-colors shrink-0"
            >
              Open <ExternalLink size={10} />
            </a>
          </div>

          {/* How-to hint */}
          <div className="flex items-start gap-2 text-[10px] text-blue-600">
            <span className="font-bold shrink-0">How to:</span>
            <span>Find your icon on Flaticon → right-click the icon image → "Copy image address" → paste below. Or use any direct image URL from the web.</span>
          </div>

          {/* URL input */}
          <div className="flex gap-2">
            <input
              value={urlDraft}
              onChange={e => { setUrlDraft(e.target.value); setUrlPreview(""); setUrlError(""); }}
              onKeyDown={e => e.key === "Enter" && previewUrl()}
              placeholder="https://cdn-icons-png.flaticon.com/512/..."
              className="flex-1 px-3 py-2 border border-blue-200 rounded-xl text-xs outline-none focus:border-blue-400 bg-white placeholder:text-gray-300"
            />
            <button
              type="button"
              onClick={previewUrl}
              disabled={!urlDraft.trim()}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Preview
            </button>
          </div>

          {urlError && <p className="text-[10px] text-red-500">{urlError}</p>}

          {/* URL preview */}
          {urlPreview && (
            <div className="space-y-2">
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden flex items-center justify-center p-3 min-h-[80px]">
                <img
                  src={urlPreview}
                  alt="preview"
                  className="max-h-36 max-w-full object-contain"
                  onError={() => setUrlError("Could not load image. Check the URL and try again.")}
                />
              </div>
              <button
                type="button"
                onClick={applyUrl}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                <Check size={13} /> Use This Image
              </button>
            </div>
          )}

          {value && (
            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-blue-100">
              <span>Current image is set</span>
              <button type="button" onClick={() => onChange("")} className="text-red-400 hover:text-red-600 flex items-center gap-1">
                <X size={10} /> Remove current
              </button>
            </div>
          )}
        </div>
      )}

      {/* Size hint badge */}
      <div className="flex items-center gap-1.5 mt-2">
        <div className="px-2.5 py-1 bg-stone-50 border border-stone-100 rounded-full text-[10px] font-bold text-stone-600">
          Recommended: {sizeHint}
        </div>
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
            <ExternalLink size={10} /> View full
          </a>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

function SectionHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-100 to-stone-100 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-amber-600" />
      </div>
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function SaveBar({ onSave, saving, saved }: { onSave: () => void; saving: boolean; saved: boolean }) {
  return (
    <div className="flex justify-end mt-6 pt-5 border-t border-gray-100">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || saved}
        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${saved ? "bg-green-500 text-white" : "bg-gradient-to-r from-amber-500 to-stone-600 text-white hover:opacity-90 disabled:opacity-70"}`}
      >
        {saved ? <><Check size={15} /> Saved!</> : saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

function useSave(fn: () => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await fn(); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    catch { alert("Save failed. Please try again."); }
    finally { setSaving(false); }
  };
  return { save, saving, saved };
}

const PORTFOLIO_CATEGORIES = ["Custom Frames", "Fine Art Prints", "Studio Portraits", "Story Collages", "Gallery Walls", "Colour Lab", "Events", "Other"];
const DEFAULT_HOME_FEATURE_CARDS = [
  { title: "Frame Editions", copy: "Made-to-measure frames in refined timber finishes.", href: "/store" },
  { title: "Colour Prints", copy: "Colour-checked archival prints for lasting clarity.", href: "/store" },
  { title: "Story Collages", copy: "Thoughtful multi-image layouts for meaningful moments.", href: "/custom-project" },
  { title: "Studio Sessions", copy: "Portrait and product photography with a gallery finish.", href: "/services" },
];

const emptyPForm = () => ({
  title: "", category: "Custom Frames", clientName: "", description: "",
  tags: "", completedAt: "", featured: false,
});

function AvatarSlot({ label, url, onChange }: { label: string; url: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/upload-image", { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      onChange(data.url);
    } finally { setUploading(false); }
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative group w-16 h-16">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
          {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <User size={22} className="text-gray-300" />}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
        >
          {uploading
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Upload size={14} className="text-white" />}
        </button>
        {url && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <X size={9} />
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
      </div>
      <span className="text-[10px] text-gray-400 font-medium">{label}</span>
    </div>
  );
}

export default function WebsiteEditor() {
  const [tab, setTab] = useState<TabId>(() => window.location.pathname.endsWith("/admin/portfolio") ? "portfolio" : "home");
  const { data: settings, refetch } = useGetSettings();
  const { mutateAsync: updateSettings } = useUpdateSettings();
  const queryClient = useQueryClient();

  /* ── HOME STATE ── */
  const [heroBgImage, setHeroBgImage] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroBadgeText, setHeroBadgeText] = useState("");
  const [heroHighlightWord, setHeroHighlightWord] = useState("");
  const [heroCtaText, setHeroCtaText] = useState("");
  const [heroCtaLink, setHeroCtaLink] = useState("");
  const [heroAvatarImage1, setHeroAvatarImage1] = useState("");
  const [heroAvatarImage2, setHeroAvatarImage2] = useState("");
  const [heroAvatarImage3, setHeroAvatarImage3] = useState("");
  const [heroAvatarImage4, setHeroAvatarImage4] = useState("");
  const [heroSlideImage1, setHeroSlideImage1] = useState("");
  const [heroSlideImage2, setHeroSlideImage2] = useState("");
  const [heroSlideImage3, setHeroSlideImage3] = useState("");
  const [heroSlideImage4, setHeroSlideImage4] = useState("");
  const [heroSlideImage5, setHeroSlideImage5] = useState("");
  const [heroSlideImage6, setHeroSlideImage6] = useState("");
  const [heroSlideImage7, setHeroSlideImage7] = useState("");
  const [heroSlideImage8, setHeroSlideImage8] = useState("");
  const [heroSlideImage9, setHeroSlideImage9] = useState("");
  const [heroSlideImage10, setHeroSlideImage10] = useState("");
  const [designerCredit, setDesignerCredit] = useState("");
  const [homeFeatureCards, setHomeFeatureCards] = useState(DEFAULT_HOME_FEATURE_CARDS);

  /* ── ABOUT STATE ── */
  const [aboutImage, setAboutImage] = useState("");
  const [aboutStory, setAboutStory] = useState("");
  const [aboutMission, setAboutMission] = useState("");
  const [aboutVision, setAboutVision] = useState("");
  const [aboutFoundedYear, setAboutFoundedYear] = useState("");
  const [aboutTeamSize, setAboutTeamSize] = useState("");
  const [aboutLocation, setAboutLocation] = useState("");

  /* ── POLICY STATE ── */
  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [termsOfService, setTermsOfService] = useState("");

  /* ── SEO STATE ── */
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [seoOgImage, setSeoOgImage] = useState("");

  /* ── FAVICON STATE ── */
  const [faviconUrl, setFaviconUrl] = useState("");
  const [faviconUploading, setFaviconUploading] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  /* ── THEME STATE ── */
  const [themePreset, setThemePreset] = useState("light-premium");
  const [specialEventEnabled, setSpecialEventEnabled] = useState(false);
  const [specialEventType, setSpecialEventType] = useState("new-year");
  const [specialEventMessage, setSpecialEventMessage] = useState("");

  /* ── PORTFOLIO STATE ── */
  const [showPForm, setShowPForm] = useState(false);
  const [editingPId, setEditingPId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [pForm, setPForm] = useState(emptyPForm());
  const [pCoverUrl, setPCoverUrl] = useState("");
  const [pGallery, setPGallery] = useState<string[]>([]);
  const [pUploading, setPUploading] = useState(false);
  const pGalleryRef = useRef<HTMLInputElement>(null);
  const pCoverRef = useRef<HTMLInputElement>(null);

  const { data: portfolioItems } = useListPortfolio();
  const { mutate: createPortfolio, isPending: creatingP } = useCreatePortfolioItem({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] }); closePForm(); } }
  });
  const { mutate: updatePortfolio, isPending: updatingP } = useUpdatePortfolioItem({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] }); closePForm(); } }
  });
  const { mutate: deletePortfolio } = useDeletePortfolioItem({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] }) }
  });

  const closePForm = () => { setShowPForm(false); setEditingPId(null); setPForm(emptyPForm()); setPCoverUrl(""); setPGallery([]); };

  const openEditP = (item: any) => {
    setEditingPId(item.id);
    setPForm({ title: item.title, category: item.category, clientName: item.clientName || "", description: item.description || "", tags: (item.tags || []).join(", "), completedAt: item.completedAt || "", featured: item.featured });
    setPCoverUrl(item.imageUrl || "");
    setPGallery(item.galleryImages || []);
    setShowPForm(true);
  };

  const submitPForm = () => {
    const payload = {
      title: pForm.title, category: pForm.category,
      clientName: pForm.clientName || undefined,
      description: pForm.description,
      imageUrl: pCoverUrl || undefined,
      galleryImages: pGallery,
      tags: pForm.tags.split(",").map(t => t.trim()).filter(Boolean),
      featured: pForm.featured,
      completedAt: pForm.completedAt || undefined,
    };
    if (editingPId) updatePortfolio({ id: editingPId, data: payload });
    else createPortfolio({ data: payload });
  };

  async function uploadPortfolioImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/settings/upload-image", { method: "POST", credentials: "include", body: fd });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return data.url;
  }

  async function handleGalleryFiles(files: FileList) {
    setPUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      try { urls.push(await uploadPortfolioImage(file)); } catch { /* skip */ }
    }
    setPGallery(g => [...g, ...urls]);
    setPUploading(false);
  }

  const setF = (k: keyof ReturnType<typeof emptyPForm>, v: any) => setPForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!settings) return;
    const s = settings as any;
    setHeroBgImage(s.heroBgImage || "");
    setHeroTitle(s.heroTitle || "");
    setHeroSubtitle(s.heroSubtitle || "");
    setHeroBadgeText(s.heroBadgeText || "");
    setHeroHighlightWord(s.heroHighlightWord || "");
    setHeroCtaText(s.heroCtaText || "");
    setHeroCtaLink(s.heroCtaLink || "");
    setHeroAvatarImage1(s.heroAvatarImage1 || "");
    setHeroAvatarImage2(s.heroAvatarImage2 || "");
    setHeroAvatarImage3(s.heroAvatarImage3 || "");
    setHeroAvatarImage4(s.heroAvatarImage4 || "");
    setHeroSlideImage1((s as any).heroSlideImage1 || "");
    setHeroSlideImage2((s as any).heroSlideImage2 || "");
    setHeroSlideImage3((s as any).heroSlideImage3 || "");
    setHeroSlideImage4((s as any).heroSlideImage4 || "");
    setHeroSlideImage5((s as any).heroSlideImage5 || "");
    setHeroSlideImage6((s as any).heroSlideImage6 || "");
    setHeroSlideImage7((s as any).heroSlideImage7 || "");
    setHeroSlideImage8((s as any).heroSlideImage8 || "");
    setHeroSlideImage9((s as any).heroSlideImage9 || "");
    setHeroSlideImage10((s as any).heroSlideImage10 || "");
    setDesignerCredit(s.designerCredit ?? "");
    try {
      const parsed = typeof s.homeFeatureCards === "string" ? JSON.parse(s.homeFeatureCards) : s.homeFeatureCards;
      setHomeFeatureCards(Array.isArray(parsed) && parsed.length
        ? DEFAULT_HOME_FEATURE_CARDS.map((fallback, index) => ({ ...fallback, ...(parsed[index] || {}) }))
        : DEFAULT_HOME_FEATURE_CARDS);
    } catch { setHomeFeatureCards(DEFAULT_HOME_FEATURE_CARDS); }
    setAboutImage(s.aboutImage || "");
    setAboutStory(s.aboutStory || "");
    setAboutMission(s.aboutMission || "");
    setAboutVision(s.aboutVision || "");
    setAboutFoundedYear(s.aboutFoundedYear || "");
    setAboutTeamSize(s.aboutTeamSize || "");
    setAboutLocation(s.aboutLocation || "");
    setPrivacyPolicy(s.privacyPolicy || "");
    setTermsOfService(s.termsOfService || "");
    setSeoTitle(s.seoTitle || "");
    setSeoDescription(s.seoDescription || "");
    setSeoKeywords(s.seoKeywords || "");
    setSeoOgImage(s.seoOgImage || "");
    setThemePreset(s.themePreset || "light-premium");
    setSpecialEventEnabled(Boolean(s.specialEventEnabled));
    setSpecialEventType(s.specialEventType || "new-year");
    setSpecialEventMessage(s.specialEventMessage || "");
    setFaviconUrl(s.faviconUrl || "");
  }, [settings]);

  /* ── SAVE HANDLERS ── */
  const homeFields = { heroBgImage, heroTitle, heroSubtitle, heroBadgeText, heroHighlightWord, heroCtaText, heroCtaLink, heroAvatarImage1, heroAvatarImage2, heroAvatarImage3, heroAvatarImage4, heroSlideImage1, heroSlideImage2, heroSlideImage3, heroSlideImage4, heroSlideImage5, heroSlideImage6, heroSlideImage7, heroSlideImage8, heroSlideImage9, heroSlideImage10, designerCredit, homeFeatureCards: JSON.stringify(homeFeatureCards) };
  const { save: saveHome, saving: savingHome, saved: savedHome } = useSave(async () => {
    await updateSettings({ data: homeFields });
    broadcastAdminSave();
    refetch();
  });

  const aboutFields = { aboutImage, aboutStory, aboutMission, aboutVision, aboutFoundedYear, aboutTeamSize, aboutLocation };
  const { save: saveAbout, saving: savingAbout, saved: savedAbout } = useSave(async () => {
    await updateSettings({ data: aboutFields });
    broadcastAdminSave();
    refetch();
  });

  const { save: savePrivacy, saving: savingPrivacy, saved: savedPrivacy } = useSave(async () => {
    await updateSettings({ data: { privacyPolicy } });
    broadcastAdminSave();
    refetch();
  });

  const { save: saveTerms, saving: savingTerms, saved: savedTerms } = useSave(async () => {
    await updateSettings({ data: { termsOfService } });
    broadcastAdminSave();
    refetch();
  });

  const seoFields = { seoTitle, seoDescription, seoKeywords, seoOgImage };
  const { save: saveSeo, saving: savingSeo, saved: savedSeo } = useSave(async () => {
    await updateSettings({ data: seoFields });
    broadcastAdminSave();
    refetch();
  });

  const { save: saveTheme, saving: savingTheme, saved: savedTheme } = useSave(async () => {
    await updateSettings({ data: { themePreset, specialEventEnabled, specialEventType, specialEventMessage } });
    broadcastAdminSave();
    refetch();
  });

  const { save: saveFavicon, saving: savingFavicon, saved: savedFavicon } = useSave(async () => {
    await updateSettings({ data: { faviconUrl } });
    broadcastAdminSave();
    refetch();
  });

  async function handleFaviconUpload(file: File) {
    setFaviconUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/upload-image", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setFaviconUrl(data.url);
    } catch {
      alert("Favicon upload failed. Please try again.");
    } finally {
      setFaviconUploading(false);
      if (faviconInputRef.current) faviconInputRef.current.value = "";
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Website Editor</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your public website content, SEO, and appearance</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 mb-6 bg-gray-100/80 p-1.5 rounded-2xl overflow-x-auto">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${active ? "bg-white text-amber-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

        {/* ═══════════════════════════ HOME PAGE ═══════════════════════════ */}
        {tab === "home" && (
          <div>
            <SectionHeader icon={Home} title="Home Page" desc="Edit your homepage hero section — the first thing visitors see" />

            <div className="space-y-6">
              <SiteImageUpload
                label="HERO BACKGROUND IMAGE"
                value={heroBgImage}
                onChange={setHeroBgImage}
                hint="Full-width banner behind the hero text. Use a high-resolution image for best quality."
                sizeHint="1920 × 1080 px"
              />

              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">BADGE / ANNOUNCEMENT PILL</label>
                <input
                  value={heroBadgeText}
                  onChange={e => setHeroBadgeText(e.target.value)}
                  placeholder="Premium Photo Frames · Made in Sri Lanka"
                  className={inp}
                />
                <p className="text-[10px] text-gray-400 mt-1">Short studio label shown above the main heading</p>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">MAIN HERO TITLE</label>
                <input
                  value={heroTitle}
                  onChange={e => setHeroTitle(e.target.value)}
                  placeholder="Frame the Moments That Stay"
                  className={inp}
                />
                <p className="text-[10px] text-gray-400 mt-1">The large heading shown in the hero section</p>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">HIGHLIGHTED WORD (gradient)</label>
                <input
                  value={heroHighlightWord}
                  onChange={e => setHeroHighlightWord(e.target.value)}
                  placeholder="Vision"
                  className={inp}
                />
                <p className="text-[10px] text-gray-400 mt-1">One word in the title to highlight with a gradient color effect</p>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">HERO SUBTITLE / DESCRIPTION</label>
                <textarea
                  value={heroSubtitle}
                  onChange={e => setHeroSubtitle(e.target.value)}
                  rows={3}
                  placeholder="Thoughtfully made photo frames, archival prints and studio work for the stories that matter."
                  className={ta}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">CTA BUTTON TEXT</label>
                  <input
                    value={heroCtaText}
                    onChange={e => setHeroCtaText(e.target.value)}
                    placeholder="Start Your Order"
                    className={inp}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">CTA BUTTON LINK</label>
                  <input
                    value={heroCtaLink}
                    onChange={e => setHeroCtaLink(e.target.value)}
                    placeholder="/custom-project"
                    className={inp}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-1">HOMEPAGE FEATURE CARDS</label>
                <p className="text-[10px] text-gray-400 mb-3">Edit the four cards directly below the hero. Titles, descriptions and links are shown exactly as configured here.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {homeFeatureCards.map((card, index) => (
                    <div key={index} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-wide text-amber-500">Card {index + 1}</div>
                      <input value={card.title} onChange={e => setHomeFeatureCards(cards => cards.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} placeholder="Card title" className={inp} />
                      <textarea value={card.copy} onChange={e => setHomeFeatureCards(cards => cards.map((item, i) => i === index ? { ...item, copy: e.target.value } : item))} rows={2} placeholder="Short description" className={ta} />
                      <input value={card.href} onChange={e => setHomeFeatureCards(cards => cards.map((item, i) => i === index ? { ...item, href: e.target.value } : item))} placeholder="/store" className={inp} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Hero Slideshow Images */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-1">HERO SLIDESHOW IMAGES</label>
                <p className="text-[10px] text-gray-400 mb-3">
                  Add up to 10 images. The homepage pins this story and transitions between each frame as visitors scroll; after the final frame, the page continues naturally into the store sections.
                  Ideal size: <strong>800 × 1000 px</strong> (portrait, 4:5 ratio). Use frame, print, studio or gallery photography for best results.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    ["Slide 1", heroSlideImage1, setHeroSlideImage1, "First slide — shown by default"],
                    ["Slide 2", heroSlideImage2, setHeroSlideImage2, ""],
                    ["Slide 3", heroSlideImage3, setHeroSlideImage3, ""],
                    ["Slide 4", heroSlideImage4, setHeroSlideImage4, ""],
                    ["Slide 5", heroSlideImage5, setHeroSlideImage5, ""],
                    ["Slide 6", heroSlideImage6, setHeroSlideImage6, ""],
                    ["Slide 7", heroSlideImage7, setHeroSlideImage7, ""],
                    ["Slide 8", heroSlideImage8, setHeroSlideImage8, ""],
                    ["Slide 9", heroSlideImage9, setHeroSlideImage9, ""],
                    ["Slide 10", heroSlideImage10, setHeroSlideImage10, ""]
                  ].map(([label, value, onChange, hint]) => (
                    <div key={label as string} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
                      <SiteImageUpload label={label as string} value={value as string} onChange={onChange as (url: string) => void} sizeHint="800 × 1000 px portrait" hint={hint as string || undefined} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Happy Clients Avatars */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-1">HAPPY CLIENTS PROFILE PHOTOS</label>
                <p className="text-[10px] text-gray-400 mb-3">The 4 small circular profile photos shown next to the star rating on the homepage. Ideal size: 100 × 100 px, square crop.</p>
                <div className="flex gap-4">
                  <AvatarSlot label="Photo 1" url={heroAvatarImage1} onChange={setHeroAvatarImage1} />
                  <AvatarSlot label="Photo 2" url={heroAvatarImage2} onChange={setHeroAvatarImage2} />
                  <AvatarSlot label="Photo 3" url={heroAvatarImage3} onChange={setHeroAvatarImage3} />
                  <AvatarSlot label="Photo 4" url={heroAvatarImage4} onChange={setHeroAvatarImage4} />
                </div>
              </div>

              {/* Footer Designer Credit */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-1">FOOTER DESIGNER CREDIT</label>
                <p className="text-[10px] text-gray-400 mb-2">Shown in the website footer as "Designed with 💜 by [name]". Leave blank to hide it entirely.</p>
                <input
                  value={designerCredit}
                  onChange={e => setDesignerCredit(e.target.value)}
                  placeholder="Designer or studio name"
                  className={inp}
                />
              </div>

              {/* Live preview hint */}
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
                <Eye size={16} className="text-blue-500 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-blue-800">Preview your changes</div>
                  <div className="text-[10px] text-blue-600 mt-0.5">After saving, open the <a href="/" target="_blank" className="underline">homepage</a> to see your updates live.</div>
                </div>
              </div>
            </div>

            <SaveBar onSave={saveHome} saving={savingHome} saved={savedHome} />
          </div>
        )}

        {/* ═══════════════════════════ ABOUT US ═══════════════════════════ */}
        {tab === "about" && (
          <div>
            <SectionHeader icon={Users} title="About Us" desc="Edit the About page — your story, mission, and company details" />

            <div className="space-y-6">
              <SiteImageUpload
                label="ABOUT PAGE MAIN IMAGE"
                value={aboutImage}
                onChange={setAboutImage}
                hint="Featured image shown alongside your story on the About page."
                sizeHint="800 × 600 px"
              />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">FOUNDED YEAR</label>
                  <input value={aboutFoundedYear} onChange={e => setAboutFoundedYear(e.target.value)} placeholder="2020" className={inp} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">TEAM SIZE</label>
                  <input value={aboutTeamSize} onChange={e => setAboutTeamSize(e.target.value)} placeholder="10+" className={inp} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">LOCATION</label>
                  <input value={aboutLocation} onChange={e => setAboutLocation(e.target.value)} placeholder="Sri Lanka" className={inp} />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">OUR STORY</label>
                <textarea
                  value={aboutStory}
                  onChange={e => setAboutStory(e.target.value)}
                  rows={5}
                  placeholder="Tell your brand story..."
                  className={ta}
                />
                <p className="text-[10px] text-gray-400 mt-1">Main story paragraph shown on the About page</p>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">OUR MISSION</label>
                <textarea
                  value={aboutMission}
                  onChange={e => setAboutMission(e.target.value)}
                  rows={3}
                  placeholder="Our mission is..."
                  className={ta}
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">OUR VISION</label>
                <textarea
                  value={aboutVision}
                  onChange={e => setAboutVision(e.target.value)}
                  rows={3}
                  placeholder="We envision a future where..."
                  className={ta}
                />
              </div>
            </div>

            <SaveBar onSave={saveAbout} saving={savingAbout} saved={savedAbout} />
          </div>
        )}

        {/* ═══════════════════════════ PORTFOLIO ═══════════════════════════ */}
        {tab === "portfolio" && (
          <div>
            <div className="flex items-start justify-between mb-6">
              <SectionHeader icon={Images} title="Portfolio" desc="Manage your portfolio projects — add multiple images per project for the gallery slider" />
              {!showPForm && (
                <button
                  onClick={() => { closePForm(); setShowPForm(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-stone-600 text-white text-sm font-bold rounded-xl shadow-md shrink-0"
                >
                  <Plus size={14} /> Add Project
                </button>
              )}
            </div>

            {/* Add / Edit Form */}
            {showPForm && (
              <div className="mb-6 border border-amber-100 rounded-2xl bg-amber-50/30 p-5 space-y-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-bold text-gray-800">{editingPId ? "Edit Project" : "New Portfolio Project"}</div>
                  <button onClick={closePForm} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>

                {/* Cover Image */}
                <div>
                  <div className="text-[10px] text-gray-400 font-bold tracking-widest mb-2">COVER IMAGE</div>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-white">
                    {pCoverUrl ? (
                      <div className="relative group">
                        <img src={pCoverUrl} alt="cover" className="w-full h-40 object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                          <button onClick={() => pCoverRef.current?.click()} className="px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-gray-800 flex items-center gap-1"><Upload size={11}/> Replace</button>
                          <button onClick={() => setPCoverUrl("")} className="px-3 py-1.5 bg-red-50 rounded-lg text-xs font-bold text-red-600 flex items-center gap-1"><X size={11}/> Remove</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => pCoverRef.current?.click()} className="w-full py-8 flex flex-col items-center gap-2 hover:bg-amber-50/50">
                        <ImageIcon size={24} className="text-amber-400" />
                        <span className="text-sm font-bold text-gray-600">Click to upload cover image</span>
                        <span className="text-xs text-gray-400">PNG, JPG, WEBP</span>
                      </button>
                    )}
                  </div>
                  <input ref={pCoverRef} type="file" accept="image/*" className="hidden"
                    onChange={async e => { const f = e.target.files?.[0]; if (f) { const url = await uploadPortfolioImage(f); setPCoverUrl(url); } e.target.value = ""; }}
                  />
                </div>

                {/* Gallery Images — drag to reorder */}
                <div>
                  <div className="text-[10px] text-gray-400 font-bold tracking-widest mb-2">
                    GALLERY IMAGES
                    {pGallery.length > 1 && (
                      <span className="ml-2 text-amber-400 normal-case font-normal tracking-normal">drag to reorder</span>
                    )}
                  </div>
                  <Reorder.Group
                    axis="x"
                    values={pGallery}
                    onReorder={setPGallery}
                    className="flex flex-wrap gap-2 mb-2"
                    style={{ listStyle: "none", padding: 0, margin: 0 }}
                    as="div"
                  >
                    <AnimatePresence initial={false}>
                      {pGallery.map((url, i) => (
                        <Reorder.Item
                          key={url}
                          value={url}
                          as="div"
                          className="relative group rounded-xl overflow-hidden border border-gray-200 cursor-grab active:cursor-grabbing"
                          style={{ width: 80, height: 80, flexShrink: 0 }}
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          whileDrag={{ scale: 1.08, boxShadow: "0 8px 30px rgba(0,0,0,0.18)", zIndex: 50, borderColor: "#e879f9" }}
                        >
                          <img src={url} alt={`gallery-${i}`} className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
                          {/* Order badge */}
                          <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-black/50 text-white text-[9px] font-bold flex items-center justify-center select-none">
                            {i + 1}
                          </div>
                          {/* Remove button */}
                          <button
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); setPGallery(g => g.filter((_, j) => j !== i)); }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={10} />
                          </button>
                        </Reorder.Item>
                      ))}
                    </AnimatePresence>

                    {/* Add button — always at the end */}
                    <motion.button
                      layout
                      onClick={() => pGalleryRef.current?.click()}
                      disabled={pUploading}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 hover:border-amber-400 hover:bg-amber-50/50 transition-all text-gray-400 flex-shrink-0"
                    >
                      {pUploading
                        ? <div className="animate-spin w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full" />
                        : <><Plus size={18} /><span className="text-[10px] font-bold">Add</span></>
                      }
                    </motion.button>
                  </Reorder.Group>

                  <p className="text-[10px] text-gray-400">
                    Select multiple images at once · Drag thumbnails to set the display order · Appears as a gallery slider on the portfolio page
                  </p>
                  <input ref={pGalleryRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => { if (e.target.files) handleGalleryFiles(e.target.files); e.target.value = ""; }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">PROJECT TITLE *</label>
                    <input value={pForm.title} onChange={e => setF("title", e.target.value)} placeholder="Wedding Invitations" className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">CATEGORY</label>
                    <select value={pForm.category} onChange={e => setF("category", e.target.value)} className={inp}>
                      {PORTFOLIO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">CLIENT NAME</label>
                    <input value={pForm.clientName} onChange={e => setF("clientName", e.target.value)} placeholder="ABC Company" className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">COMPLETED DATE</label>
                    <input value={pForm.completedAt} onChange={e => setF("completedAt", e.target.value)} placeholder="March 2026" className={inp} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">DESCRIPTION</label>
                  <textarea value={pForm.description} onChange={e => setF("description", e.target.value)} rows={3} placeholder="Describe the project, materials used, and outcome..." className={ta} />
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">TAGS <span className="text-gray-300 font-normal normal-case">(comma separated)</span></label>
                  <input value={pForm.tags} onChange={e => setF("tags", e.target.value)} placeholder="wedding, luxury, gold foil" className={inp} />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setF("featured", !pForm.featured)}
                      className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${pForm.featured ? "bg-gradient-to-r from-amber-500 to-stone-600" : "bg-gray-200"}`}
                      style={{ height: "22px", minWidth: "40px" }}
                    >
                      <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${pForm.featured ? "translate-x-5" : "translate-x-0.5"}`} style={{ width: "18px", height: "18px" }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-1"><Star size={13} className="text-yellow-400" /> Featured project</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={closePForm} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100">Cancel</button>
                    <button onClick={submitPForm} disabled={!pForm.title || creatingP || updatingP} className="px-5 py-2 bg-gradient-to-r from-amber-500 to-stone-600 text-white text-sm font-bold rounded-xl disabled:opacity-50">
                      {creatingP || updatingP ? "Saving..." : editingPId ? "Update Project" : "Add Project"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Projects List */}
            {(portfolioItems ?? []).length === 0 && !showPForm ? (
              <div className="text-center py-16 text-gray-400">
                <Images size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm">No portfolio projects yet. Click "Add Project" to create your first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {(portfolioItems ?? []).map((item: any) => {
                  const allImages = [item.imageUrl, ...(item.galleryImages || [])].filter(Boolean);
                  return (
                    <div key={item.id} className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                      {/* Thumbnail strip */}
                      <div className="relative h-36 bg-gray-100">
                        {allImages[0] ? (
                          <img src={allImages[0]} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={32} /></div>
                        )}
                        {item.featured && (
                          <div className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-stone-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star size={9} fill="currentColor" /> Featured
                          </div>
                        )}
                        {allImages.length > 1 && (
                          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {allImages.length} photos
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-sm truncate">{item.title}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{item.category}</span>
                              {item.clientName && <span className="text-[10px] text-gray-400 truncate">{item.clientName}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => openEditP(item)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                              <PenLine size={14} />
                            </button>
                            <button onClick={() => setDeleteConfirm({ id: item.id, name: item.title })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {(item.tags || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(item.tags || []).slice(0, 3).map((t: string) => (
                              <span key={t} className="text-[10px] text-stone-600 bg-stone-50 px-1.5 py-0.5 rounded-full">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════ PRIVACY POLICY ═══════════════════════════ */}
        {tab === "privacy" && (
          <div>
            <SectionHeader icon={FileText} title="Privacy Policy" desc="Displayed on /privacy — edit your full privacy policy text" />

            <div className="space-y-4">
              <div className="px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                <strong>Tip:</strong> Write your privacy policy in plain text or use line breaks to separate sections. You can use headings by starting a line with a title in ALL CAPS.
              </div>
              <textarea
                value={privacyPolicy}
                onChange={e => setPrivacyPolicy(e.target.value)}
                rows={22}
                placeholder={`PRIVACY POLICY

Last updated: March 2025

INFORMATION WE COLLECT
We collect information you provide directly to us when placing orders...

HOW WE USE YOUR INFORMATION
We use the information we collect to process your orders...

CONTACT US
If you have questions about this Privacy Policy, contact us at ${(settings as any)?.email || "the email configured in General Settings"}`}
                className={`${ta} font-mono text-xs leading-relaxed`}
              />
              <div className="text-[10px] text-gray-400">Public URL: <code className="bg-gray-100 px-1.5 py-0.5 rounded">/privacy</code></div>
            </div>

            <SaveBar onSave={savePrivacy} saving={savingPrivacy} saved={savedPrivacy} />
          </div>
        )}

        {/* ═══════════════════════════ TERMS OF SERVICE ═══════════════════════════ */}
        {tab === "terms" && (
          <div>
            <SectionHeader icon={FileText} title="Terms of Service" desc="Displayed on /terms — edit your full terms and conditions" />

            <div className="space-y-4">
              <div className="px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                <strong>Tip:</strong> Write your terms in plain text using line breaks to separate sections.
              </div>
              <textarea
                value={termsOfService}
                onChange={e => setTermsOfService(e.target.value)}
                rows={22}
                placeholder={`TERMS OF SERVICE

Last updated: March 2025

ACCEPTANCE OF TERMS
By placing an order with ${(settings as any)?.businessName || "the business"}, you agree to be bound by these terms...

ORDER & PAYMENT
All prices are in Sri Lankan Rupees (LKR)...

CANCELLATION POLICY
Orders may be cancelled within 24 hours of placement...

CONTACT
For questions about these terms, email us at ${(settings as any)?.email || "the email configured in General Settings"}`}
                className={`${ta} font-mono text-xs leading-relaxed`}
              />
              <div className="text-[10px] text-gray-400">Public URL: <code className="bg-gray-100 px-1.5 py-0.5 rounded">/terms</code></div>
            </div>

            <SaveBar onSave={saveTerms} saving={savingTerms} saved={savedTerms} />
          </div>
        )}

        {/* ═══════════════════════════ SEO SETTINGS ═══════════════════════════ */}
        {tab === "seo" && (
          <div>
            <SectionHeader icon={Search} title="SEO Settings" desc="Control how your website appears in Google search results and social shares" />

            <div className="space-y-6">
              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">PAGE TITLE (shown in browser tab & Google)</label>
                <input
                  value={seoTitle}
                  onChange={e => setSeoTitle(e.target.value)}
                  placeholder={`${(settings as any)?.businessName || "Your business"} — Studio, Colour Lab & Frames`}
                  className={inp}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-gray-400">Ideal length: 50–60 characters</p>
                  <span className={`text-[10px] font-bold ${seoTitle.length > 60 ? "text-red-500" : "text-green-500"}`}>{seoTitle.length}/60</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">META DESCRIPTION (shown in Google results)</label>
                <textarea
                  value={seoDescription}
                  onChange={e => setSeoDescription(e.target.value)}
                  rows={3}
                  placeholder={`${(settings as any)?.businessName || "Your business"} offers portrait, colour-lab and framing services in Sri Lanka...`}
                  className={ta}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-gray-400">Ideal length: 150–160 characters</p>
                  <span className={`text-[10px] font-bold ${seoDescription.length > 160 ? "text-red-500" : "text-green-500"}`}>{seoDescription.length}/160</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">KEYWORDS (comma-separated)</label>
                <input
                  value={seoKeywords}
                  onChange={e => setSeoKeywords(e.target.value)}
                  placeholder="photo frames sri lanka, custom frames, studio photography, archival prints"
                  className={inp}
                />
                <p className="text-[10px] text-gray-400 mt-1">Keywords help search engines understand your site topic</p>
              </div>

              <SiteImageUpload
                label="SOCIAL SHARE IMAGE (OG Image)"
                value={seoOgImage}
                onChange={setSeoOgImage}
                hint="This image appears when your website is shared on WhatsApp, Facebook, or Twitter."
                sizeHint="1200 × 630 px"
              />

              {/* Live preview of how Google listing looks */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">GOOGLE PREVIEW</label>
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="text-xs text-green-700 mb-0.5">{(settings as any)?.website || "Your configured website"}</div>
                  <div className="text-blue-700 font-semibold text-base mb-1 truncate">{seoTitle || (settings as any)?.businessName || "Your website title"}</div>
                  <div className="text-gray-600 text-xs leading-relaxed line-clamp-2">{seoDescription || `Add the SEO description for ${(settings as any)?.businessName || "your business"}.`}</div>
                </div>
              </div>
            </div>

            <SaveBar onSave={saveSeo} saving={savingSeo} saved={savedSeo} />
          </div>
        )}

        {/* ═══════════════════════════ WEBSITE ICON ═══════════════════════════ */}
        {tab === "icon" && (
          <div>
            <SectionHeader icon={ImageIcon} title="Website Icon (Favicon)" desc="The small icon shown in the browser tab, bookmarks, and shortcuts" />

            <div className="space-y-6">
              {/* Upload area */}
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 bg-gray-50/50 flex flex-col items-center gap-4">
                {faviconUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    {/* Browser tab preview */}
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold tracking-widest text-center mb-3">BROWSER TAB PREVIEW</p>
                      <div className="flex items-center gap-0 mx-auto w-fit">
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-t-lg shadow-sm min-w-[160px] max-w-[200px]">
                          <img src={faviconUrl} alt="favicon" className="w-4 h-4 object-contain shrink-0" />
                          <span className="text-xs text-gray-700 truncate font-medium">
                            {((settings as any)?.seoTitle || (settings as any)?.businessName || "Website")}
                          </span>
                          <span className="ml-auto text-gray-400 text-xs shrink-0">×</span>
                        </div>
                      </div>
                      <div className="h-0.5 bg-gray-200 w-full" />
                    </div>
                    {/* Current icon */}
                    <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                      <img src={faviconUrl} alt="favicon" className="w-16 h-16 object-contain" />
                      <div>
                        <p className="text-sm font-bold text-gray-800">Current icon is set</p>
                        <p className="text-xs text-gray-400 mt-0.5">Showing in browser tabs and bookmarks</p>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => faviconInputRef.current?.click()}
                            disabled={faviconUploading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                          >
                            <Upload size={11} /> Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => setFaviconUrl("")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 text-xs font-bold rounded-lg transition-colors"
                          >
                            <X size={11} /> Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={faviconUploading}
                    className="flex flex-col items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-stone-100 flex items-center justify-center">
                      {faviconUploading
                        ? <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        : <Upload size={24} className="text-amber-500" />}
                    </div>
                    <div className="text-sm font-bold text-gray-700">{faviconUploading ? "Uploading..." : "Click to upload icon"}</div>
                    <div className="text-xs text-gray-400">.ICO format recommended · Also supports PNG, SVG · 32×32 or 64×64 px</div>
                  </button>
                )}
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept=".ico,.png,.svg,image/x-icon,image/vnd.microsoft.icon"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFaviconUpload(f); }}
                />
              </div>

              {/* Info box */}
              <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
                <Eye size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700">
                  <strong className="font-bold">How it works:</strong> Upload your icon and click "Save Changes". The icon will immediately appear in the browser tab for all visitors. For best results, use a <strong>.ico file</strong> at 32×32 px or 64×64 px.
                </div>
              </div>
            </div>

            <SaveBar onSave={saveFavicon} saving={savingFavicon} saved={savedFavicon} />
          </div>
        )}

        {/* ═══════════════════════════ COLOR THEME ═══════════════════════════ */}
        {tab === "theme" && (
          <div>
            <SectionHeader icon={Palette} title="Color Theme" desc="Choose a color scheme for buttons, accents, and gradients across the site" />

            <div className="grid grid-cols-2 gap-4">
              {THEME_PRESETS.map(preset => {
                const active = themePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => { setThemePreset(preset.id); applyThemeVars(preset.id); }}
                    className={`relative flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all ${active ? "border-transparent shadow-lg" : "border-gray-200 hover:border-gray-300"}`}
                    style={active ? { borderColor: preset.from, background: `linear-gradient(135deg, ${preset.from}15, ${preset.to}15)` } : {}}
                  >
                    {/* Gradient swatch */}
                    <div
                      className="w-14 h-14 rounded-xl shrink-0 shadow-md"
                      style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-sm">{preset.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{preset.desc}</div>
                      {/* Color dots */}
                      <div className="flex gap-1.5 mt-2">
                        <div className="w-4 h-4 rounded-full shadow-sm" style={{ background: preset.from }} title="Primary" />
                        <div className="w-4 h-4 rounded-full shadow-sm" style={{ background: preset.to }} title="Secondary" />
                        <div className="w-4 h-4 rounded-full shadow-sm" style={{ background: preset.accent }} title="Accent" />
                      </div>
                    </div>
                    {active && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: preset.from }}>
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Preview section */}
            {(() => {
              const preset = THEME_PRESETS.find(p => p.id === themePreset) || THEME_PRESETS[0];
              return (
                <div className="mt-6 p-5 rounded-2xl border border-gray-100 bg-gray-50">
                  <div className="text-xs font-bold text-gray-400 mb-3">PREVIEW</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-md"
                      style={{ background: `linear-gradient(to right, ${preset.from}, ${preset.to})` }}
                    >
                      Order Now →
                    </button>
                    <span className="text-sm font-bold" style={{ background: `linear-gradient(to right, ${preset.from}, ${preset.to})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      Gradient Text
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: `${preset.from}20`, color: preset.from }}>
                      <Sparkles size={11} /> Badge Pill
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 p-5 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Special Event Animations</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Turn on a seasonal animation for special days and campaigns. It updates the public website after saving.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSpecialEventEnabled(value => !value)}
                aria-pressed={specialEventEnabled}
                className={`w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${specialEventEnabled ? "border-amber-300 bg-white" : "border-gray-200 bg-white/70"}`}
              >
                <div>
                  <div className="text-sm font-bold text-gray-900">Enable event animation</div>
                  <div className="text-xs text-gray-500 mt-0.5">Keep this off when you do not want seasonal effects.</div>
                </div>
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${specialEventEnabled ? "bg-amber-600" : "bg-gray-300"}`}>
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${specialEventEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </span>
              </button>

              <div className={`grid gap-4 sm:grid-cols-2 mt-4 ${specialEventEnabled ? "" : "opacity-50"}`}>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold tracking-widest block mb-2">EVENT STYLE</label>
                  <select
                    value={specialEventType}
                    onChange={event => setSpecialEventType(event.target.value)}
                    disabled={!specialEventEnabled}
                    className={`${inp} bg-white disabled:cursor-not-allowed`}
                  >
                    <option value="new-year">New Year — Fireworks</option>
                    <option value="valentine">Valentine's Day — Hearts</option>
                    <option value="christmas">Christmas — Falling Snow</option>
                    <option value="eid">Eid / Festive — Stars</option>
                    <option value="custom">Custom Event — Confetti</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold tracking-widest block mb-2">OPTIONAL MESSAGE</label>
                  <input
                    value={specialEventMessage}
                    onChange={event => setSpecialEventMessage(event.target.value)}
                    disabled={!specialEventEnabled}
                    placeholder="Seasonal greeting or campaign message"
                    className={`${inp} bg-white disabled:cursor-not-allowed`}
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-3">The selected animation stays subtle and does not block buttons, forms, or scrolling. Disable it after the event to return to the clean site.</p>
            </div>

            <div className="mt-4 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800">
              <strong>Live preview:</strong> Theme changes apply instantly across the site as you click. Save to make it permanent.
            </div>

            <SaveBar onSave={saveTheme} saving={savingTheme} saved={savedTheme} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Portfolio Item"
        message={deleteConfirm ? `Are you sure you want to delete "${deleteConfirm.name}"?` : ""}
        confirmLabel="Delete Item"
        onConfirm={() => { if (deleteConfirm) deletePortfolio({ id: deleteConfirm.id }); }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

