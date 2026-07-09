# RDA — Runner Data Analytics

A personal running tracker: log runs, analyze training trends, set race goals, and generate
tailored training plans. Plain HTML/CSS/JS (no build step, no framework) so it deploys as-is
via GitHub Pages, with Firebase (Firestore + Google sign-in) for cross-device sync between
phone and desktop.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | **Activity** — log a run (large touch-friendly form), view/edit/delete past runs. |
| `analytics.html` | **Analytics** — run type per day, average pace by distance, heart-rate trends, period stats. |
| `progress.html` | **Progress** — set race goals, track progress toward them, generate a training plan per goal. |
| `tools.html` | **Tools** — Yasso 800 calculator, race pace calculator, HR zone calculator, 10k training plan generator. |

Mobile (≤768px) shows a bottom tab bar for Activity / Analytics / Progress. Desktop shows a top
nav with all four pages. Every page sits behind a Google sign-in gate so your data stays yours.

## Architecture

- `css/style.css` — single shared stylesheet (theme variables, components, mobile tab bar, large touch inputs).
- `js/firebase-config.js` — **your Firebase project config goes here** (see setup below).
- `js/firebase-init.js` — initializes the Firebase app, exports `auth`/`db`.
- `js/auth.js` — Google sign-in/out and the `requireAuth()` gate used by every page.
- `js/theme.js` — dark/light theme toggle (persisted to `localStorage`).
- `js/nav.js` — renders the top nav / bottom tab bar into `#app-nav` on each page.
- `js/db.js` — Firestore reads/writes for runs and goals.
- `js/plan-engine.js` — pure, DOM-free training-plan math, shared by `tools.js` and `progress.js`.
- `js/activity.js`, `js/analytics.js`, `js/progress.js`, `js/tools.js` — one controller per page.

### Data model (Firestore)

```
users/{uid}/runs/{runId}
  dateISO, timeOfDay, distanceKm, durationSec, paceSecPerKm (derived),
  hrMax, hrMin, hrAvg, type (easy|long|tempo|interval|race|recovery|other),
  notes, createdAt, updatedAt

users/{uid}/goals/{goalId}
  raceName, distanceKm, targetTimeSec, raceDateISO,
  baselineTimeSec, baselineSource (logged|estimated), archived,
  createdAt, updatedAt
```

## Firebase setup (one-time, ~5 minutes)

The site needs a free Firebase project for sign-in and data storage. This can't be automated —
you'll need to do it once in the Firebase console:

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → give it a name → **Create**.
2. **Build → Authentication → Get started** → under **Sign-in method**, enable **Google** → set a support email → **Save**.
3. **Build → Firestore Database → Create database** → pick a region → start in **production mode**.
4. In **Firestore → Rules**, replace the default rules with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
   then **Publish**.
5. **Project settings** (gear icon) → **General** → under "Your apps," click the **Web (`</>`)** icon → register an app (skip Firebase Hosting) → copy the `firebaseConfig` object shown.
6. Paste that object into [`js/firebase-config.js`](js/firebase-config.js), replacing the placeholder values.
7. **Project settings → Authentication → Settings → Authorized domains** → confirm `<your-username>.github.io` is listed (add it if not) — required for Google sign-in to work once the site is deployed.
8. Config values are safe to commit publicly — they identify the project, not a secret. Access is enforced by the security rules (step 4) and authorized domains (step 7).

Until this is done, every page will show a "Firebase isn't configured yet" message instead of
the sign-in screen.

## Local development

Because the pages use ES modules, they must be served over `http://`, not opened directly as
`file://`. From the project root:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.
