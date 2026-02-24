"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Shield, ArrowRight, Search, Copy, CheckCircle, ExternalLink } from "lucide-react";
import { COPILOT_PROMPTS, PROMPT_CATEGORIES, type PromptCategory } from "@/features/copilot/data/prompts";

export default function PromptsPage() {
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return COPILOT_PROMPTS.filter((p) => {
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const handleCopy = (prompt: string, id: string) => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: COPILOT_PROMPTS.length };
    for (const p of COPILOT_PROMPTS) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">Aegis GRC</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Get started free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="border-b border-border/40 bg-muted/30 px-6 py-16 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span>✨</span>
            {COPILOT_PROMPTS.length} ready-to-use prompts
          </div>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight md:text-5xl">
            Copilot Prompt Library
          </h1>
          <p className="text-lg text-muted-foreground">
            Copy any prompt into the GRC Copilot to instantly manage risks, track compliance, collect
            evidence, and connect your tools — no forms required.
          </p>
          <div className="mt-8 relative mx-auto max-w-lg">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts by keyword, category, or tag…"
              className="w-full rounded-xl border bg-background py-3 pl-11 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar — category filter */}
          <aside className="shrink-0 lg:w-56">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Categories
            </p>
            <ul className="space-y-1">
              {PROMPT_CATEGORIES.map((cat) => (
                <li key={cat}>
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                      selectedCategory === cat
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs ${
                        selectedCategory === cat
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {categoryCounts[cat] ?? 0}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold">Try it in Aegis</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Copy a prompt, open the Copilot panel, and paste it in. No setup needed.
              </p>
              <Link
                href="/login"
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Open Copilot <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>

          {/* Prompt grid */}
          <main className="flex-1">
            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-muted-foreground">No prompts found for &ldquo;{searchQuery}&rdquo;</p>
                <button
                  onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }}
                  className="mt-3 text-sm text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <p className="mb-5 text-sm text-muted-foreground">
                  {filtered.length} prompt{filtered.length !== 1 ? "s" : ""}
                  {selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}
                  {searchQuery ? ` matching "${searchQuery}"` : ""}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((p) => (
                    <PromptCard
                      key={p.id}
                      prompt={p}
                      copied={copiedId === p.id}
                      onCopy={() => handleCopy(p.prompt, p.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* Footer CTA */}
      <section className="border-t border-border/40 bg-muted/30 px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-2xl font-bold">Ready to automate your GRC program?</h2>
          <p className="mb-6 text-muted-foreground">
            These prompts work instantly in Aegis GRC. Sign up free and run your first prompt in
            under a minute.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Start free — no credit card needed <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function PromptCard({
  prompt,
  copied,
  onCopy,
}: {
  prompt: (typeof COPILOT_PROMPTS)[number];
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Category badge */}
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <span>{prompt.categoryIcon}</span>
          {prompt.category}
        </span>
      </div>

      {/* Title */}
      <h3 className="mb-2 text-sm font-semibold leading-snug">{prompt.title}</h3>

      {/* Prompt text */}
      <blockquote className="mb-3 flex-1 rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground italic border-l-2 border-primary/30">
        &ldquo;{prompt.prompt}&rdquo;
      </blockquote>

      {/* Outcome */}
      <p className="mb-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Result: </span>
        {prompt.outcome}
      </p>

      {/* Tags */}
      <div className="mb-4 flex flex-wrap gap-1">
        {prompt.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCopy}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
            copied
              ? "bg-green-500/10 text-green-600 border border-green-500/20"
              : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
          }`}
        >
          {copied ? (
            <>
              <CheckCircle className="h-3.5 w-3.5" /> Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy prompt
            </>
          )}
        </button>
        <Link
          href="/login"
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Try in Aegis"
        >
          <ExternalLink className="h-3 w-3" /> Try
        </Link>
      </div>
    </div>
  );
}
