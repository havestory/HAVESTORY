import { useState, useEffect, useCallback, useRef } from "react";
import { useListPortfolio } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tag, User, Calendar, ExternalLink, ChevronLeft, ChevronRight, ZoomIn, Loader2, ImageOff } from "lucide-react";

type PortfolioItem = {
  id: number;
  title: string;
  category: string;
  clientName?: string | null;
  description: string;
  imageUrl?: string | null;
  galleryImages: string | string[];
  tags: string | string[];
  featured: boolean;
  completedAt?: string | null;
};

function parseJson(val: string | string[]): string[] {
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

/* ── Card-level image carousel with swipe + auto-advance ── */
const cardSlide = {
  enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
};

function CardCarousel({ images, onOpen }: { images: string[]; onOpen: () => void }) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [hovered, setHovered] = useState(false);
  const dragStart = useRef<number | null>(null);

  const go = useCallback((d: number) => {
    setDir(d);
    setIdx(i => (i + d + images.length) % images.length);
  }, [images.length]);


  // Swipe / drag detection
  const onPointerDown = (e: React.PointerEvent) => { dragStart.current = e.clientX; };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const diff = dragStart.current - e.clientX;
    if (Math.abs(diff) > 40) go(diff > 0 ? 1 : -1);
    dragStart.current = null;
  };

  if (images.length === 0) {
    return (
      <div
        onClick={onOpen}
        className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center text-gray-300 text-5xl cursor-pointer"
      >
        🖼
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{ aspectRatio: "4/3" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Sliding images */}
      <AnimatePresence mode="popLayout" custom={dir} initial={false}>
        <motion.img
          key={idx}
          src={images[idx]}
          alt=""
          custom={dir}
          variants={cardSlide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.38, ease: [0.32, 0, 0.67, 0] }}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer"
          onClick={onOpen}
          draggable={false}
        />
      </AnimatePresence>

      {/* Prev / Next — visible on hover when multiple images */}
      {images.length > 1 && hovered && (
        <>
          <button
            onClick={e => { e.stopPropagation(); go(-1); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); go(1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setDir(i > idx ? 1 : -1); setIdx(i); }}
              className={`rounded-full transition-all duration-300 ${i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/50 hover:bg-white/80"}`}
            />
          ))}
        </div>
      )}

      {/* Image count badge */}
      {images.length > 1 && (
        <div className="absolute top-3 right-3 z-20 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {idx + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

export default function Portfolio() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const { data: portfolioItems, isLoading } = useListPortfolio();
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const categories = ["All", ...Array.from(new Set((portfolioItems ?? []).map(i => i.category)))];

  const filtered = (portfolioItems ?? []).filter(
    item => activeCategory === "All" || item.category === activeCategory
  );

  const openItem = (item: PortfolioItem) => {
    setSelectedItem(item);
    setGalleryIndex(0);
  };

  const closeItem = () => setSelectedItem(null);

  const galleryImages = selectedItem
    ? [
        ...(selectedItem.imageUrl ? [selectedItem.imageUrl] : []),
        ...parseJson(selectedItem.galleryImages),
      ]
    : [];

  const [direction, setDirection] = useState(1);

  const goNext = useCallback(() => {
    setDirection(1);
    setGalleryIndex(i => (i + 1) % galleryImages.length);
  }, [galleryImages.length]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setGalleryIndex(i => (i - 1 + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  // Auto-slide every 4s when modal is open and there are multiple images
  useEffect(() => {
    if (!selectedItem || galleryImages.length <= 1) return;
    const timer = setInterval(() => { setDirection(1); setGalleryIndex(i => (i + 1) % galleryImages.length); }, 4000);
    return () => clearInterval(timer);
  }, [selectedItem, galleryImages.length]);

  const prevImage = (e: React.MouseEvent) => { e.stopPropagation(); goPrev(); };
  const nextImage = (e: React.MouseEvent) => { e.stopPropagation(); goNext(); };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 120 : -120, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -120 : 120, opacity: 0 }),
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-purple-50 to-white -z-10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-300/20 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-300/20 rounded-full blur-3xl -z-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto px-4"
        >
          <h1 className="text-5xl font-display font-extrabold text-gray-900 mb-4">Our Work</h1>
          <p className="text-lg text-gray-500">
            A showcase of premium prints, packaging, and design projects we've brought to life.
          </p>
        </motion.div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        ) : portfolioItems?.length === 0 ? (
          <div className="text-center py-24 glass rounded-3xl">
            <ImageOff size={52} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">Portfolio Coming Soon</h3>
            <p className="text-gray-400 text-sm">Our team is uploading completed projects. Check back soon!</p>
          </div>
        ) : (
        <>
        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                activeCategory === cat
                  ? "btn-gradient text-white shadow-lg shadow-pink-500/20"
                  : "glass border border-white/60 text-gray-600 hover:border-primary/30 hover:text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Masonry Grid */}
        <motion.div layout className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
          <AnimatePresence>
            {filtered.map((item, index) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="break-inside-avoid relative group rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:shadow-purple-900/10 transition-shadow duration-300"
              >
                {/* ── Swipeable card carousel ── */}
                <CardCarousel
                  images={[
                    ...(item.imageUrl ? [item.imageUrl] : []),
                    ...parseJson(item.galleryImages),
                  ].filter(Boolean).length > 0
                    ? [
                        ...(item.imageUrl ? [item.imageUrl] : []),
                        ...parseJson(item.galleryImages),
                      ].filter(Boolean)
                    : [`${import.meta.env.BASE_URL}images/placeholder-portfolio.png`]
                  }
                  onOpen={() => openItem(item as PortfolioItem)}
                />

                {/* Hover info overlay — sits over the carousel */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-purple-900/90 via-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-5 pointer-events-none"
                >
                  <div className="translate-y-3 group-hover:translate-y-0 transition-transform duration-300">
                    <span className="text-pink-300 text-xs font-bold uppercase tracking-widest mb-1 block">
                      {item.category}
                    </span>
                    <h3 className="text-white font-display font-bold text-lg leading-tight mb-1">
                      {item.title}
                    </h3>
                    {item.clientName && (
                      <p className="text-white/60 text-xs flex items-center gap-1">
                        <User size={11} /> {item.clientName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Zoom-in icon — click to open modal */}
                <button
                  onClick={() => openItem(item as PortfolioItem)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30"
                >
                  <ZoomIn size={16} />
                </button>

                {/* Featured badge */}
                {item.featured && (
                  <div className="absolute top-3 left-3 z-30 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow">
                    Featured
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No projects in this category yet.</p>
          </div>
        )}
        </>
        )}
      </div>

      {/* Full Project Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={closeItem}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={closeItem}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>

              {/* Image gallery */}
              <div className="relative overflow-hidden rounded-t-3xl bg-gray-100" style={{ aspectRatio: "16/9" }}>
                {galleryImages.length > 0 ? (
                  <>
                    <AnimatePresence mode="wait" custom={direction}>
                      <motion.img
                        key={galleryIndex}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        src={galleryImages[galleryIndex]}
                        alt={selectedItem.title}
                        className="w-full h-full object-cover"
                      />
                    </AnimatePresence>

                    {galleryImages.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
                        >
                          <ChevronLeft size={22} />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
                        >
                          <ChevronRight size={22} />
                        </button>

                        {/* Dots */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {galleryImages.map((_, i) => (
                            <button
                              key={i}
                              onClick={e => { e.stopPropagation(); setGalleryIndex(i); }}
                              className={`w-2 h-2 rounded-full transition-all ${i === galleryIndex ? "bg-white w-5" : "bg-white/50"}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">
                    🖼
                  </div>
                )}

                {/* Category badge on image */}
                <div className="absolute top-4 left-4">
                  <span className="btn-gradient text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow">
                    {selectedItem.category}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-7 md:p-10">
                {/* Title + meta */}
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-3xl font-display font-extrabold text-gray-900 mb-2">
                      {selectedItem.title}
                    </h2>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      {selectedItem.clientName && (
                        <span className="flex items-center gap-1.5">
                          <User size={14} className="text-primary" />
                          {selectedItem.clientName}
                        </span>
                      )}
                      {selectedItem.completedAt && (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-primary" />
                          {selectedItem.completedAt}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-pink-200 via-purple-200 to-transparent mb-6" />

                {/* Description */}
                <p className="text-gray-600 leading-relaxed text-base mb-8 whitespace-pre-line">
                  {selectedItem.description}
                </p>

                {/* Tags */}
                {parseJson(selectedItem.tags).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                      <Tag size={12} /> Tags
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {parseJson(selectedItem.tags).map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1.5 rounded-full text-sm bg-gradient-to-r from-pink-50 to-purple-50 border border-purple-100 text-purple-700 font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gallery thumbnails */}
                {galleryImages.length > 1 && (
                  <div className="mt-8">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                      Project Gallery
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {galleryImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setGalleryIndex(i)}
                          className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                            i === galleryIndex
                              ? "border-primary shadow-lg shadow-primary/20 scale-105"
                              : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img src={img} alt={`Gallery ${i + 1}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="mt-8 flex gap-3">
                  <a
                    href="/contact"
                    className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold text-white flex items-center gap-2"
                  >
                    <ExternalLink size={16} /> Get a Similar Project
                  </a>
                  <button
                    onClick={closeItem}
                    className="glass border border-white/60 px-6 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:text-primary transition-colors"
                  >
                    Back to Portfolio
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
