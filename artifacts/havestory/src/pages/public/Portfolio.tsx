import { useEffect, useMemo, useState } from 'react';
import { useListPortfolio } from '@workspace/api-client-react';
import { ComingSoon } from '@/components/public/ComingSoon';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Reveal } from '@/components/public/Reveal';

const ASPECT_RATIOS = ['3/4', '4/5', '1/1', '4/3', '3/4', '16/11'] as const;

export default function Portfolio() {
  const { data: items, isLoading } = useListPortfolio();
  const portfolioItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const [filter, setFilter] = useState('All');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const item of portfolioItems) {
      if (item.category && item.category.trim()) unique.add(item.category);
    }
    return ['All', ...unique];
  }, [portfolioItems]);

  const visibleItems = useMemo(
    () => (filter === 'All' ? portfolioItems : portfolioItems.filter((item) => item.category === filter)),
    [portfolioItems, filter],
  );

  useEffect(() => {
    setSelectedIndex(null);
  }, [filter]);

  const selected = selectedIndex === null ? null : visibleItems[selectedIndex];

  const move = (direction: number) => {
    if (selectedIndex === null || visibleItems.length < 2) return;
    setSelectedIndex((selectedIndex + direction + visibleItems.length) % visibleItems.length);
  };

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedIndex(null);
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedIndex, visibleItems.length]);

  return (
    <div className="hv-page">
      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="hv-page-hero">
        <div className="hv-container">
          <Reveal>
            <span className="hv-kicker">Gallery</span>
            <h1 className="hv-display hv-display-lg">
              Selected studio<br />
              <em>work.</em>
            </h1>
            {portfolioItems.length > 0 && (
              <p className="hv-lede">Browse finished frames, prints and projects from HAVESTORY.</p>
            )}
          </Reveal>
          <div className="hv-hero-ornament" aria-hidden="true" />
        </div>
      </header>

      <main className="hv-section">
        <div className="hv-container">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite" aria-label="Loading gallery">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="hv-skeleton"
                  style={{ aspectRatio: ASPECT_RATIOS[i % ASPECT_RATIOS.length] }}
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : portfolioItems.length === 0 ? (
            <ComingSoon
              eyebrow="Gallery"
              title="No projects published yet."
              description="Ask us about a frame or print made for your photograph."
              href="/custom-project"
              cta="Request a custom frame"
            />
          ) : (
            <>
              <Reveal>
                <div className="hv-section-head" style={{ marginBottom: 'clamp(24px, 3vw, 40px)' }}>
                  <div>
                    <span className="hv-kicker">The archive</span>
                    <p className="hv-display hv-display-sm" style={{ marginTop: 12 }}>
                      {visibleItems.length} {visibleItems.length === 1 ? 'project' : 'projects'}
                      {filter !== 'All' && (
                        <span style={{ color: 'var(--hv-muted)', fontSize: 18 }}> — {filter}</span>
                      )}
                    </p>
                  </div>
                  {categories.length > 1 && (
                    <div className="hv-chip-row" role="group" aria-label="Filter gallery by category">
                      {categories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          className={`hv-chip${filter === category ? ' is-active' : ''}`}
                          onClick={() => setFilter(category)}
                          aria-pressed={filter === category}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Reveal>

              <motion.div layout className="columns-1 gap-6 sm:columns-2 lg:columns-3">
                <AnimatePresence mode="popLayout">
                  {visibleItems.map((item, index) => (
                    <motion.button
                      type="button"
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      onClick={() => setSelectedIndex(index)}
                      aria-label={`Open ${item.title || 'gallery image'}`}
                      className="group relative mb-6 w-full break-inside-avoid text-left"
                    >
                      <div className="hv-img-frame" style={{ aspectRatio: ASPECT_RATIOS[index % ASPECT_RATIOS.length] }}>
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title || 'HAVESTORY studio work'}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="grid h-full w-full place-items-center" style={{ color: 'var(--hv-faint)' }}>
                            <ImageIcon style={{ width: 40, height: 40 }} />
                          </span>
                        )}
                        <span
                          className="absolute inset-0 flex flex-col justify-end p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                          style={{ background: 'linear-gradient(to top, rgba(18,16,13,0.88), transparent 60%)' }}
                        >
                          <small
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: '0.18em',
                              textTransform: 'uppercase',
                              color: 'var(--hv-gold)',
                            }}
                          >
                            {item.category || 'Studio work'}
                          </small>
                          <strong
                            style={{
                              fontFamily: '"Space Grotesk", "Inter", sans-serif',
                              fontSize: 22,
                              fontWeight: 600,
                              color: '#fdfaf4',
                              marginTop: 6,
                              lineHeight: 1.25,
                            }}
                          >
                            {item.title || `Story ${index + 1}`}
                          </strong>
                          <i
                            className="mt-3 flex items-center gap-2"
                            style={{ fontStyle: 'normal', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(253,250,244,0.75)' }}
                          >
                            <Maximize2 style={{ width: 14, height: 14 }} /> View image
                          </i>
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </motion.div>
            </>
          )}
        </div>
      </main>

      {/* ── Lightbox ─────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedIndex(null)}
            role="dialog"
            aria-modal="true"
            aria-label={selected.title || 'Gallery image preview'}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-10"
            style={{ background: 'rgba(18,16,13,0.94)', backdropFilter: 'blur(10px)' }}
          >
            <button
              type="button"
              onClick={() => setSelectedIndex(null)}
              aria-label="Close image"
              className="hv-btn hv-btn-outline-light hv-btn-sm absolute right-5 top-5 md:right-8 md:top-8"
              style={{ minHeight: 46, padding: '0 16px' }}
            >
              <X /> Close
            </button>
            {visibleItems.length > 1 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  move(-1);
                }}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-3 transition-transform hover:scale-110 md:left-8"
                style={{ background: 'rgba(245,239,227,0.12)', color: '#f5efe3', border: '1px solid rgba(245,239,227,0.25)' }}
              >
                <ChevronLeft style={{ width: 22, height: 22 }} />
              </button>
            )}
            <motion.figure
              key={selected.id}
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              onClick={(event) => event.stopPropagation()}
              className="max-h-full"
              style={{ maxWidth: 960, width: '100%' }}
            >
              <div className="hv-img-frame hv-frame-double" style={{ maxHeight: '72vh' }}>
                <img
                  src={selected.imageUrl || ''}
                  alt={selected.title || 'HAVESTORY studio work'}
                  decoding="async"
                  style={{ objectFit: 'contain', background: '#12100d' }}
                />
              </div>
              <figcaption
                className="mt-5 flex items-end justify-between gap-4"
                style={{ color: '#f5efe3' }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--hv-gold)',
                    }}
                  >
                    {selected.category || 'Studio work'}
                  </span>
                  <strong
                    className="block"
                    style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif', fontSize: 24, fontWeight: 600, marginTop: 6 }}
                  >
                    {selected.title || `Story ${(selectedIndex || 0) + 1}`}
                  </strong>
                </div>
                <small style={{ color: 'rgba(245,239,227,0.55)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {(selectedIndex || 0) + 1} / {visibleItems.length}
                </small>
              </figcaption>
            </motion.figure>
            {visibleItems.length > 1 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  move(1);
                }}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-3 transition-transform hover:scale-110 md:right-8"
                style={{ background: 'rgba(245,239,227,0.12)', color: '#f5efe3', border: '1px solid rgba(245,239,227,0.25)' }}
              >
                <ChevronRight style={{ width: 22, height: 22 }} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
