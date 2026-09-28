import { useGetSettings } from '@workspace/api-client-react';
import { Heart, ScanLine, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { Reveal, Stagger, StaggerItem } from '@/components/public/Reveal';

const VALUES = [
  {
    icon: ScanLine,
    num: '01',
    title: 'Clarity first',
    copy: 'Clear options, honest recommendations and a process that never feels complicated.',
  },
  {
    icon: Heart,
    num: '02',
    title: 'Made personally',
    copy: 'We listen to the story, space and purpose before deciding the final format.',
  },
  {
    icon: Sparkles,
    num: '03',
    title: 'Quiet quality',
    copy: 'Colour, crop, material and finish are checked as one complete piece.',
  },
];

const STATS = [
  { num: '12+', label: 'Years of craft' },
  { num: '25k+', label: 'Frames made & finished' },
  { num: '100%', label: 'Colour-checked by hand' },
];

export default function About() {
  const { data: settings } = useGetSettings();

  return (
    <div className="hv-page">
      {/* Hero */}
      <header className="hv-page-hero">
        <div className="hv-container">
          <span className="hv-kicker">About Havestory</span>
          <h1 className="hv-display hv-display-lg">
            We make photographs <em>feel at home.</em>
          </h1>
          <p className="hv-lede">
            {settings?.aboutStory ||
              'HAVESTORY is a colour lab and frame studio built around one simple idea: the photographs that matter should be made beautifully, and made to last.'}
          </p>
        </div>
        <div className="hv-hero-ornament" aria-hidden="true" />
      </header>

      {/* Editorial story */}
      <section className="hv-section">
        <div className="hv-container">
          <div className="grid items-start gap-12 md:grid-cols-2 md:gap-16">
            <Reveal>
              <span className="hv-kicker">Our point of view</span>
              <h2 className="hv-display hv-display-md mt-4">
                Thoughtful objects, <em>for meaningful walls.</em>
              </h2>
              <p className="hv-lede mt-6">
                We combine careful colour, considered proportions and dependable making.
                Whether it is one family photograph or a complete gallery wall, every
                piece gets the same attention.
              </p>
            </Reveal>
            <Reveal delay={0.12} className="md:pt-10">
              <blockquote className="border-l-2 border-[#b07c3a] pl-8">
                <p className="hv-display hv-display-sm italic leading-snug">
                  “A frame should never compete with the story. It should give it a
                  place to stay.”
                </p>
                <cite className="hv-kicker mt-6 not-italic">The Havestory studio</cite>
              </blockquote>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="hv-section-tight border-y border-[rgba(23,19,16,0.07)] bg-[#f1e9da]">
        <div className="hv-container">
          <Stagger className="grid gap-10 text-center sm:grid-cols-3">
            {STATS.map((s) => (
              <StaggerItem key={s.label}>
                <div className="hv-stat-num">{s.num}</div>
                <div className="hv-stat-label">{s.label}</div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Values */}
      <section className="hv-section">
        <div className="hv-container">
          <Reveal className="hv-section-head">
            <div>
              <span className="hv-kicker">What we hold to</span>
              <h2 className="hv-display hv-display-md">Three quiet promises</h2>
            </div>
          </Reveal>
          <Stagger className="grid gap-6 md:grid-cols-3">
            {VALUES.map((v) => (
              <StaggerItem key={v.num}>
                <article className="hv-card hv-card-hover h-full p-8">
                  <div className="flex items-start justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(176,124,58,0.12)] text-[#8a5f28]">
                      <v.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-[Fraunces] text-lg font-semibold text-[#a89a8c]">{v.num}</span>
                  </div>
                  <h3 className="hv-display hv-display-sm mt-6">{v.title}</h3>
                  <p className="mt-3 leading-relaxed text-[#6f6259]">{v.copy}</p>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Mission / vision (settings-driven) */}
      {(settings?.aboutMission || settings?.aboutVision) && (
        <section className="hv-section-tight">
          <div className="hv-container">
            <Stagger className="grid gap-6 md:grid-cols-2">
              {settings.aboutMission && (
                <StaggerItem>
                  <div className="hv-card h-full p-8 md:p-10">
                    <span className="hv-kicker">Mission</span>
                    <p className="hv-display hv-display-sm mt-4 leading-snug">{settings.aboutMission}</p>
                  </div>
                </StaggerItem>
              )}
              {settings.aboutVision && (
                <StaggerItem>
                  <div className="hv-card h-full p-8 md:p-10">
                    <span className="hv-kicker">Vision</span>
                    <p className="hv-display hv-display-sm mt-4 leading-snug">{settings.aboutVision}</p>
                  </div>
                </StaggerItem>
              )}
            </Stagger>
          </div>
        </section>
      )}

      {/* Dark CTA */}
      <section className="hv-dark hv-grain relative">
        <div className="hv-container hv-section">
          <Reveal className="max-w-3xl">
            <span className="hv-kicker">Come with an idea</span>
            <h2 className="hv-display hv-display-lg mt-4">
              Leave with something <em>worth keeping.</em>
            </h2>
            <p className="hv-lede mt-6">Tell us the size, image and finish you have in mind.</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/contact" className="hv-btn hv-btn-bronze">
                Start a conversation <ArrowRight aria-hidden="true" />
              </Link>
              <Link href="/custom-project" className="hv-btn hv-btn-outline-light">
                Request a custom frame
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
