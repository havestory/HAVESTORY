import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Image as ImageIcon,
  PackageCheck,
  Palette,
  Quote,
  Ruler,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import {
  useGetNotices,
  useGetSettings,
  useListPortfolio,
  useListProducts,
  useListReviews,
  useListServices,
} from "@workspace/api-client-react";
import { ComingSoon } from "@/components/public/ComingSoon";

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1600&q=88",
  "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1000&q=86",
  "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1000&q=86",
];

function SectionHead({
  eyebrow,
  title,
  copy,
  href,
  link,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  href?: string;
  link?: string;
}) {
  return (
    <header className="hsc-section-head">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        {copy && <p>{copy}</p>}
      </div>
      {href && (
        <Link href={href}>
          {link || "View all"} <ArrowRight />
        </Link>
      )}
    </header>
  );
}

export default function Home() {
  const { data: settings } = useGetSettings();
  const { data: products } = useListProducts();
  const { data: services } = useListServices();
  const { data: notices } = useGetNotices();
  const { data: portfolio } = useListPortfolio();
  const { data: reviews } = useListReviews();
  const [dismissedNotices, setDismissedNotices] = useState<number[]>([]);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  const activeNotices = (Array.isArray(notices) ? notices : []).filter(
    (item) => item.enabled && !dismissedNotices.includes(item.id),
  );
  const productList = (Array.isArray(products) ? products : [])
    .filter((item) => item.featured)
    .slice(0, 6);
  const serviceList = (Array.isArray(services) ? services : []).slice(0, 4);
  const portfolioList = (Array.isArray(portfolio) ? portfolio : []).slice(0, 6);
  const reviewList = (Array.isArray(reviews) ? reviews : [])
    .filter((item) => item.approved)
    .slice(0, 3);
  let slideEnabled = Array(10).fill(true) as boolean[];
  try {
    const savedEnabled = (settings as any)?.heroSlideEnabled;
    const parsed =
      typeof savedEnabled === "string"
        ? JSON.parse(savedEnabled)
        : savedEnabled;
    if (Array.isArray(parsed)) {
      slideEnabled = Array.from(
        { length: 10 },
        (_, index) => parsed[index] !== false,
      );
    }
  } catch {
    // Existing sites publish all configured images by default.
  }
  const configuredHeroSlideSlots = Array.from(
    { length: 10 },
    (_, index) =>
      (settings as any)?.[`heroSlideImage${index + 1}`] as string | undefined,
  );
  const configuredHeroSlides = configuredHeroSlideSlots.filter(
    (image, index): image is string => Boolean(image && slideEnabled[index]),
  );
  const hasConfiguredHeroSlides = configuredHeroSlideSlots.some(Boolean);
  const heroSlides = hasConfiguredHeroSlides
    ? configuredHeroSlides
    : [settings?.heroBgImage || DEFAULT_IMAGES[0]];
  const heroSlidesKey = heroSlides.join("|");
  const safeActiveHeroSlide = heroSlides.length
    ? activeHeroSlide % heroSlides.length
    : 0;
  const activeHeroImage = heroSlides[safeActiveHeroSlide];
  const heroImages = [
    heroSlides[0] || DEFAULT_IMAGES[0],
    heroSlides[1] || DEFAULT_IMAGES[1],
    heroSlides[2] || DEFAULT_IMAGES[2],
  ];
  const benefits = [
    { label: "Colour checked", Icon: Palette },
    { label: "Made to measure", Icon: Ruler },
    { label: "Securely packed", Icon: PackageCheck },
    { label: "Island-wide delivery", Icon: Truck },
  ];
  const categories = [
    {
      title: "Custom Frames",
      copy: "Made to your photograph and space.",
      href: "/store",
      image: heroImages[1],
      tone: "plum",
    },
    {
      title: "Fine Art Prints",
      copy: "Colour-managed, crisp and lasting.",
      href: "/store",
      image: heroImages[2],
      tone: "gold",
    },
    {
      title: "Personal Gifts",
      copy: "Meaningful pieces for every occasion.",
      href: "/custom-project",
      image: portfolioList[0]?.imageUrl || heroImages[0],
      tone: "ink",
    },
  ];

  useEffect(() => {
    setActiveHeroSlide(0);
  }, [heroSlidesKey]);

  useEffect(() => {
    if (heroSlides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [heroSlides.length, heroSlidesKey]);

  return (
    <div className="hsc-home">
      <AnimatePresence>
        {activeNotices.map((notice) => (
          <motion.div
            key={notice.id}
            className="hsc-notice"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <span>{notice.message}</span>
            <button
              type="button"
              onClick={() =>
                setDismissedNotices((items) => [...items, notice.id])
              }
              aria-label="Dismiss notice"
            >
              <X />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      <section className="hsc-hero">
        <motion.div
          className="hsc-hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <span className="hsc-pill">
            <Sparkles />{" "}
            {settings?.heroBadgeText || "Photo studio · Print lab · Frame shop"}
          </span>
          <h1>
            {settings?.heroTitle ||
              "Frame the Moments That Stay"}
          </h1>
          <p>
            {settings?.heroSubtitle ||
              "Premium photo prints, custom frames and personal pieces—created with expert guidance and delivered across Sri Lanka."}
          </p>
          <div className="hsc-hero-actions">
            <Link
              href={settings?.heroCtaLink || "/store"}
              className="hsc-btn hsc-btn-primary"
            >
              {settings?.heroCtaText || "Explore the shop"} <ArrowRight />
            </Link>
            <Link href="/custom-project" className="hsc-btn hsc-btn-ghost">
              Create something custom
            </Link>
          </div>
        </motion.div>
        <motion.div
          className="hsc-hero-media"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7 }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {activeHeroImage && (
              <motion.img
                key={`${safeActiveHeroSlide}-${activeHeroImage}`}
                src={activeHeroImage}
                alt={`HAVESTORY featured studio work ${safeActiveHeroSlide + 1}`}
                initial={{ opacity: 0, x: 70, scale: 1.04 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -55, scale: 1.015 }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </AnimatePresence>
          <span className="hsc-hero-tag">Crafted in Sri Lanka</span>
          {heroSlides.length > 1 && (
            <div className="hsc-hero-dots" aria-label="Choose featured image">
              {heroSlides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Show image ${index + 1}`}
                  aria-current={index === safeActiveHeroSlide}
                  onClick={() => setActiveHeroSlide(index)}
                />
              ))}
            </div>
          )}
        </motion.div>
      </section>
      <div className="hsc-benefits" aria-label="HAVESTORY service benefits">
        <div className="hsc-benefits-track">
          {[0, 1].map((group) => (
            <div
              key={group}
              className="hsc-benefits-group"
              aria-hidden={group === 1}
            >
              {benefits.map(({ label, Icon }) => (
                <span key={`${group}-${label}`}>
                  <Icon /> {label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <section className="hsc-section">
        <SectionHead
          eyebrow="Shop by story"
          title="Find the right way to frame it."
          copy="Three simple starting points. Our studio will help with every detail after that."
        />
        <div className="hsc-category-grid">
          {categories.map((item, index) => (
            <motion.article
              key={item.title}
              className={`hsc-category hsc-category-${item.tone}`}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: index * 0.06 }}
            >
              <Link href={item.href}>
                <div>
                  <span>0{index + 1}</span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                  <i>
                    Discover <ArrowRight />
                  </i>
                </div>
                <img src={item.image} alt="" />
              </Link>
            </motion.article>
          ))}
        </div>
      </section>
      <section className="hsc-section hsc-products-section">
        <SectionHead
          eyebrow="Popular now"
          title="Studio favourites."
          copy="Ready-to-order editions selected for gifting, home and everyday memories."
          href="/store"
          link="Shop everything"
        />
        {productList.length ? (
          <div className={`hsc-product-grid ${productList.length === 1 ? "hsc-product-grid-single" : ""}`}>
            {productList.map((product, index) => (
              <motion.article
                key={product.id}
                className={`hsc-product-card ${productList.length === 1 ? "hsc-product-card-featured" : ""}`}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (index % 3) * 0.05 }}
              >
                <Link href={`/store/${product.id}`} className="hsc-product-image">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} />
                  ) : (
                    <ImageIcon />
                  )}
                  <span>{index === 0 ? "Popular" : "Studio pick"}</span>
                </Link>
                <div>
                  <small>{product.category?.name || "HAVESTORY edition"}</small>
                  <h3>{product.name}</h3>
                  <p>
                    {product.description ||
                      "Made with carefully selected materials in our studio."}
                  </p>
                  <footer>
                    <strong>
                      {product.price
                        ? `Rs. ${Number(product.price).toLocaleString()}`
                        : "Quote on request"}
                    </strong>
                    <Link href={`/store/${product.id}`}>
                      View edition <ArrowRight />
                    </Link>
                  </footer>
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
          <ComingSoon
            eyebrow="Collection in progress"
            title="New pieces are on the way."
            description="The shop is being prepared, but custom orders are open now."
            href="/custom-project"
            cta="Start a custom order"
          />
        )}
      </section>
      <section className="hsc-how">
        <div className="hsc-how-intro">
          <span>Easy from start to finish</span>
          <h2>
            Your photo.
            <br />
            Our craft.
          </h2>
          <p>
            No technical frame calculator. No confusing specifications. Send the
            memory and we will guide the material, crop, finish and size.
          </p>
          <Link href="/custom-project" className="hsc-btn hsc-btn-gold">
            Start your project <ArrowRight />
          </Link>
        </div>
        <ol>
          {[
            [
              "01",
              "Share your idea",
              "Upload the photo and tell us where it will live.",
            ],
            [
              "02",
              "Choose together",
              "We help select size, paper, finish and frame.",
            ],
            [
              "03",
              "Approve the details",
              "Receive a clear quote before production begins.",
            ],
            [
              "04",
              "Receive it safely",
              "We finish, check, pack and deliver your piece.",
            ],
          ].map((item) => (
            <li key={item[0]}>
              <span>{item[0]}</span>
              <div>
                <h3>{item[1]}</h3>
                <p>{item[2]}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      {portfolioList.length > 0 && (
        <section className="hsc-section hsc-work">
          <SectionHead
            eyebrow="Created at HAVESTORY"
            title="Recent studio work."
            copy="A closer look at frames, prints and personal pieces made for our clients."
            href="/gallery"
            link="Open gallery"
          />
          <div className="hsc-work-grid">
            {portfolioList.map((item, index) => (
              <motion.div
                key={item.id}
                className={`hsc-work-item item-${index + 1}`}
                whileHover={{ y: -6 }}
              >
                <Link href="/gallery">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title || "HAVESTORY studio work"}
                    />
                  ) : (
                    <ImageIcon />
                  )}
                  <span>
                    <strong>{item.title || `Studio story ${index + 1}`}</strong>
                    <i>
                      View project <ArrowRight />
                    </i>
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}
      {serviceList.length > 0 && (
        <section className="hsc-section hsc-services">
          <SectionHead
            eyebrow="Studio services"
            title="More ways to make it yours."
            href="/services"
            link="View all services"
          />
          <div>
            {serviceList.map((service, index) => (
              <Link href="/services" key={service.id}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{service.name}</h3>
                  <p>
                    {service.description ||
                      "Designed and finished with the HAVESTORY studio."}
                  </p>
                </div>
                <ArrowRight />
              </Link>
            ))}
          </div>
        </section>
      )}
      {reviewList.length > 0 && (
        <section className="hsc-section hsc-reviews">
          <SectionHead
            eyebrow="Loved by our clients"
            title="Stories from happy walls."
          />
          <div>
            {reviewList.map((review) => (
              <blockquote key={review.id}>
                <Quote />
                <p>“{review.comment}”</p>
                <footer>
                  <strong>{review.customerName}</strong>
                  <span>{"★".repeat(Math.min(5, review.rating || 5))}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}
      <section className="hsc-final">
        <div>
          <span>Have a photograph in mind?</span>
          <h2>
            Let’s make something
            <br />
            worth keeping.
          </h2>
          <p>Tell us the idea. We will help with the rest.</p>
        </div>
        <div>
          <Link href="/custom-project" className="hsc-btn hsc-btn-gold">
            Start a custom project <ArrowRight />
          </Link>
          <Link href="/contact" className="hsc-btn hsc-btn-dark-outline">
            Talk to the studio
          </Link>
        </div>
      </section>
    </div>
  );
}
