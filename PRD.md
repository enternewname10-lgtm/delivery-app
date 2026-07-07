# Product Requirements Document
## Delivery Route Optimizer App

**Version:** 1.0  
**Date:** 2026-07-06  
**Status:** Draft

---

## Problem Statement

Delivery drivers and individuals making multiple deliveries currently follow an inefficient process: drive to one address, return to a starting point, check the next address, then drive out again. This back-and-forth wastes significant time and fuel. There is no easy way to batch all stops and find the optimal path through all of them in a single trip.

---

## Goal

Build a cross-platform app that lets a user scan or upload physical receipts, automatically extract the delivery addresses, and then generate the fastest multi-stop route — so every delivery can be completed in a single, optimized trip. The app must feel native on iPhone, iPad, and work on desktop (via web browser) — no searching a website every time.

---

## Users

| Role | Who they are | What they need |
|------|-------------|----------------|
| **Restaurant Owner** | Runs the restaurant, assigns deliveries | See all active drivers, track their location, monitor delivery progress |
| **Delivery Driver** | Employed by or contracted to the restaurant | Scan receipts, get optimized route, navigate to stops |

---

## Core Features

### 1. Authentication & Roles

**What it does:** Secure login system with two distinct roles — Owner and Driver. Each sees a different view of the app.

| Detail | Spec |
|--------|------|
| Auth provider | Firebase Auth (free tier — unlimited users) |
| Login methods | Email + password (v1); Google sign-in (later) |
| Role storage | Firebase Firestore — each user document has a `role` field: `owner` or `driver` |
| Session | Persistent login (stay logged in across app restarts) |

**Owner account:**
- Created manually (or via invite link) — owners are not self-serve in v1
- Can see a dashboard of all drivers linked to their restaurant
- Can see each driver's current location on a map (live)
- Can see each driver's delivery queue and progress (stops completed vs. remaining)
- Cannot edit driver routes

**Driver account:**
- Self-registers or is invited by owner
- Linked to one restaurant (owner) at sign-up
- Sees only their own queue and route
- Location is shared with their linked owner while a route is active

**User flows:**

*Driver sign-up:*
1. Download app → tap "Sign Up as Driver"
2. Enter email + password + restaurant code (provided by owner)
3. Account created, linked to that restaurant

*Owner sign-in:*
1. Open app → tap "Owner Login"
2. Enter email + password
3. Lands on Owner Dashboard

---

### 2. Receipt Ingestion

**What it does:** Accept receipts as photos or file uploads and extract the delivery address from each one.

| Detail | Spec |
|--------|------|
| Input methods | Camera scan (mobile), photo upload, PDF upload |
| Supported formats | JPG, PNG, PDF |
| OCR engine | Cloud-based (e.g., Google Vision API or AWS Textract) |
| Extracted fields | Recipient name, street address, city, state, ZIP |
| Multiple receipts | User can add receipts one at a time; all accumulate into a single delivery queue |

**User flow:**
1. Tap "Add Receipt"
2. Scan with camera or choose from files
3. App extracts address and shows a confirmation card: "Deliver to: [Name] at [Address]"
4. User confirms or manually edits the address
5. Address is added to the delivery queue
6. Repeat for all receipts

---

### 2. Delivery Queue

**What it does:** Show all confirmed addresses in one place before route generation.

- List view of all stops with recipient name and address
- Ability to delete or edit any stop
- Indicator for how many stops are in the queue
- "Start Route" button to trigger route optimization

---

### 3. Route Optimization

**What it does:** Take the full list of addresses and calculate the fastest order to visit all of them, starting from the user's current location (or a manually entered start point).

| Detail | Spec |
|--------|------|
| Algorithm | Google Route Optimization API (handles up to 1,000 stops, real-time traffic aware) |
| Starting point | GPS current location (default) or manually entered address |
| Ending point | Optional — return to start, or end at last delivery |
| Traffic awareness | Real-time traffic via Google Route Optimization API |
| Output | Ordered list of stops with estimated drive time between each |

**User flow:**
1. User taps "Start Route"
2. App calculates optimal stop order
3. App displays the full itinerary: Stop 1 → Stop 2 → Stop 3 ... with ETAs
4. User taps "Navigate" to launch turn-by-turn directions for the full route

---

### 4. Navigation Handoff

**What it does:** Hand the optimized route off to a navigation app.

- Deep-link into the Google Maps app with all stops pre-loaded in optimized order (no SDK required)
- Fallback: Apple Maps or Waze deep-link if Google Maps is not installed
- Note: Google Maps navigation caps at 25 waypoints per trip — sufficient for typical delivery runs

---

## Out of Scope (v1.0)

- Proof of delivery (photos, signatures)
- Customer notifications or delivery tracking links
- Payment processing
- Barcode / QR code scanning
- Multiple restaurants per driver
- Scheduling / time-window constraints per stop
- Owner ability to assign specific deliveries to specific drivers

---

## Platform & Device Support

**Framework:** React Native + Expo

| Platform | How it runs | Notes |
|----------|------------|-------|
| iPhone | Native iOS app | Installed from App Store; camera + GPS fully supported |
| iPad | Same iOS app, wider layout | Sidebar nav + split-pane layout on larger screen |
| Android | Native Android app | Same codebase; can be added later via Google Play |
| Computer (Mac/Windows/Linux) | Web browser (Expo Web) | No install needed; limited camera access via browser |

**Responsive layout rules:**

| Screen size | Layout behavior |
|-------------|----------------|
| Phone (< 768px) | Single-column, bottom tab navigation |
| Tablet / iPad (768px – 1024px) | Side navigation panel + content area side by side |
| Desktop (> 1024px) | Full dashboard layout — owner map + driver list visible simultaneously |

**Distribution:**
- iPhone + iPad → Apple App Store ($99/yr developer fee, one-time setup)
- Android → Google Play Store ($25 one-time fee, optional)
- Computer → No install required; access via web browser URL

**Offline behavior:**
- Delivery queue is cached locally — drivers can view their stops without signal
- Route generation and OCR require an internet connection
- Navigation handoff (Google Maps deep link) works as long as Maps is installed

---

## Technical Architecture (Proposed)

**Mapping & Routing Stack: Free-first, with a clear upgrade path to Google Maps Platform**

```
React Native + Expo (single codebase → iPhone, iPad, Android, Web)
    │
    ├── Firebase Auth          — email/password login, role stored in Firestore
    │       ├── Driver view    — receipt scan, queue, route, navigation
    │       └── Owner view     — driver list, live map, delivery progress
    │
    ├── Camera / File Picker (Expo Camera + ImagePicker)
    │       └── Tesseract.js (on-device OCR, free)
    │               └── Address Parser / Validator
    │
    ├── Firebase Firestore      — delivery queues, driver profiles, restaurant links
    │
    └── Route Engine (free tier)
            ├── Nominatim (OpenStreetMap) — address text → lat/lng (free, 1 req/sec)
            ├── Custom TSP on-device      — nearest neighbor + 2-opt (free, good up to ~20 stops)
            └── Navigation Handoff        — deep link to Google Maps app (always free)
```

**Free stack limits:**

| Function | Free Tool | Limit |
|----------|-----------|-------|
| OCR | Tesseract.js (on-device) | Unlimited |
| Geocoding | Nominatim / OpenStreetMap | 1 req/sec, no bulk |
| Route optimization | Custom TSP (on-device) | Works well up to ~20 stops |
| Map display | Leaflet + OpenStreetMap tiles | Unlimited |
| Navigation handoff | Google Maps app deep link | Always free |

**Upgrade path (when scaling):**

| Free Tool | Upgrade To | Why |
|-----------|-----------|-----|
| Tesseract.js | Google Cloud Vision API | Better accuracy on crumpled/low-light receipts |
| Nominatim | Google Geocoding API | Higher rate limits, bulk support |
| Custom TSP | Google Route Optimization API | Handles 1,000+ stops, real-time traffic |
| Leaflet + OSM | Google Maps SDK | Richer map UI, live traffic layer |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Address extraction accuracy | ≥ 90% of receipts parsed correctly without manual correction |
| Route generation time | < 5 seconds for up to 20 stops |
| Time saved per delivery run | ≥ 30% reduction vs. unoptimized order |
| User retention (week 2) | ≥ 40% |

---

## Milestones

| Phase | Deliverables | Goal |
|-------|-------------|------|
| **Phase 1 — Auth** | Firebase Auth, Driver + Owner roles, restaurant code linking | Drivers and owners can log in and see the right view |
| **Phase 2 — Core** | Receipt scan → address extraction → delivery queue | Drivers can build a stop list from receipts |
| **Phase 3 — Routing** | Route optimization + navigation handoff | Drivers can complete all deliveries in one optimized trip |
| **Phase 4 — Owner Dashboard** | Live driver location, delivery progress view | Owners can monitor drivers in real time |
| **Phase 5 — Polish** | Error handling, manual address entry, edit/delete stops, onboarding | Production-ready experience |

---

## Open Questions

1. Should the app store past delivery runs for history / analytics?
2. How does an owner account get created — manual setup only in v1, or a self-serve "Create Restaurant" flow?
3. Should driver location sharing turn off automatically when the route is completed, or only when they manually stop it?
4. Do we need to handle time-window constraints (e.g., "deliver between 2–5 PM") in a later version?
