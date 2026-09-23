import { useEffect, useState } from 'react';
import { useListPortfolio } from '@workspace/api-client-react';
import { ComingSoon } from '@/components/public/ComingSoon';
import { ChevronLeft, ChevronRight, Image as ImageIcon, LoaderCircle, Maximize2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Portfolio() {
  const { data: items, isLoading } = useListPortfolio();
  const portfolioItems = Array.isArray(items) ? items : [];
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex === null ? null : portfolioItems[selectedIndex];

  const move = (direction: number) => {
    if (selectedIndex === null || portfolioItems.length < 2) return;
    setSelectedIndex((selectedIndex + direction + portfolioItems.length) % portfolioItems.length);
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
  }, [selectedIndex, portfolioItems.length]);

  return (
    <div className="hs-gallery-page">
      <header className="hs-gallery-hero">
        <div><span>GALLERY</span><h1>Selected studio<br /><em>work.</em></h1></div>
        {portfolioItems.length > 0 && <p>Browse finished frames, prints and projects from HAVESTORY.</p>}
      </header>

      <main className="hs-gallery-content">
        {portfolioItems.length > 0 && <div className="hs-gallery-intro"><span>GALLERY</span><p>{portfolioItems.length} {portfolioItems.length === 1 ? 'project' : 'projects'}</p></div>}
        {isLoading ? (
          <div className="hs-gallery-loading" role="status" aria-live="polite">
            <LoaderCircle className="hs-gallery-loading-icon" aria-hidden="true" />
            <span>Loading gallery…</span>
          </div>
        ) : portfolioItems.length === 0 ? (
          <ComingSoon eyebrow="Gallery" title="No projects published yet." description="Ask us about a frame or print made for your photograph." href="/custom-project" cta="Request a custom frame" />
        ) : (
          <div className="hs-gallery-grid">
            {portfolioItems.map((item, index) => (
              <motion.button
                type="button"
                key={item.id}
                className={`hs-gallery-card hs-gallery-card-${index % 6}`}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: .16 }}
                transition={{ duration: .55, delay: (index % 6) * .055 }}
                onClick={() => setSelectedIndex(index)}
                aria-label={`Open ${item.title || 'gallery image'}`}
              >
                {item.imageUrl ? <img src={item.imageUrl} alt={item.title || 'HAVESTORY studio work'} loading="lazy" decoding="async" /> : <span className="hs-gallery-placeholder"><ImageIcon /></span>}
                <span className="hs-gallery-card-overlay"><small>{item.category || 'Studio work'}</small><strong>{item.title || `Story ${index + 1}`}</strong><i><Maximize2 /> View image</i></span>
              </motion.button>
            ))}
          </div>
        )}
      </main>

      <AnimatePresence>
        {selected && (
          <motion.div className="hs-gallery-lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedIndex(null)} role="dialog" aria-modal="true" aria-label={selected.title || 'Gallery image preview'}>
            <button type="button" className="hs-gallery-close" onClick={() => setSelectedIndex(null)} aria-label="Close image"><X /></button>
            {portfolioItems.length > 1 && <button type="button" className="hs-gallery-prev" onClick={event => { event.stopPropagation(); move(-1); }} aria-label="Previous image"><ChevronLeft /></button>}
            <motion.figure key={selected.id} initial={{ opacity: 0, scale: .96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .35 }} onClick={event => event.stopPropagation()}>
              <img src={selected.imageUrl || ''} alt={selected.title || 'HAVESTORY studio work'} decoding="async" />
              <figcaption><span>{selected.category || 'Studio work'}</span><strong>{selected.title || `Story ${(selectedIndex || 0) + 1}`}</strong><small>{(selectedIndex || 0) + 1} / {portfolioItems.length}</small></figcaption>
            </motion.figure>
            {portfolioItems.length > 1 && <button type="button" className="hs-gallery-next" onClick={event => { event.stopPropagation(); move(1); }} aria-label="Next image"><ChevronRight /></button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
