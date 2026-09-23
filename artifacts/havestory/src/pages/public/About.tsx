import { useGetSettings } from '@workspace/api-client-react';
import { Heart, ScanLine, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

export default function About() {
  const { data: settings } = useGetSettings();

  return (
    <div className="hsx-page hsx-about-page">
      <header className="hsx-about-hero hsx-about-hero-clean">
        <div className="hsx-about-hero-copy">
          <span className="hsx-about-eyebrow">About HAVESTORY</span>
          <h1>We make photographs feel at home.</h1>
          <p>
            {settings?.aboutStory ||
              'HAVESTORY is a colour lab and frame studio built around one simple idea: the photographs that matter should be made beautifully, and made to last.'}
          </p>
        </div>
        <div className="hsx-about-hero-note" aria-hidden="true">
          <span>Thoughtful objects</span>
          <span>For meaningful walls</span>
        </div>
      </header>

      <section className="hsx-about-intro hsx-about-intro-clean">
        <span>Our point of view</span>
        <blockquote>“A frame should never compete with the story. It should give it a place to stay.”</blockquote>
        <p>We combine careful colour, considered proportions and dependable making. Whether it is one family photograph or a complete gallery wall, every piece gets the same attention.</p>
      </section>

      <section className="hsx-values hsx-values-clean">
        <article><ScanLine /><span>01</span><h2>Clarity first</h2><p>Clear options, honest recommendations and a process that never feels complicated.</p></article>
        <article><Heart /><span>02</span><h2>Made personally</h2><p>We listen to the story, space and purpose before deciding the final format.</p></article>
        <article><Sparkles /><span>03</span><h2>Quiet quality</h2><p>Colour, crop, material and finish are checked as one complete piece.</p></article>
      </section>

      {(settings?.aboutMission || settings?.aboutVision) && <section className="hsx-about-mission hsx-about-mission-clean">
        {settings.aboutMission && <div><span>Mission</span><h2>{settings.aboutMission}</h2></div>}
        {settings.aboutVision && <div><span>Vision</span><h2>{settings.aboutVision}</h2></div>}
      </section>}

      <section className="hsx-page-cta hsx-about-cta">
        <div><span>Come with an idea</span><h2>Leave with something<br />worth keeping.</h2></div>
        <div><p>Tell us the size, image and finish you have in mind.</p><Link href="/custom-project" className="hsx-btn hsx-btn-dark">Request a custom frame <ArrowRight size={16} /></Link></div>
      </section>
    </div>
  );
}
