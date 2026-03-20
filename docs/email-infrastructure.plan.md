---
name: ""
overview: ""
todos: []
isProject: false
---

# Email Infrastructure Strategy

## Overview

The goal of this task is to build the backend infrastructure required to send transactional emails from the Next.js application. This includes sending the requested installation links to mobile users and automatically sending a "Welcome" email when a new user signs up via Supabase OAuth.

## Objectives

1. Integrate a transactional email provider (e.g., Resend) into the Next.js app.
2. Create an API route to handle manual "Send Install Link" requests from the landing page and dashboard.
3. Set up an automated trigger (via Supabase Webhooks or Edge Functions) to send a Welcome email upon new user registration.
4. Design clean, branded HTML email templates for both scenarios.

## Implementation Steps

### 1. Provider Setup & Configuration

- **Action:** Choose an email provider (Resend is highly recommended for Next.js).
- **Tasks:**
  - Install the necessary SDK (e.g., `npm install resend`).
  - Add the API key to `.env` (e.g., `RESEND_API_KEY=re_...`).
  - Verify the sending domain (`safeappeals.com`) in the provider's dashboard.

### 2. Build the "Send Install Link" API Route

- **File:** `void-cloud/dashboard/app/api/send-install-link/route.ts` (Create new)
- **Requirements:**
  - Accept a POST request containing an `email` address in the body.
  - Validate the email format.
  - Construct the email payload using the provider's SDK.
  - **Email Content:**
    - Subject: "Your SafeAppeals Desktop Install Link"
    - Body: A brief message providing the direct link to the `/downloads` page (e.g., `https://safeappeals.com/downloads`), ensuring the links stay current.
  - Return appropriate HTTP status codes (200 for success, 400/500 for errors).

### 3. Implement the Welcome Email Automation

- **Approach:** Use Supabase Database Webhooks (or Edge Functions) triggered on `INSERT` to the `auth.users` or `public.profiles` table.
- **Tasks:**
  - **Option A (Next.js API Route):** Create a new route `app/api/webhooks/welcome-email/route.ts`. Configure Supabase to send a POST request to this URL whenever a new user is created.
  - **Option B (Supabase Edge Function):** Write a Deno Edge function in Supabase that listens to the auth trigger and sends the email directly.
  - **Email Content:**
    - Subject: "Welcome to SafeAppeals!"
    - Body: Thank them for joining. Provide links to:
      - The `/downloads` page for the desktop app.
      - The Documentation (`/docs`).
      - The YouTube tutorial channel.

### 4. Email Template Design

- **Action:** Create reusable React components for the email layouts (using a library like `react-email` or plain HTML strings if keeping it simple).
- **Requirements:**
  - Include the SafeAppeals logo.
  - Use brand colors (dark theme styling if possible, or clean light theme).
  - Clear, prominent Call-To-Action buttons (e.g., "Go to Downloads Page").

## Success Criteria

- Submitting an email on the mobile landing page successfully delivers the install link email within seconds.
- Signing up for a new account via Google OAuth automatically triggers the Welcome email.
- Emails do not land in the spam folder (requires proper domain verification).
- The install link email directs users to the `/downloads` page rather than hardcoded file URLs.
