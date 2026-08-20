import { useListServices } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ComingSoon } from '@/components/public/ComingSoon';
import { ArrowRight, Check, Image as ImageIcon } from 'lucide-react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

export default function Services() {
  const { data: services, isLoading, isError, refetch } = useListServices();
  const serviceList = Array.isArray(services) ? services : [];
  return (
    <div className="hsx-page hsx-services-page">
      <header className="hsx-page-hero">
        <div><span>Studio services</span><h1>Good work starts<br />with a clear process.</h1></div>
        <div><p>Printing, framing, image preparation and studio support—handled carefully, explained simply and shaped around the result you need.</p><Link href="/contact" className="hsx-text-link">Talk to the studio <ArrowRight /></Link></div>
      </header>
      <div className="hsx-service-note"><span>01 / Send the idea</span><span>02 / Review the options</span><span>03 / Approve & make</span><span>04 / Collect or deliver</span></div>
      <main className="hsx-page-body">
        {isLoading ? <div className="hsx-loading-grid">{[1,2,3,4].map(i => <div key={i} />)}</div>
          : isError ? <div className="hsx-error-state"><h2>Services could not be loaded.</h2><p>Please try this section again.</p><Button onClick={() => void refetch()}>Try again</Button></div>
          : serviceList.length === 0 ? <ComingSoon eyebrow="The service menu is being prepared" title="Studio services are coming soon." description="Tell us what you need and we will help plan it personally." href="/contact" cta="Talk to the studio" />
          : <div className="hsx-services-list">{serviceList.map((service, index) => <motion.article key={service.id} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (index % 4) * .06 }}>
              <div className="hsx-service-image">{service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <ImageIcon /> }<span>0{index + 1}</span></div>
              <div className="hsx-service-content"><p>HAVESTORY / SERVICE</p><h2>{service.name}</h2><p>{service.description || 'A specialist studio service, planned and finished with care.'}</p>
                {Array.isArray(service.highlights) && service.highlights.length > 0 && <ul>{service.highlights.map((item: string, itemIndex: number) => <li key={itemIndex}><Check /> {item}</li>)}</ul>}
                <footer>{service.price ? <div><span>Starting from</span><strong>Rs. {Number(service.price).toLocaleString()}</strong><small>/ {service.priceType}</small></div> : <span>Quote prepared for your project</span>}<Link href={`/contact?subject=Inquiry for ${service.name}`}>Enquire <ArrowRight /></Link></footer>
              </div>
            </motion.article>)}</div>}
      </main>
      <section className="hsx-page-cta"><div><span>Not sure which service fits?</span><h2>Start with the result<br />you have in mind.</h2></div><div><p>Share the photo, dimensions or reference. We will recommend the clearest route.</p><Link href="/contact" className="hsx-btn hsx-btn-dark">Ask the studio <ArrowRight /></Link></div></section>
    </div>
  );
}
