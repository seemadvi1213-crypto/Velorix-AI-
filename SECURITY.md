# Security Policy — Velorix AI

## Supported versions

| Version | Supported |
|---------|-----------|
| Latest `main` (production deploy) | Yes |
| Older commits / forks | No |

## API keys & secrets

- **Never commit** API keys (Groq, Gemini, OpenRouter, Replicate, fal, Together, Firebase, Clerk, etc.) to this repository.
- Keys must live only in:
  - Browser local storage / in-app API Center (user/owner device), or
  - Hosting env vars (Vercel) — not in public HTML/JS source.
- If a key was pasted into a file by mistake: **revoke that key immediately** at the provider, then commit a cleaned file.

## Client-side app notes

- Velorix AI is largely a client-side web app. Users should not paste secrets into shared screenshots or public chats.
- Gallery and project data on device are not a substitute for server-side access control when premium/cloud storage is added.

## Reporting a vulnerability

Please **do not** open a public GitHub Issue for security problems.

Report privately:

1. GitHub → **Security** → **Advisories** → Report a vulnerability  
   (or email the repo owner if Advisories are unavailable)

Include:

- What the issue is
- Steps to reproduce
- Impact (e.g. key exposure, account access)
- Your contact (optional)

We aim to acknowledge within **72 hours** and fix critical issues as soon as possible.

## Safe development rules

- No secrets in `create.html`, `home.html`, or any tracked file
- Prefer env vars / API Center for keys
- Rotate keys if they may have leaked
- Keep dependencies and auth providers updated

Thank you for helping keep Velorix AI safe.
