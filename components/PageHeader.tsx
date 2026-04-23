export default function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-10">
      <div className="font-mono text-[11px] tracking-[0.4em] text-gold-500 uppercase mb-3">{eyebrow}</div>
      <h1 className="font-display text-6xl md:text-7xl text-white tracking-[0.04em] leading-[0.95]">
        {title}
      </h1>
      {description ? (
        <p className="font-serif text-lg text-ink-600 max-w-2xl mt-5 leading-relaxed text-white/50">
          {description}
        </p>
      ) : null}
      <div className="hero-rule mt-8" />
    </div>
  );
}
