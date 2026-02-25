interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span className={className} style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
      <span style={{ color: "hsl(var(--primary))" }}>fast</span>
      <span style={{ color: "hsl(var(--foreground))" }}>grc</span>
      <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.72em" }}>.ai</span>
    </span>
  );
}
