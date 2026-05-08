# IGY App — MVP v1.1 Release Notes

## Overview

MVP v1.1 transitions IGY from a local prototype to a live, multi-user web application. Users can now sign in with real accounts, see each other's requests in real time, and access the app from any device at **igy-app.web.app**.

## What Changed

### Firebase Authentication (replaces mock login)
- **Google sign-in** — one-tap login with an existing Google account
- **Email/password** — users can create their own account
- **New user onboarding** — first-time users are taken to a "Welcome to IGY!" profile setup screen before accessing the app
- **Why this matters:** Real identity is the foundation for trust in a community help app. Without it, anyone could impersonate anyone.

### Firestore Database (replaces localStorage)
- All data (requests, reviews, community gives, notifications, profiles) now lives in Firebase's cloud database
- **Real-time sync** — when one user posts a request, every other user sees it instantly without refreshing
- **Cross-device** — sign in on your phone or laptop and see the same data
- **Why this matters:** Previously, each browser only saw its own data. Users could not actually help each other. This is the single most critical change for making IGY functional.

### Firebase Hosting (replaces local-only)
- App is live at **https://igy-app.web.app**
- Free tier supports up to 10K monthly active users
- Automatic SSL (secure connection)
- **Why this matters:** Users can now access IGY by clicking a link. No installation required.

### Firestore Security Rules
- Only authenticated users can read or write data
- Users can only edit their own profile
- **Why this matters:** Prevents unauthorized access to user data.

### Need-Based Categories (replaces urgency levels)
- Requests now use purpose-aligned categories instead of urgency:
  - Errand — prescription pickup, grocery run, ride to appointment
  - Favor — a one-off ask that doesn't fit other categories
  - Home Help — a one-off task you can't do right now
  - Check-in — phone call, text, or someone to stop by
- Category is selected first in the form; the rest of the form appears after selection
- Contextual guardrails remind users of appropriate use (e.g., "Errands should be quick — 30 min or less")
- **Why this matters:** Reinforces IGY's mission (genuine need, not convenience) and differentiates from TaskRabbit/Rover.

## Cost

All services used are within Firebase's free Spark plan:
- Auth: unlimited sign-ins
- Firestore: 50K reads / 20K writes per day, 1 GB storage
- Hosting: 10 GB/month bandwidth

**Current monthly cost: $0**

## What's Next (v1.2 candidates)

1. Password reset + email verification
2. Report/block user functionality
3. Privacy policy + terms of service
4. UX polish pass (empty states, validation, error handling)
5. Invite-only system for controlled growth
