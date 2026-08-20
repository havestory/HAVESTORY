import { useGetSettings } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ArrowRight, CheckCircle2, Heart, ScanLine, Sparkles } from 'lucide-react';

export default function About() {
  const { data: settings } = useGetSettings();
  const founded = settings?.aboutFoundedYear || '2020';
  return (
    <div className="hsx-page hsx-about-page">
      <header className="hsx-about-hero">
        <div><span>About HAVESTORY</span><h1>We make photographs<br />feel at home.</h1><p>{settings?.aboutStory || 'HAVESTORY is a colour lab and frame studio built around one simple idea: the photographs that matter should be made beautifully, and made to last.'}</p></div>
        <figure>{settings?.aboutImage ? <img src={settings.aboutImage} alt={`${settings.businessName || 'HAVESTORY'} studio`} /> : <img src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1400&q=86" alt="Framing studio interior" />}<figcaption>Studio practice / Since {founded}</figcaption></figure>
      </header>
      <section className="hsx-about-intro"><span>Our point of view</span><blockquote>“A frame should never compete with the story. It should give it a place to stay.”</blockquote><p>We combine careful colour, considered proportions and dependable making. Whether it is one family photograph or a complete gallery wall, every piece gets the same attention.</p></section>
      <section className="hsx-values">
        <article><ScanLine /><span>01</span><h2>Clarity first</h2><p>Clear options, honest recommendations and a process that never feels complicated.</p></article>
        <article><Heart /><span>02</span><h2>Made personally</h2><p>We listen to the story, space and purpose before deciding the final format.</p></article>
        <article><Sparkles /><span>03</span><h2>Quiet quality</h2><p>Colour, crop, material and finish are checked as one complete piece.</p></article>
      </section>
      <section className="hsx-about-mission"><div><span>Mission</span><h2>{settings?.aboutMission || 'To make thoughtful, lasting frames and prints accessible through clear guidance and careful craft.'}</h2></div><div><span>Vision</span><h2>{settings?.aboutVision || 'To become Sri Lanka’s most trusted modern home for photographs, stories and framed work.'}</h2></div></section>
      <section className="hsx-about-proof"><div><strong>{founded}</strong><span>Studio founded</span></div><div><strong>{settings?.ordersCompletedCount || 1200}+</strong><span>Pieces completed</span></div><div><strong>{settings?.happyClientsPercent || 98}%</strong><span>Happy clients</span></div><div><strong>{settings?.starRating || 5}.0</strong><span>Studio rating</span></div></section>
      <section className="hsx-page-cta"><div><span>Come with an idea</span><h2>Leave with something<br />worth keeping.</h2></div><div><p><CheckCircle2 /> Personal guidance from first image to final frame.</p><Link href="/custom-project" className="hsx-btn hsx-btn-dark">Start a project <ArrowRight /></Link></div></section>
    </div>
  );
}
