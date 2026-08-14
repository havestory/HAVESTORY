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
    <div className={`coming-soon-card relative overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--card))] ${compact ? 'px-6 py-10' : 'px-8 py-16 md:px-14 md:py-20'}`}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[hsl(var(--secondary)/0.1)] blur-3xl" />
      <div className="relative mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[hsl(var(--secondary)/0.35)] bg-[hsl(var(--secondary)/0.08)] text-[hsl(var(--secondary))]">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="section-label mb-3">{eyebrow}</p>
        <h2 className="font-serif text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] md:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))] md:text-base">{description}</p>
        {href && cta && (
          <Link href={href} className="mt-7 inline-flex items-center gap-2 bg-[hsl(var(--primary))] px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5">
            {cta} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
