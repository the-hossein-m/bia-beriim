# Bia Beriim — Project Progress

## Overview
A Farsi web app that lets someone create a personalized "ask-out" invite link for their crush.
The crush fills out a fun quiz (vibe, mood, date, time), and the sender gets notified via SMS.

## Live URLs
| Environment | URL | Branch |
|---|---|---|
| Production | https://bia-beriim.vercel.app | `main` |
| Dev/Preview | https://bia-beriim-git-dev-the-hossein.vercel.app | `dev` |

## Stack
- **Frontend:** Vanilla HTML/CSS/JS (two static files)
- **Backend:** Vercel Serverless Functions (Node.js)
- **Database:** Supabase (PostgreSQL)
- **SMS:** Kavenegar (blocked — see below)
- **Repo:** https://github.com/the-hossein-m/bia-beriim

---

## File Structure
```
/
├── setup.html          # Sender's page: enter names + verify phone → get invite link
├── bia-beriim.html     # Crush's page: animated quiz → submit preferences
├── vercel.json         # Routing config
├── PROGRESS.md         # This file
└── api/
    ├── send-otp.js     # POST /api/send-otp    — generate & send OTP
    ├── verify-otp.js   # POST /api/verify-otp  — verify OTP, create sender record
    └── send-result.js  # POST /api/send-result — SMS sender with crush's answers
```

---

## User Flow
1. **Sender** opens `setup.html`
   - Enters their name + crush's name
   - Enters their phone number → receives OTP
   - Verifies OTP → gets a shareable invite link
   - Link format: `/invite?from=Ali&to=Sara&sid=<uuid>`

2. **Crush** opens the invite link (`bia-beriim.html`)
   - Sees animated "ask-out" page with running "No" button
   - Fills 3-question quiz: vibe / mood / date+time
   - On submit → preferences saved to Supabase + SMS sent to sender

---

## Supabase Tables

### `senders`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key, auto-generated |
| from_name | text | |
| to_name | text | |
| phone | text | Normalized (98XXXXXXXXXX) |
| verified | boolean | True after OTP confirmed |
| created_at | timestamptz | |

### `otp_sessions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| phone | text | |
| code | text | 6-digit OTP |
| expires_at | timestamptz | 5 min from creation |
| used | boolean | Marked true after verification |
| created_at | timestamptz | |

### `responses`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| from_name | text | |
| to_name | text | |
| answer | text | Always "آره" |
| vibe | text | e.g. "کافه ☕" |
| mood | text | e.g. "ریلکس 😌" |
| proposed_date | text | Jalali date string |
| proposed_time | text | e.g. "شب 🌙" |
| created_at | timestamptz | |

---

## Environment Variables (Vercel)
| Key | Where to get it | Status |
|---|---|---|
| `KAVENEGAR_API_KEY` | Kavenegar panel → تنظیمات → کلید API | ✅ Set |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role | ⚠️ Needs verification |

---

## SMS Status — BLOCKED ⚠️

### Provider: Kavenegar
- **Account type:** Trial ("سرویس پیشرفته آزمایشی")
- **Line:** `0018018949161` — International Shared SMS, Active
- **Error:** `412 — ارسال کننده نامعتبر است` (Invalid sender)
- **Root cause:** Trial account requires KYC verification to activate sending
- **KYC status:** Not completed (complex process)

### Current Workaround (Dev Mode)
In the `dev` branch, `NODE_ENV` is not set to `production`, so `send-otp.js` skips Kavenegar and returns the OTP directly in the API response:
```json
{ "success": true, "dev_code": "123456" }
```
The code is also displayed on screen in the UI for easy copy-paste.

### To Enable Real SMS (Production)
1. Complete Kavenegar KYC **or** switch to alternative provider (see below)
2. Set `NODE_ENV=production` in Vercel → Environment Variables (Production only)
3. Deploy `dev` → `main`

---

## Alternative SMS Solutions (To Explore)
- [ ] **Alternative provider** — TBD by Hossein
- [ ] Twilio (international, easy setup, no KYC for basic use)
- [ ] Direct Kavenegar KYC completion

---

## Deployment Workflow
```bash
# Work on dev branch
git checkout dev
# ... make changes ...
git add -A && git commit -m "your message" && git push
# → Auto-deploys to preview URL

# When ready for production
git checkout main
git merge dev
git push
# → Auto-deploys to bia-beriim.vercel.app
```

---

## Known Issues / TODO
- [ ] `SUPABASE_SERVICE_KEY` may not be set correctly in Vercel (caused RLS error, fixed with open policies as workaround)
- [ ] SMS not working in production (KYC required)
- [ ] `send-result.js` (notify sender) not tested end-to-end yet
- [ ] No rate limiting on OTP endpoint
- [ ] No auth on setup page (anyone can create invite links)
