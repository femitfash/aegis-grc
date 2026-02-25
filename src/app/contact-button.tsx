"use client";

import { useState } from "react";
import { X, CheckCircle } from "lucide-react";

interface ContactButtonProps {
  label?: string;
  className?: string;
}

export function ContactButton({ label = "Talk to Sales", className }: ContactButtonProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  function update(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  function close() {
    setOpen(false);
    setTimeout(() => setStatus("idle"), 300);
  }

  const inputCls =
    "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="relative w-full max-w-md rounded-2xl border bg-card shadow-2xl">
            <button
              onClick={close}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {status === "success" ? (
              <div className="flex flex-col items-center py-12 px-8 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">We&apos;ll be in touch soon</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Thanks for reaching out. Someone from our team will contact you within 1 business day.
                </p>
                <button
                  onClick={close}
                  className="mt-6 rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-semibold">Talk to Sales</h3>
                <p className="mt-1 text-sm text-muted-foreground mb-5">
                  Tell us about your team and compliance goals.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Name *</label>
                      <input
                        required
                        value={form.name}
                        onChange={update("name")}
                        className={inputCls}
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Company *</label>
                      <input
                        required
                        value={form.company}
                        onChange={update("company")}
                        className={inputCls}
                        placeholder="Acme Corp"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Work email *</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      className={inputCls}
                      placeholder="jane@acme.com"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Team size</label>
                    <select value={form.teamSize} onChange={update("teamSize")} className={inputCls}>
                      <option value="">Select...</option>
                      <option>1–5</option>
                      <option>6–25</option>
                      <option>26–100</option>
                      <option>100+</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      What are you trying to achieve?
                    </label>
                    <textarea
                      value={form.message}
                      onChange={update("message")}
                      rows={3}
                      className={`${inputCls} resize-none`}
                      placeholder="e.g. SOC 2 audit in 6 months, need SSO, 20 contributors..."
                    />
                  </div>

                  {status === "error" && (
                    <p className="text-xs text-red-600">
                      Something went wrong — please email us at{" "}
                      <a href="mailto:contact@fastgrc.ai" className="underline">contact@fastgrc.ai</a>
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {status === "loading" ? "Sending…" : "Send message"}
                  </button>

                  <p className="text-center text-xs text-muted-foreground">
                    We typically respond within 1 business day.
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
