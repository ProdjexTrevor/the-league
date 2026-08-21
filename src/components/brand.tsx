import Link from "next/link";

type BrandProps = {
  href?: string | null;
  size?: "sm" | "lg" | "hero";
  className?: string;
};

const sizes = {
  sm: "text-2xl",
  lg: "text-4xl sm:text-5xl",
  hero: "text-[clamp(2.75rem,11vw,5.5rem)] leading-[0.9]",
};

export function Brand({ href = "/", size = "sm", className = "" }: BrandProps) {
  const mark = (
    <span className={`font-display tracking-[0.04em] ${sizes[size]} ${className}`}>
      <span className="text-fg">THE </span>
      <span className="text-accent">LEAGUE</span>
    </span>
  );
  if (href === null) return mark;
  return (
    <Link href={href} className="inline-block">
      {mark}
    </Link>
  );
}

export function BrandPill({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
      {children}
    </p>
  );
}
