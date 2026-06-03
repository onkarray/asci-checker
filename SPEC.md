# ASCI Ad Compliance Checker — Full Technical Spec

## What This Is
A web tool where brands, agencies, and creators upload any ad format
(text, image, carousel, video) and get an ASCI compliance score with
specific violation callouts and fix suggestions. Lead gen happens via
email gate before the full report is revealed.

---

## Tech Stack

Frontend + Backend: Next.js 14 (App Router)
Database:           Supabase (Postgres)
Email:              Resend
File handling:      Browser-side only (no server storage of ad content)
Video processing:   FFmpeg via @ffmpeg/ffmpeg (WASM, runs in browser)
Transcription:      Whisper API (OpenAI) or Gemini native video
Styling:            Tailwind CSS + shadcn/ui
Hosting:            Vercel
Payments:           None (free tool, BYOK)

---

## Core Principle
The ad file NEVER touches our server.
All LLM API calls are made from the browser using the user's own API key.
We only receive and store the metadata JSON after analysis is complete.

---

## Folder Structure

/app
  /page.tsx                  ← Landing page
  /check
    /page.tsx                ← Main tool page
  /report
    /[id]/page.tsx           ← Full report page (post email gate)
  /api
    /leads/route.ts          ← Stores metadata to Supabase
    /send-report/route.ts    ← Sends full report email via Resend

/components
  /upload/
    AdUploader.tsx           ← Handles all input formats
    VideoProcessor.tsx       ← FFmpeg frame extraction + transcription
  /analysis/
    AnalysisRunner.tsx       ← Routes to correct LLM provider
    ProviderRouter.ts        ← Detects provider from API key
  /results/
    TeaserCard.tsx           ← Score + 2 violations (pre-email gate)
    EmailGate.tsx            ← Email capture form
    FullReport.tsx           ← Complete report (post-email gate)
    ScoreGauge.tsx           ← Visual score display
    ViolationCard.tsx        ← Individual violation with fix
  /providers/
    ClaudeProvider.ts
    OpenAIProvider.ts
    GeminiProvider.ts

/prompts
  system.txt
  analysis_request.txt
  metadata_extract.txt
  email_templates.txt

/lib
  supabase.ts
  resend.ts
  pdf-generator.ts          ← Generates downloadable PDF report

---

## Page 1: Landing Page (/app/page.tsx)

HERO SECTION:
- Headline: "Is your ad ASCI compliant?"
- Subheadline: "Check your ad against India's advertising rulebook before
  it gets flagged. Free. Takes 60 seconds."
- CTA button: "Check My Ad"
- Trust signals below CTA:
  - "Your ad stays on your device — we never store your creative"
  - "Backed by ASCI's official code + 2 years of complaints data"
  - "Works with Claude, GPT-4o, or Gemini — use your own API key"

SOCIAL PROOF BAR:
- "98% of ads reviewed by ASCI in 2024-25 required modification"
- "76% of India's top 100 digital creators violated ASCI guidelines"
- "100% of green claim ads failed ASCI scrutiny last year"

HOW IT WORKS (3 steps):
1. Upload your ad (text, image, carousel, or video)
2. Get your compliance score in 60 seconds
3. Download your fix report

FOOTER:
- "This tool is not affiliated with ASCI. It applies ASCI's publicly
  available code and guidelines to help advertisers self-review."

---

## Page 2: Main Tool (/app/check/page.tsx)

STEP 1 — API KEY INPUT
Component: ApiKeyInput
- Text input: "Paste your API key"
  Placeholder: "sk-ant-... or sk-... or AIza..."
- Helper text: "Your key is stored only in your browser. Never sent to
  our servers. Used only to call the AI model for analysis."
- Key stored in: localStorage as 'asci_api_key'
- Provider auto-detected from key prefix:
  - 'sk-ant' → Claude (Anthropic)
  - 'sk-'    → OpenAI (GPT-4o)
  - 'AIza'   → Gemini
- Show detected provider name + logo after key is entered
- Link: "Get a free API key" (links to respective provider signup)
- For video uploads: if provider is Claude or OpenAI, show info tooltip:
  "Tip: Gemini processes video natively and gives better results for video ads."

---

STEP 2 — AD DETAILS
Component: AdDetailsForm

Fields:
- Ad Format (required, select):
  Text/Script | Single Image | Carousel | Video

- Primary Category (required, select):
  Personal Care | Healthcare / Supplements | Food & Beverages |
  Education / EdTech | Real Estate | Finance / Investment |
  Crypto / NFTs | Fashion & Lifestyle | Automotive | Other

- Content Type (required, select):
  Brand Ad | Influencer Post | Brand Ad featuring Influencer

- Platform (required, select):
  Instagram | YouTube | Facebook | LinkedIn | Twitter/X |
  TV | Print | Outdoor/OOH | Website | Other

---

STEP 3 — AD CONTENT UPLOAD
Component: AdUploader

Render different upload UI based on Format selected:

FORMAT = TEXT:
  - Large textarea
  - Placeholder: "Paste your ad script, caption, or copy here..."
  - Character counter

FORMAT = SINGLE IMAGE:
  - Drag and drop zone
  - Accepts: jpg, png, webp, gif
  - Max size: 10MB
  - Preview shown after upload
  - File stored in browser memory only, never uploaded to server

FORMAT = CAROUSEL:
  - Multi-image upload zone, up to 10 images
  - Drag to reorder frames
  - Frame number shown on each thumbnail
  - Preview strip shown below upload zone
  - Note shown: "We'll analyze each frame + the full sequence together"

FORMAT = VIDEO:
  Component: VideoProcessor

  - Drag and drop zone
  - Accepts: mp4, mov, avi, webm
  - Max size: 500MB

  On file select, run in browser:

  IF provider = Gemini:
    - Show: "Gemini will process your video natively"
    - No preprocessing needed
    - File converted to base64 in browser
    - Sent directly to Gemini Files API

  IF provider = Claude or OpenAI:
    - Show processing indicator: "Extracting keyframes and audio..."

    FRAME EXTRACTION (FFmpeg WASM):
    - Load FFmpeg WASM (@ffmpeg/ffmpeg)
    - Extract frames at scene changes (threshold: 0.3)
    - Always extract: frames 0-3s (disclosure check), last 5s (disclaimer check)
    - Max 20 frames total
    - Resize to 1280px max width to reduce token cost
    - Output: array of JPEG base64 strings

    TRANSCRIPTION:
    - Extract audio track via FFmpeg
    - Send audio to Whisper API (if OpenAI key) or Gemini audio endpoint (if Gemini key)
    - Output: transcript with timestamps

    - Show: "X frames extracted, transcript ready"

---

STEP 4 — RUN ANALYSIS BUTTON
- Button: "Check My Ad"
- Disabled until: API key entered + category selected + content uploaded
- On click: trigger AnalysisRunner

---

## Analysis Runner (AnalysisRunner.tsx)

FLOW:
1. Build the prompt:
   - Load system.txt
   - Load analysis_request.txt
   - Inject: format, sector, content_type, platform, ad content
   - For carousel: include all frames with frame number labels
   - For video (Claude/OpenAI): include transcript + frame descriptions

2. Route to provider (ProviderRouter.ts):

   IF Claude (sk-ant):
     Model: claude-sonnet-4-5
     Endpoint: https://api.anthropic.com/v1/messages
     Content: text + images (base64) in messages array
     Headers: x-api-key, anthropic-version, content-type
     Max tokens: 4096

   IF OpenAI (sk-):
     Model: gpt-4o
     Endpoint: https://api.openai.com/v1/chat/completions
     Content: text + image_url (base64 data URLs) in messages array
     Headers: Authorization: Bearer {key}
     Max tokens: 4096

   IF Gemini (AIza):
     Model: gemini-1.5-pro
     Endpoint: https://generativelanguage.googleapis.com/v1beta/models/
               gemini-1.5-pro:generateContent?key={key}
     Content: text + inlineData (base64) or fileData (for native video)
     For video: use Files API first, then reference in request
     Max tokens: 4096

3. Show loading state:
   - Animated progress bar (fake progress, 0 to 90% over ~20 seconds)
   - Rotating status messages:
     "Reading your ad copy..."
     "Checking claim substantiation rules..."
     "Reviewing disclosure compliance..."
     "Applying sector-specific guidelines..."
     "Calculating your compliance score..."

4. Parse JSON response
5. Store full analysis in browser sessionStorage as 'asci_analysis'
6. Render TeaserCard

---

## Results Flow

TEASER (shown immediately, no email required):
Component: TeaserCard

Shows:
- Large score gauge (e.g. 61/100) with color coding:
  80-100: green
  60-79: amber
  0-59: red
  AUTO_FAIL: red with escalation badge

- Verdict badge: COMPLIANT / NEEDS REVISION / NON-COMPLIANT / AUTO-FAIL

- teaser_summary text (2 sentences from LLM)

- Category score breakdown (5 bars):
  Each bar shows category name + score
  Bars are visible but fix details text is blurred/locked

- Top 2 HIGH severity violations:
  - Rule reference shown
  - offending_element shown
  - why_its_a_violation shown
  - fix_suggestion: BLURRED with overlay "Unlock full report"

- Sticky bottom bar:
  "Get your complete fix report — free"
  "Enter your email" button that scrolls to EmailGate

---

EMAIL GATE:
Component: EmailGate

Fields:
- First name (required)
- Work email (required)
- Company name (optional)
- Role (optional, select): Brand Manager | Agency | Creator/Influencer |
  Founder | Marketing Lead | Other

Submit button: "Send me the full report"

On submit:
1. POST to /api/leads with metadata payload
2. POST to /api/send-report with email + full analysis JSON
3. Unlock FullReport component in UI immediately
4. Show: "Report sent to [email]"

Privacy note below form:
"We never store your ad. Only your score and violation summary are saved
to send you relevant resources. No spam — unsubscribe anytime."

---

FULL REPORT (unlocked after email):
Component: FullReport

Shows:
- Everything in TeaserCard (now unblurred)
- ALL violations with complete fix_suggestion
- compliant_elements section: "What you got right"
- full_summary paragraph
- "Download PDF Report" button
- "Check another ad" button

---

## PDF Report (pdf-generator.ts)

Generate client-side using jsPDF.

Page 1 — Summary:
- "ASCI Compliance Report" header
- Ad category, platform, date checked
- Score gauge
- Verdict
- full_summary text
- Category score table

Page 2+ — Violations:
- One violation per section
- Rule reference
- Offending element (quoted)
- Why it's a violation
- Fix suggestion

Last page — Compliant elements:
- "What your ad got right"
- List of compliant_elements

Footer on every page:
"Generated by [Tool Name] | [date] | This report applies ASCI's publicly
available code. It is not an official ASCI certification."

---

## API Routes

POST /api/leads
Body:
{
  "email": string,
  "name": string,
  "company": string | null,
  "role": string | null,
  "metadata": {
    "ad_category": string,
    "ad_format": string,
    "platform": string,
    "overall_score": number,
    "verdict": string,
    "auto_fail": boolean,
    "escalation_required": boolean,
    "violation_modules": string[],
    "high_severity_count": number,
    "medium_severity_count": number,
    "low_severity_count": number,
    "top_violation_rule": string,
    "provider_used": string
  }
}
Action: Insert to Supabase 'leads' table
Response: { success: true, lead_id: uuid }

---

POST /api/send-report
Body:
{
  "email": string,
  "name": string,
  "analysis": <full analysis JSON>
}
Action: Send email via Resend using report template
Response: { success: true }

---

## Supabase Schema

Table: leads
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid()
  created_at      timestamptz DEFAULT now()
  email           text        NOT NULL
  name            text
  company         text
  role            text
  ad_category     text
  ad_format       text
  platform        text
  overall_score   integer
  verdict         text
  auto_fail       boolean     DEFAULT false
  escalation_req  boolean     DEFAULT false
  violation_mods  text[]
  high_count      integer
  medium_count    integer
  low_count       integer
  top_violation   text
  provider_used   text
  report_sent     boolean     DEFAULT false

Index on: email, ad_category, verdict, created_at

---

## Report Email Template (Resend)

Subject: "Your ASCI Compliance Report — [score]/100"

Body:
- "Hi [name],"
- Score + verdict in large text
- full_summary paragraph
- If NEEDS_REVISION or NON_COMPLIANT:
  "Here are your top violations to fix:"
  List of violations (rule reference + fix_suggestion)
- If COMPLIANT:
  "Your ad looks good. Here's what you did right:"
  List of compliant_elements
- PDF report attached
- CTA: "Check another ad"
- Footer: unsubscribe link

FOLLOW-UP EMAIL (send 3 days later):
Personalized by violation_modules — use templates from prompts/email_templates.txt

---

## Environment Variables (.env.local)

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=

Note: LLM API keys are NEVER stored as env vars.
They live in the user's localStorage only.

---

## Privacy & Legal Copy (include on site)

- "Your ad is analyzed entirely in your browser using your own API key.
   We never receive or store your ad content."
- "This tool applies ASCI's publicly available Code for Self-Regulation
   and is not affiliated with or endorsed by ASCI."
- "A compliance score from this tool does not guarantee ASCI approval.
   For official pre-publication advice, use ASCI's Ad Advice Service."
- Standard privacy policy: what data is collected (email, score, metadata),
  how it's used (report delivery, relevant follow-up), unsubscribe option.

---

## Build Order for Claude Code

Execute these steps in order. Complete each fully before moving to the next.

1.  Set up Next.js 14 with App Router + Tailwind CSS + shadcn/ui
2.  Install dependencies: @ffmpeg/ffmpeg, jspdf, @supabase/supabase-js, resend
3.  Build ProviderRouter.ts — API key detection + API call logic for all 3 providers (Claude, OpenAI, Gemini)
4.  Build AdUploader.tsx — all 4 format handlers (text, image, carousel, video)
5.  Build VideoProcessor.tsx — FFmpeg WASM frame extraction + audio transcription
6.  Load prompts from /prompts directory — inject variables into analysis_request.txt template
7.  Build AnalysisRunner.tsx — full analysis flow end to end
8.  Build TeaserCard + ScoreGauge + ViolationCard components
9.  Build EmailGate component + POST /api/leads + Supabase insert
10. Build FullReport + POST /api/send-report + Resend email with PDF attachment
11. Build PDF generator (pdf-generator.ts) using jsPDF
12. Build landing page (/app/page.tsx)
13. Set up .env.local with all environment variables
14. Vercel deploy configuration (vercel.json if needed)
