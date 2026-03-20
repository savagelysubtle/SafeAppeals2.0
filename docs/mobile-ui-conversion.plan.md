---
name: ""
overview: ""
todos: []
isProject: false
---

# Mobile UI/UX Conversion Strategy

## Overview

The goal of this task is to optimize the `void-cloud/dashboard/app/page.tsx` landing page for mobile traffic. Since the core product is a desktop application, mobile users currently face friction when presented with a direct `.exe` or `.dmg` download button. We need to conditionally render different Call-To-Action (CTA) sections based on the user's device viewport.

## Objectives

1. Keep the existing "Download SafeAppeals" button for desktop users (`md` screens and larger).
2. Hide the direct download button for mobile users (`< md` screens).
3. Introduce a new mobile-specific CTA section that focuses on lead capture and account creation.
4. Implement a "Send me the install link" email capture form component.
5. Implement a "Create Free Account" button that routes to `/login`.

## Implementation Steps

### 1. Create the Email Capture Component

- **File:** `void-cloud/dashboard/components/MobileEmailCapture.tsx` (Create new)
- **Requirements:**
  - A simple form with an `<input type="email">` and a submit button.
  - State management for `email`, `isLoading`, `isSuccess`, and `error`.
  - On submit, it will make a POST request to `/api/send-install-link` (to be built in the Email Infrastructure task).
  - UI should match the dark theme and brand colors of the landing page.
  - Show a clear success message ("Link sent! Check your inbox.") upon successful submission.

### 2. Update the Landing Page Hero Section

- **File:** `void-cloud/dashboard/app/page.tsx`
- **Changes:**
  - Locate the current CTA button group in the Hero section.
  - Wrap the existing "Download SafeAppeals" button in a `hidden md:flex` container so it only shows on desktop.
  - Create a new `flex md:hidden flex-col gap-4` container for the mobile CTAs.
  - Inside the mobile container, add:
    - The new `<MobileEmailCapture />` component.
    - A secondary "Create Free Account" button linking to `/login` with copy like "Or sign up now to secure your credits".

### 3. Update the Dashboard Mobile View (Post-Signup Flow)

- **File:** `void-cloud/dashboard/app/dashboard/page.tsx`
- **Changes:**
  - Add a mobile-only alert banner at the top of the dashboard (`block md:hidden`).
  - **Copy:** "Welcome! To start working with your documents, you need to install the desktop app on your Mac or PC."
  - **Action:** Include a button that says "Email me the install link". When clicked, it should automatically trigger the `/api/send-install-link` endpoint using the authenticated user's email (`profile.email`), bypassing the need for them to type it in again.

## Success Criteria

- Desktop users see no change to their experience (direct download button remains).
- Mobile users see an email input field instead of a broken download button.
- Mobile users who sign up and reach the dashboard are prompted to email themselves the link.
