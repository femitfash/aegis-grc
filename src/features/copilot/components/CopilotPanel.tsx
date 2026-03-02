"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COPILOT_PROMPTS, PROMPT_CATEGORIES, type PromptCategory } from "@/features/copilot/data/prompts";
import { BrandLogo } from "@/shared/components/brand-logo";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: CopilotAction[];
  isStreaming?: boolean;
}

interface CopilotAction {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "pending" | "executing" | "executed" | "rejected";
  result?: Record<string, unknown>;
}

interface CopilotPanelProps {
  onClose: () => void;
  context?: { page: string; entityType?: string };
  onFirstMessage?: () => void;
  highlightPrompts?: boolean;
}

// Generate a stable conversation ID per session
function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const CONVERSATION_ID = generateId();

// Map action names → dashboard pages so we can navigate after execution
const ACTION_PAGE_MAP: Record<string, string> = {
  create_risk: "/dashboard/risks",
  update_risk: "/dashboard/risks",
  delete_risk: "/dashboard/risks",
  import_github_alerts: "/dashboard/risks",
  create_control: "/dashboard/controls",
  create_framework: "/dashboard/frameworks",
  create_requirement: "/dashboard/frameworks",
  update_requirement_status: "/dashboard/frameworks",
  create_evidence: "/dashboard/evidence",
  link_risk_to_control: "/dashboard/risks",
};

const SUGGESTION_CHIPS = [
  { label: "Register a risk", prompt: "Register a risk about our S3 buckets being publicly accessible" },
  { label: "SOC 2 readiness", prompt: "What's our current SOC 2 readiness?" },
  { label: "Create a control", prompt: "Create a preventive control for encrypting data at rest using AES-256" },
  { label: "Find controls", prompt: "Find controls for access management" },
  { label: "Log evidence", prompt: "Record evidence that we completed our annual pen test with no critical findings" },
  { label: "High risks", prompt: "Show all high severity risks" },
];

export function CopilotPanel({ onClose, context, onFirstMessage, highlightPrompts }: CopilotPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "**GRC Copilot - AI Assistant**\n\nInstead of clicking through menus or filling out forms, just type what you need in plain English — I'll do the work.\n\nTry clicking a suggestion below, or type your own request:",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const executeAction = useCallback(async (action: CopilotAction, msgId: string) => {
    // Mark as executing
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        actions: m.actions?.map((a) =>
          a.id === action.id ? { ...a, status: "executing" as const } : a
        ),
      }))
    );

    try {
      const res = await fetch("/api/copilot/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolCallId: action.id,
          name: action.name,
          input: action.input,
        }),
      });
      const data = await res.json();

      if (res.status === 401) {
        // Session expired
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            actions: m.actions?.map((a) =>
              a.id === action.id ? { ...a, status: "rejected" as const } : a
            ),
          }))
        );
        const sessionMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: `🔒 **Session expired**\n\nYour session has expired. Please [sign in again](/login) to continue.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, sessionMsg]);
        return;
      }

      if (res.status === 402) {
        // Free tier limit reached — show upgrade prompt
        const limitMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: `🔒 **Free tier limit reached**\n\nYou've used all 10 free AI actions. You can:\n- **Upgrade to Growth** — unlimited AI, all frameworks, Slack/Jira/GitHub (14-day free trial)\n- **Add your own API key** → Settings → AI Copilot → paste your AI API key\n\n[upgrade_button]`,
          timestamp: new Date(),
        };
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            actions: m.actions?.map((a) =>
              a.id === action.id ? { ...a, status: "rejected" as const } : a
            ),
          }))
        );
        setMessages((prev) => [...prev, limitMsg]);
        return;
      }

      if (!res.ok) {
        throw new Error(data.detail || data.error || `Server error ${res.status}`);
      }

      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          actions: m.actions?.map((a) =>
            a.id === action.id
              ? { ...a, status: "executed" as const, result: data.result }
              : a
          ),
        }))
      );

      // Notify other parts of the app that data changed
      if (action.name === "create_risk") {
        window.dispatchEvent(new CustomEvent("grc:risk-created"));
      } else if (action.name === "create_control") {
        window.dispatchEvent(new CustomEvent("grc:control-created"));
      } else if (action.name === "create_framework") {
        window.dispatchEvent(new CustomEvent("grc:framework-created"));
      } else if (action.name === "update_requirement_status") {
        window.dispatchEvent(new CustomEvent("grc:requirement-status-updated"));
      } else if (action.name === "create_requirement") {
        window.dispatchEvent(new CustomEvent("grc:requirement-created"));
      } else if (action.name === "link_risk_to_control") {
        window.dispatchEvent(new CustomEvent("grc:risk-controls-updated"));
        window.dispatchEvent(new CustomEvent("grc:risk-created")); // refresh risk list for residual scores
      } else if (action.name === "create_evidence") {
        window.dispatchEvent(new CustomEvent("grc:evidence-created"));
      } else if (action.name === "connect_integration") {
        window.dispatchEvent(new CustomEvent("grc:integration-updated"));
      } else if (action.name === "import_github_alerts") {
        window.dispatchEvent(new CustomEvent("grc:risk-created")); // refresh risk list
      }

      // Add a follow-up message
      const entityName =
        action.name === "create_risk" ? "risk" :
        action.name === "create_control" ? "control" :
        action.name === "update_requirement_status" ? "requirement status" :
        action.name === "create_requirement" ? "requirement" :
        action.name === "link_risk_to_control" ? "risk-control link" :
        action.name === "create_evidence" ? "evidence record" :
        action.name === "connect_integration" ? "integration" :
        action.name === "import_github_alerts" ? "GitHub alerts" :
        action.name === "create_jira_issue" ? "Jira issue" :
        action.name === "send_slack_notification" ? "Slack notification" :
        action.name.replace(/_/g, " ");
      const targetPage = ACTION_PAGE_MAP[action.name];
      const successMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: `✅ Done! The ${entityName} has been saved to your register.${targetPage ? " Navigating you there now..." : " The list will update automatically."}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, successMsg]);

      // Navigate to the relevant page so the user can see what was added
      if (targetPage && context?.page !== targetPage) {
        setTimeout(() => router.push(targetPage), 600);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          actions: m.actions?.map((a) =>
            a.id === action.id ? { ...a, status: "rejected" as const } : a
          ),
        }))
      );
      // Show error to user
      const failMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: `❌ Failed to save: ${errMsg}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, failMsg]);
    }
    void msgId;
  }, []);

  const rejectAction = useCallback((actionId: string) => {
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        actions: m.actions?.map((a) =>
          a.id === actionId ? { ...a, status: "rejected" as const } : a
        ),
      }))
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const sentInput = input;
    setInput("");
    setIsLoading(true);

    // Notify parent on first user message (for onboarding dismissal)
    if (onFirstMessage && messages.length === 1 && messages[0].id === "welcome") {
      onFirstMessage();
    }

    // Create a placeholder assistant message for streaming
    const assistantMsgId = generateId();
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Build history from completed messages (exclude welcome, exclude current placeholder)
      const history = messages
        .filter((m) => m.id !== "welcome" && !m.isStreaming && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: sentInput,
          conversationId: CONVERSATION_ID,
          context,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "text") {
              fullText += data.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: fullText, isStreaming: true }
                    : m
                )
              );
            } else if (data.type === "done") {
              // Finalize message with pending actions
              const actions: CopilotAction[] = (data.pendingActions || []).map(
                (pa: { id: string; name: string; input: Record<string, unknown> }) => ({
                  id: pa.id,
                  name: pa.name,
                  input: pa.input,
                  status: "pending" as const,
                })
              );
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, isStreaming: false, actions: actions.length > 0 ? actions : undefined }
                    : m
                )
              );
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    } catch (error) {
      console.error("Copilot error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: "Sorry, I encountered an error. Please try again.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="w-96 border-l bg-card flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-primary/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
            AI
          </div>
          <div>
            <span className="font-semibold text-sm">GRC Copilot</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPrompts(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-border/60"
            title="Browse popular prompts"
          >
            ✨ Prompts
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close copilot"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                }`}
              >
                <MarkdownText
                  text={message.content}
                  isUser={message.role === "user"}
                  isStreaming={message.isStreaming}
                  onSuggestClick={(prompt: string) => {
                    setInput(prompt);
                    inputRef.current?.focus();
                  }}
                />
              </div>
            </div>

            {/* Action Cards */}
            {message.actions?.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onApprove={() => executeAction(action, message.id)}
                onReject={() => rejectAction(action.id)}
              />
            ))}
          </div>
        ))}

        {/* Suggestion chips — shown only when conversation hasn't started */}
        {messages.length === 1 && messages[0].id === "welcome" && !isLoading && (
          <div className="flex flex-wrap gap-2 px-1">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => {
                  setInput(chip.prompt);
                  inputRef.current?.focus();
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  highlightPrompts
                    ? "border-primary bg-primary/15 text-primary hover:bg-primary/25 hover:border-primary/80 shadow-sm shadow-primary/20 animate-pulse"
                    : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/40"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about GRC..."
            className="flex-1 px-4 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors hover:bg-primary/90"
          >
            ↑
          </button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          <BrandLogo /> Copilot
        </p>
      </div>

      {/* Prompts Overlay */}
      {showPrompts && (
        <PromptsOverlay
          onClose={() => setShowPrompts(false)}
          onSelect={(prompt) => {
            setInput(prompt);
            setShowPrompts(false);
            inputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

// Simple markdown renderer for copilot messages
function MarkdownText({
  text,
  isUser,
  isStreaming,
  onSuggestClick,
}: {
  text: string;
  isUser: boolean;
  isStreaming?: boolean;
  onSuggestClick?: (prompt: string) => void;
}) {
  if (!text && isStreaming) {
    return (
      <div className="flex gap-1 items-center py-1">
        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    );
  }

  // Process markdown-like formatting
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith("### ")) {
      elements.push(
        <p key={i} className="font-semibold text-sm mt-1">
          {renderInline(line.slice(4), isUser)}
        </p>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <p key={i} className="font-bold text-sm mt-1">
          {renderInline(line.slice(3), isUser)}
        </p>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 text-sm">
          <span className="opacity-60 mt-0.5">•</span>
          <span>{renderInline(line.slice(2), isUser)}</span>
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.+)/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2 text-sm">
            <span className="opacity-60 font-medium min-w-[16px]">{match[1]}.</span>
            <span>{renderInline(match[2], isUser)}</span>
          </div>
        );
      }
    } else if (/^\[suggest:.*\].*\[\/suggest\]$/.test(line.trim())) {
      const suggestMatch = line.trim().match(/^\[suggest:(.*?)\](.*?)\[\/suggest\]$/);
      if (suggestMatch && onSuggestClick) {
        const suggestPrompt = suggestMatch[1];
        const suggestLabel = suggestMatch[2];
        elements.push(
          <button
            key={i}
            onClick={() => onSuggestClick(suggestPrompt)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 mt-1 rounded-lg border border-primary/30 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/15 hover:border-primary/50 transition-colors"
          >
            <span className="shrink-0">&#x2192;</span>
            <span>{suggestLabel}</span>
          </button>
        );
      }
    } else if (line.trim() === "[upgrade_button]") {
      elements.push(
        <div key={i} className="mt-2">
          <Link
            href="/dashboard/settings?tab=billing"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
          >
            Upgrade to Growth →
          </Link>
        </div>
      );
    } else if (line === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed">
          {renderInline(line, isUser)}
        </p>
      );
    }
  });

  return (
    <div className="space-y-0.5">
      {elements}
      {isStreaming && <span className="inline-block w-0.5 h-3.5 bg-current opacity-70 animate-pulse ml-0.5 align-middle" />}
    </div>
  );
}

function renderInline(text: string, isUser: boolean): React.ReactNode {
  // Handle **bold**, `code`, and [links](url)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className={`px-1 py-0.5 rounded text-xs font-mono ${
            isUser ? "bg-white/20" : "bg-background border"
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          className="underline opacity-80 hover:opacity-100"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

function ActionCard({
  action,
  onApprove,
  onReject,
}: {
  action: CopilotAction;
  onApprove: () => void;
  onReject: () => void;
}) {
  const entityLabels: Record<string, string> = {
    create_risk: "Create Risk",
    update_risk: "Update Risk",
    delete_risk: "Delete Risk",
    create_control: "Create Control",
    create_framework: "Create Framework",
    update_requirement_status: "Update Requirement",
    create_requirement: "Add Requirement",
    link_risk_to_control: "Link Control to Risk",
    create_evidence: "Create Evidence",
    connect_integration: "Connect Integration",
    import_github_alerts: "Import GitHub Alerts",
    create_jira_issue: "Create Jira Issue",
    send_slack_notification: "Send Slack Notification",
  };

  if (action.status === "executing") {
    return (
      <div className="mt-2 ml-2 p-3 rounded-xl border bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Executing...</p>
        </div>
      </div>
    );
  }

  if (action.status !== "pending") {
    return (
      <div className="mt-2 ml-2 p-3 rounded-xl border bg-muted/30">
        <p className="text-xs text-muted-foreground">
          {action.status === "executed" ? "✅ Action executed successfully" : "❌ Action rejected"}
        </p>
      </div>
    );
  }

  const input = action.input;
  const score =
    typeof input.inherent_likelihood === "number" &&
    typeof input.inherent_impact === "number"
      ? input.inherent_likelihood * input.inherent_impact
      : null;

  // Determine which fields to show based on action type
  const isRisk = action.name === "create_risk";
  const isControl = action.name === "create_control";
  const isFramework = action.name === "create_framework";
  const isRequirementUpdate = action.name === "update_requirement_status";
  const isRequirementCreate = action.name === "create_requirement";
  const isLinkRiskControl = action.name === "link_risk_to_control";
  const isCreateEvidence = action.name === "create_evidence";
  const isConnectIntegration = action.name === "connect_integration";
  const isImportGithub = action.name === "import_github_alerts";
  const isCreateJira = action.name === "create_jira_issue";
  const isSlackNotify = action.name === "send_slack_notification";

  return (
    <div className="mt-2 ml-2 p-4 rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded">
          {entityLabels[action.name] || action.name}
        </span>
        <span className="text-xs text-muted-foreground">Pending approval</span>
      </div>

      <div className="space-y-1.5 mb-3">
        {/* Risk fields */}
        {isRisk && (
          <>
            {Boolean(input.title) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Title:</span>
                <span className="font-medium">{String(input.title)}</span>
              </div>
            )}
            {Boolean(input.category) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Category:</span>
                <span className="capitalize">{String(input.category)}</span>
              </div>
            )}
            {Boolean(input.inherent_likelihood) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Likelihood:</span>
                <span>{String(input.inherent_likelihood)}/5</span>
              </div>
            )}
            {Boolean(input.inherent_impact) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Impact:</span>
                <span>{String(input.inherent_impact)}/5</span>
              </div>
            )}
            {score !== null && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Risk Score:</span>
                <span
                  className={`font-bold ${
                    score >= 20
                      ? "text-red-600"
                      : score >= 15
                      ? "text-orange-600"
                      : score >= 10
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  {score}/25
                </span>
              </div>
            )}
            {Boolean(input.risk_response) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Response:</span>
                <span className="capitalize">{String(input.risk_response)}</span>
              </div>
            )}
          </>
        )}

        {/* Control fields */}
        {isControl && (
          <>
            {Boolean(input.code) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Code:</span>
                <span className="font-mono font-semibold">{String(input.code)}</span>
              </div>
            )}
            {Boolean(input.title) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Title:</span>
                <span className="font-medium">{String(input.title)}</span>
              </div>
            )}
            {Boolean(input.control_type) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Type:</span>
                <span className="capitalize">{String(input.control_type)}</span>
              </div>
            )}
            {Boolean(input.automation_level) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Automation:</span>
                <span className="capitalize">{String(input.automation_level).replace("-", " ")}</span>
              </div>
            )}
            {Boolean(input.effectiveness_rating) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Effectiveness:</span>
                <span>{String(input.effectiveness_rating)}/5</span>
              </div>
            )}
            {Array.isArray(input.frameworks) && (input.frameworks as string[]).length > 0 && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Frameworks:</span>
                <span>{(input.frameworks as string[]).join(", ")}</span>
              </div>
            )}
          </>
        )}

        {/* Requirement status update fields */}
        {isRequirementUpdate && (
          <>
            {Boolean(input.framework_code) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Framework:</span>
                <span className="font-mono font-semibold">{String(input.framework_code)}</span>
              </div>
            )}
            {Boolean(input.requirement_code) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Requirement:</span>
                <span className="font-mono">{String(input.requirement_code)}</span>
              </div>
            )}
            {Boolean(input.status) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">New Status:</span>
                <span className="capitalize font-medium">{String(input.status).replace("-", " ")}</span>
              </div>
            )}
          </>
        )}

        {/* Requirement creation fields */}
        {isRequirementCreate && (
          <>
            {Boolean(input.framework_code) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Framework:</span>
                <span className="font-mono font-semibold">{String(input.framework_code)}</span>
              </div>
            )}
            {Boolean(input.domain) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Domain:</span>
                <span>{String(input.domain)}</span>
              </div>
            )}
            {Boolean(input.code) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Code:</span>
                <span className="font-mono">{String(input.code)}</span>
              </div>
            )}
            {Boolean(input.title) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Title:</span>
                <span className="font-medium">{String(input.title)}</span>
              </div>
            )}
            {Boolean(input.evidence_required) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Evidence:</span>
                <span>{String(input.evidence_required)} item{Number(input.evidence_required) !== 1 ? "s" : ""} required</span>
              </div>
            )}
          </>
        )}

        {/* Link risk to control fields */}
        {isLinkRiskControl && (
          <>
            {Boolean(input.risk_id) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Risk:</span>
                <span className="font-mono font-semibold">{String(input.risk_id)}</span>
              </div>
            )}
            {Boolean(input.control_id) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Control:</span>
                <span className="font-mono font-semibold">{String(input.control_id)}</span>
              </div>
            )}
            {Boolean(input.notes) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Notes:</span>
                <span className="text-xs">{String(input.notes)}</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              Residual risk score will be recalculated automatically.
            </div>
          </>
        )}

        {/* Create evidence fields */}
        {isCreateEvidence && (
          <>
            {Boolean(input.title) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Title:</span>
                <span className="font-medium">{String(input.title)}</span>
              </div>
            )}
            {Boolean(input.source_type) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Source:</span>
                <span className="capitalize">{String(input.source_type)}</span>
              </div>
            )}
            {Boolean(input.control_code) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Control:</span>
                <span className="font-mono font-semibold">{String(input.control_code)}</span>
              </div>
            )}
            {Boolean(input.source_url) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">URL:</span>
                <a
                  href={String(input.source_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline truncate max-w-[180px]"
                >
                  {String(input.source_url)}
                </a>
              </div>
            )}
            {Array.isArray(input.frameworks) && (input.frameworks as string[]).length > 0 && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Frameworks:</span>
                <span>{(input.frameworks as string[]).join(", ")}</span>
              </div>
            )}
          </>
        )}

        {/* Framework fields */}
        {isFramework && (
          <>
            {Boolean(input.code) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Code:</span>
                <span className="font-mono font-semibold">{String(input.code)}</span>
              </div>
            )}
            {Boolean(input.name) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Name:</span>
                <span className="font-medium">{String(input.name)}</span>
              </div>
            )}
            {Boolean(input.version) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Version:</span>
                <span>{String(input.version)}</span>
              </div>
            )}
            {Boolean(input.description) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Description:</span>
                <span className="text-xs">{String(input.description)}</span>
              </div>
            )}
          </>
        )}

        {/* Connect integration fields */}
        {isConnectIntegration && (
          <>
            {Boolean(input.provider) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Provider:</span>
                <span className="capitalize font-medium">{String(input.provider)}</span>
              </div>
            )}
            {input.config && typeof input.config === "object" && (
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {Object.entries(input.config as Record<string, string>).map(([k, v]) => {
                  const isSensitive = ["token", "secret", "password", "api_key"].some((s) => k.toLowerCase().includes(s));
                  return (
                    <div key={k} className="flex gap-2">
                      <span className="font-mono">{k}:</span>
                      <span>{isSensitive && v.length > 4 ? `••••${v.slice(-4)}` : v}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="text-xs text-amber-600 mt-1">
              ⚠️ Credentials will be stored securely server-side.
            </div>
          </>
        )}

        {/* Import GitHub alerts fields */}
        {isImportGithub && (
          <div className="text-sm text-muted-foreground">
            Fetch open Dependabot security alerts from GitHub and create risks for each finding. Duplicates are skipped automatically.
          </div>
        )}

        {/* Create Jira issue fields */}
        {isCreateJira && (
          <>
            {Boolean(input.summary) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Summary:</span>
                <span className="font-medium">{String(input.summary)}</span>
              </div>
            )}
            {Boolean(input.risk_id) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Risk:</span>
                <span className="font-mono">{String(input.risk_id)}</span>
              </div>
            )}
            {Boolean(input.issue_type) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Type:</span>
                <span>{String(input.issue_type)}</span>
              </div>
            )}
            {Boolean(input.priority) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Priority:</span>
                <span>{String(input.priority)}</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              The Jira issue key will be saved back to the risk record.
            </div>
          </>
        )}

        {/* Send Slack notification fields */}
        {isSlackNotify && (
          <>
            {Boolean(input.message) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Message:</span>
                <span className="text-xs">{String(input.message)}</span>
              </div>
            )}
            {Boolean(input.channel) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Channel:</span>
                <span className="font-mono text-xs">{String(input.channel)}</span>
              </div>
            )}
            {Boolean(input.severity) && (
              <div className="flex text-sm">
                <span className="text-muted-foreground w-24 shrink-0">Severity:</span>
                <span className="capitalize">{String(input.severity)}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          {isRequirementCreate ? "Add Requirement" :
           isLinkRiskControl ? "Link Control" :
           isCreateEvidence ? "Save Evidence" :
           isConnectIntegration ? "Save & Connect" :
           isImportGithub ? "Import Alerts" :
           isCreateJira ? "Create Issue" :
           isSlackNotify ? "Send Notification" :
           "Approve & Create"}
        </button>
        <button
          onClick={onReject}
          className="flex-1 px-3 py-2 rounded-lg text-sm border hover:bg-accent transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// ── Prompts Overlay ──────────────────────────────────────────────────────────
function PromptsOverlay({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (prompt: string) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory>("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return COPILOT_PROMPTS.filter((p) => {
      const matchesCat = selectedCategory === "All" || p.category === selectedCategory;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, search]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="absolute inset-0 z-10 bg-background/95 backdrop-blur-sm flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div>
          <p className="text-sm font-semibold">✨ Popular Prompts</p>
          <p className="text-xs text-muted-foreground">Click a prompt to use it</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/prompts"
            target="_blank"
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            View all →
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b shrink-0">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompts…"
          autoFocus
          className="w-full rounded-lg border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto px-4 py-2 border-b shrink-0 scrollbar-hide">
        {PROMPT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No prompts match your search.</p>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.prompt)}
              className="w-full text-left rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5 group"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs">{p.categoryIcon}</span>
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  {p.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                &ldquo;{p.prompt}&rdquo;
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
