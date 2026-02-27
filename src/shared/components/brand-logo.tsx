interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span className={className} style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
      <span style={{ color: "hsl(var(--primary))" }}>fast</span>
      <span style={{ color: "#94a3b8" }}>grc.ai</span>
    </span>
  );
}
