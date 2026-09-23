import { useListServices } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, Image as ImageIcon } from 'lucide-react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

export default function Services() {
  const { data: services, isLoading, isError, refetch } = useListServices();
  const serviceList = Array.isArray(services) ? services : [];
  return (
    <div className="hsx-page hsx-services-page">
      <header className="hsx-page-hero">
        <div><span>Studio services</span><h1>Frames, prints and<br />personal projects.</h1></div>
        <div><p>Tell us what you would like to make. We will help choose the size, material and finish.</p><Link href="/custom-project" className="hsx-text-link">Request a quote <ArrowRight /></Link></div>
      </header>
      <main className="hsx-page-body">
        {isLoading ? <div className="hsx-loading-grid">{[1,2,3,4].map(i => <div key={i} />)}</div>
          : isError ? <div className="hsx-error-state"><h2>Services could not be loaded.</h2><p>Please try this section again.</p><Button onClick={() => void refetch()}>Try again</Button></div>
          : serviceList.length === 0 ? <div className="hsx-error-state"><h2>Tell us about your project.</h2><p>We can discuss a custom frame or print and prepare a quote for your size and finish.</p><Link href="/custom-project" className="hsx-btn hsx-btn-dark">Request a quote <ArrowRight size={16} /></Link></div>
          : <div className="hsx-services-list">{serviceList.map((service, index) => <motion.article key={service.id} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (index % 4) * .06 }}>
              <div className="hsx-service-image">{service.imageUrl ? <img src={service.imageUrl} alt={service.name} loading="lazy" decoding="async" /> : <ImageIcon /> }<span>0{index + 1}</span></div>
              <div className="hsx-service-content"><h2>{service.name}</h2><p>{service.description || ''}</p>
                {Array.isArray(service.highlights) && service.highlights.length > 0 && <ul>{service.highlights.map((item: string, itemIndex: number) => <li key={itemIndex}><Check /> {item}</li>)}</ul>}
                <footer>{service.price ? <div><span>Starting from</span><strong>Rs. {Number(service.price).toLocaleString()}</strong><small>/ {service.priceType}</small></div> : <span>Quote prepared for your project</span>}<Link href={`/contact?subject=Inquiry for ${service.name}`}>Enquire <ArrowRight /></Link></footer>
              </div>
            </motion.article>)}</div>}
      </main>
      {serviceList.length > 0 && <section className="hsx-page-cta"><div><span>Custom request</span><h2>Need a different size<br />or finish?</h2></div><div><p>Send the details and we will prepare a quote.</p><Link href="/custom-project" className="hsx-btn hsx-btn-dark">Request a quote <ArrowRight /></Link></div></section>}
    </div>
  );
}
