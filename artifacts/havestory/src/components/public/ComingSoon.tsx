import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'wouter';

type ComingSoonProps = {
  eyebrow?: string;
  title: string;
  description: string;
  href?: string;
  cta?: string;
  compact?: boolean;
};

export function ComingSoon({
  eyebrow = 'A new chapter is taking shape',
  title,
  description,
  href,
  cta,
  compact = false,
}: ComingSoonProps) {
  return (
    <div className={`coming-soon-card ${compact ? 'is-compact' : ''}`}>
      <div className="coming-soon-content">
        <div className="coming-soon-icon">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="section-label">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        {href && cta && (
          <Link href={href} className="coming-soon-action">
            {cta} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
