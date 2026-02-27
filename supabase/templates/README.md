# FastGRC Email Templates

Professional HTML email templates for all Supabase Auth transactional emails.

## Design Principles

- **Single-column, max 560px** — renders correctly on all clients
- **System font stack** — no web font dependencies
- **FastGRC blue (#2563eb)** — consistent brand color on header bar and CTA button
- **Plain inline CSS** — compatible with Gmail, Outlook, Apple Mail
- **No images** — fully text-based, never blocked by image filters

---

## How to Apply

Go to your Supabase project → **Authentication → Email Templates**

Paste the HTML content (not the file path) into each template:

| Template File | Supabase Template Name | Used For |
|---|---|---|
| `invite.html` | **Invite user** | Team member invitations sent from Settings → Team |
| `confirmation.html` | **Confirm signup** | New user email verification after registration |
| `magic_link.html` | **Magic Link** | Passwordless sign-in link + OTP code |
| `recovery.html` | **Reset Password** | Password reset requests |

---

## Supabase Template Variables

These variables are automatically replaced by Supabase when sending emails:

| Variable | Description |
|---|---|
| `{{ .ConfirmationURL }}` | The full action URL (confirm, reset, invite accept, magic link) |
| `{{ .Token }}` | The 6-digit OTP code (used in magic_link.html) |
| `{{ .TokenHash }}` | Hashed token for direct verification |
| `{{ .SiteURL }}` | Your site URL (set in Supabase → Authentication → URL Configuration) |
| `{{ .Email }}` | Recipient's email address |
| `{{ .RedirectTo }}` | The redirect URL configured for the auth flow |

---

## Subject Lines to Configure

In Supabase dashboard, set these subject lines alongside the templates:

| Template | Subject Line |
|---|---|
| Invite user | `You've been invited to FastGRC` |
| Confirm signup | `Confirm your FastGRC account` |
| Magic Link | `Your FastGRC sign-in link` |
| Reset Password | `Reset your FastGRC password` |

---

## Important: Invite Template Redirect

The invite template uses `{{ .ConfirmationURL }}` which routes through Supabase's auth server and then redirects to our app. The redirect URL is configured in the invite API route (`src/app/api/team/invite/route.ts`) as:

```
${APP_URL}/auth/invite-callback
```

Ensure `https://yourapp.com/auth/invite-callback` is added to **Authentication → URL Configuration → Redirect URLs** in your Supabase dashboard.
