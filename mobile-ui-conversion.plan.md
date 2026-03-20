# Mobile UI/UX Conversion Strategy

## Overview
The goal of this task is to optimize the `void-cloud/dashboard/app/page.tsx` landing page for mobile traffic. Since the core product is a desktop application, mobile users currently face friction when presented with a direct `.exe` or `.dmg` download button. We need to conditionally render different Call-To-Action (CTA) sections based on the user's device viewport.

## Dependencies (Already Built)
- `void-cloud/dashboard/app/api/send-install-link/route.ts` -- POST endpoint that accepts `{ email }` and sends the branded install link email via Resend.
- `void-cloud/dashboard/lib/resend.ts` -- Resend client singleton.
- `void-cloud/dashboard/lib/email-templates.ts` -- HTML email templates.
- `void-cloud/dashboard/lib/rate-limit.ts` -- In-memory rate limiter (3 req/IP/hour).

## Objectives
1.  Keep the existing "Download SafeAppeals" button for desktop users (`md` screens and larger).
2.  Hide the direct download button for mobile users (`< md` screens).
3.  Introduce a new mobile-specific CTA section that focuses on lead capture and account creation.
4.  Implement a "Send me the install link" email capture form component.
5.  Implement a "Create Free Account" button that routes to `/login`.

## Files to Create/Modify

### 1. Create the Email Capture Component
- **File:** `void-cloud/dashboard/components/MobileEmailCapture.tsx` (Create new)
- **Requirements:**
  - A `'use client'` component.
  - A simple form with an `<input type="email" placeholder="Enter your email">` and a submit button labeled "Send Install Link".
  - State management using `useState`: `email` (string), `isLoading` (boolean), `isSuccess` (boolean), `error` (string | null).
  - On submit, POST to `/api/send-install-link` with `{ email }`.
  - Handle all responses: `200` shows success, `429` shows rate limit message, `400`/`500` shows error.
  - Success state: Replace the form with a green check icon + "Link sent! Check your inbox." message.
  - Styling: Use existing Tailwind classes matching the landing page dark theme -- `bg-dark-card`, `border-dark-border`, `text-brand-400`, `bg-brand-600`, etc.
  - Use `Mail` and `Loader2` icons from `lucide-react` for the button states.

### 2. Update the Landing Page Hero Section
- **File:** `void-cloud/dashboard/app/page.tsx`
- **There are 4 download-related CTAs on this page that need mobile alternatives:**

#### 2a. Hero Section CTA (around line 240-250)
The primary "Download SafeAppeals" button + "See How It Works" button.
- **Desktop (keep as-is):** Wrap in `hidden md:flex flex-col items-center gap-2`.
- **Mobile (new):** Add a `flex md:hidden flex-col items-center gap-4 w-full max-w-md` container with:
  - `<MobileEmailCapture />` component.
  - A divider: `<span class="text-gray-500 text-sm">or</span>`
  - A "Create Free Account" button linking to `/login`.
  - The "See How It Works" button (keep visible on both).

#### 2b. Mobile Hamburger Menu Download Button (around line 188-198)
Inside the `{isMobileMenuOpen && ...}` drawer, there's a "Download" link to `/downloads`.
- **Change:** Replace with an inline text like "Email me the install link" that triggers a simple version of the email capture (or just link to `#hero` to scroll up to the form).

#### 2c. Bottom CTA Section (around line 535-542)
"Ready to stop copy-pasting between apps?" section with another "Download SafeAppeals" button.
- **Desktop:** Wrap in `hidden md:inline-flex`.
- **Mobile:** Add a `md:hidden` version of `<MobileEmailCapture />` or a "Get the Install Link" button that scrolls to the hero form.

#### 2d. Pricing Cards "Get Started" Buttons (around line 640-648)
The `PricingCard` components link to `/login`. These are fine -- they drive signups, which is desirable on mobile.

### 3. Update the Dashboard Mobile View (Post-Signup Flow)
- **File:** `void-cloud/dashboard/app/dashboard/page.tsx`
- **Location:** Insert immediately after the `{/* Header */}` div (after line 185).
- **Changes:**
  - Add a mobile-only alert banner: `<div className="block md:hidden bg-brand-600/10 border border-brand-500/30 rounded-xl p-5 mb-6">`
  - **Icon:** Use `Monitor` from lucide-react.
  - **Heading:** "Install SafeAppeals on Your Computer"
  - **Copy:** "SafeAppeals is a desktop app. To start working with your documents, install it on your Mac, Windows, or Linux computer."
  - **Button:** "Email Me the Install Link" -- on click, it calls `POST /api/send-install-link` with `{ email: profile.email }`. No email input needed since the user is already authenticated.
  - **States:** Show `Loader2` spinner while sending, then "Link sent! Check your inbox." on success, or error message on failure.
  - The banner should use `profile?.email` which is already available in the component's state.

## Success Criteria
- Desktop users see no change to their experience (direct download button remains).
- Mobile users see an email input field instead of a broken download button.
- Mobile users who sign up and reach the dashboard are prompted to email themselves the link.
- The "See How It Works" button remains visible on all devices.
- Pricing cards continue to link to `/login` on all devices (driving signups).