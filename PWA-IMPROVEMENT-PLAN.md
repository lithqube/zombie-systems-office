# PWA Improvement Plan — Zombie Systems Office v3

## Phase 0: Audit Findings (Current State)

### Confirmed Bugs (things that are broken right now)

| # | File | Issue | Impact |
|---|------|-------|--------|
| 1 | `sw.js:2` | `ASSETS` only caches `/`, `/index.html`, `/manifest.json` — icons and fonts excluded | App installs but icons missing offline |
| 2 | `sw.js:2` | Google Fonts CDN URLs not in cache — `DM Serif Display` and `JetBrains Mono` never stored | Offline play shows system fallback fonts |
| 3 | `index.html:1278` | `.catch(()=>{})` swallows all SW registration errors silently | Failures invisible; impossible to debug |
| 4 | `manifest.json` | No `purpose: "maskable"` on any icon | Android adaptive icons show white box around logo |
| 5 | `manifest.json` | No `screenshots` field | Richer install prompt / Play Store listing unavailable |

### Missing Features (things that should exist for a game PWA)

| Feature | API | Why It Matters |
|---------|-----|----------------|
| Install prompt | `beforeinstallprompt` | Users can't discover or install without browser default prompt |
| Update notification | `ServiceWorkerRegistration.waiting` | New versions deploy silently; players run stale code |
| Screen Wake Lock | `navigator.wakeLock.request('screen')` | Screen sleeps mid-game on mobile |
| Web Share | `navigator.share()` | No way to share score at game over |
| Fullscreen | `element.requestFullscreen()` | Game plays inside browser chrome on mobile |
| App shortcuts | `manifest.json shortcuts[]` | Long-press icon has no quick actions |

---

## Phase 1: Fix Broken Offline Caching

**Goal:** The app must fully load and play with zero network connection after first visit.

### 1.1 — Fix `sw.js` ASSETS list

**File:** `sw.js`

Update the `ASSETS` constant to include all static files the game needs:

```js
const CACHE = 'zso-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js',
  '/icon-192.png',
  '/icon-512.png',
  // Google Fonts — pre-cache both the CSS and the actual font files
  // See Phase 1.2 for font caching strategy
];
```

**Also fix:** bump cache name from `opdys-v2` → `zso-v3` so old caches are cleared.

### 1.2 — Cache Google Fonts

Google Fonts serves two layers: a CSS file (`fonts.googleapis.com`) and actual font binaries (`fonts.gstatic.com`). Both need caching.

**Strategy:** Add a dedicated `FONTS_CACHE` and handle these origins in the fetch handler:

```js
const FONTS_CACHE = 'zso-fonts-v1';

// In fetch handler — add before existing logic:
if (e.request.url.includes('fonts.googleapis.com') ||
    e.request.url.includes('fonts.gstatic.com')) {
  e.respondWith(
    caches.open(FONTS_CACHE).then(cache =>
      cache.match(e.request).then(cached =>
        cached || fetch(e.request).then(response => {
          cache.put(e.request, response.clone());
          return response;
        })
      )
    )
  );
  return;
}
```

Also add `FONTS_CACHE` to the activate cleanup:
```js
keys.filter(k => k !== CACHE && k !== FONTS_CACHE)
```

**Reference:** https://developer.chrome.com/docs/workbox/caching-strategies-overview/ (Cache First strategy for fonts)

### 1.3 — Fix maskable icon in `manifest.json`

Add `purpose` to the 512px icon entry so Android generates proper adaptive icons:

```json
{
  "src": "icon-512.png",
  "sizes": "512x512",
  "type": "image/png",
  "purpose": "any maskable"
}
```

**Reference:** https://web.dev/maskable-icon/ — icon safe zone must be within center 80% of canvas.

### Verification
- Open DevTools → Application → Service Workers → confirm "Activated and running"
- DevTools → Application → Cache Storage → confirm all assets + font URLs present
- DevTools → Network → set "Offline" → reload page → game must load with correct fonts
- DevTools → Application → Manifest → confirm no "maskable" warnings

---

## Phase 2: SW Registration & Update Flow

**Goal:** Errors are visible in dev; players get notified when a new version is available.

### 2.1 — Fix SW registration (remove silent catch)

**File:** `index.html` — SW registration block (~line 1277)

Replace:
```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
```

With:
```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { scope: '/' })
    .then(reg => {
      // Check for waiting SW on page load (user had tab open during deploy)
      if (reg.waiting) showUpdateBanner();

      // New SW installed while page is open
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
    })
    .catch(err => console.warn('[SW] Registration failed:', err));

  // Reload when new SW takes control
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
```

### 2.2 — Add update banner UI

Add a small banner element that appears when a new version is ready:

**HTML** (add inside `<body>` before `#splash`):
```html
<div id="updateBanner" style="display:none" role="alert" aria-live="polite">
  <span>New version available.</span>
  <button onclick="activateUpdate()">UPDATE</button>
</div>
```

**CSS** — style consistent with game aesthetic:
```css
#updateBanner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100000;
  background: #B71C1C; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 2px;
}
#updateBanner button {
  width: auto; padding: 4px 12px; margin: 0;
  background: rgba(255,255,255,.15); font-size: 10px;
}
```

**JS** functions:
```js
function showUpdateBanner() {
  document.getElementById('updateBanner').style.display = 'flex';
}
function activateUpdate() {
  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  });
}
```

**SW** — add message listener in `sw.js`:
```js
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
```

**Also move** `self.skipWaiting()` out of install (it causes update-notification races) — let it be triggered only via message.

### Verification
- Deploy a change, reload → update banner appears
- Click UPDATE → page reloads with new version
- `console.warn` appears if SW registration fails in dev

---

## Phase 3: Install Prompt (Add to Home Screen)

**Goal:** Show a themed "Install App" button instead of relying on the browser's default prompt.

### 3.1 — Capture `beforeinstallprompt`

**File:** `index.html` — add near the SW registration block

```js
let _installPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); // suppress default browser prompt
  _installPrompt = e;
  document.getElementById('installBtn').style.display = 'block';
});

window.addEventListener('appinstalled', () => {
  document.getElementById('installBtn').style.display = 'none';
  _installPrompt = null;
});

function installApp() {
  if (!_installPrompt) return;
  _installPrompt.prompt();
  _installPrompt.userChoice.then(result => {
    if (result.outcome === 'accepted') {
      document.getElementById('installBtn').style.display = 'none';
    }
    _installPrompt = null;
  });
}
```

### 3.2 — Add install button to splash screen

Add inside `#splash`, after `.splash-enter` button:

```html
<button id="installBtn" class="splash-enter" onclick="installApp()"
  style="display:none; margin-top:8px; border-color:rgba(255,255,255,.2) !important;"
  aria-label="Install app">
  INSTALL APP
</button>
```

### 3.3 — Add `shortcuts` to `manifest.json`

```json
"shortcuts": [
  {
    "name": "New Game",
    "short_name": "Play",
    "description": "Start a new game immediately",
    "url": "/?action=newgame",
    "icons": [{ "src": "icon-192.png", "sizes": "192x192" }]
  }
]
```

Handle the shortcut in JS:
```js
if (new URLSearchParams(location.search).get('action') === 'newgame') {
  // skip splash, call init() directly
}
```

### Verification
- Chrome DevTools → Application → Manifest → no errors
- In Chrome, visit page → address bar shows install icon → clicking matches `_installPrompt.prompt()`
- Long-press home screen icon on Android → "New Game" shortcut visible

---

## Phase 4: Game-Specific PWA Enhancements

**Goal:** Native app feel — no screen sleep, fullscreen mode, shareable scores.

### 4.1 — Screen Wake Lock

Prevent the screen from sleeping during gameplay.

**Reference:** https://developer.chrome.com/docs/capabilities/web-apis/wake-lock

```js
let wakeLock = null;

async function acquireWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* permission denied or not supported */ }
  }
}

async function releaseWakeLock() {
  if (wakeLock) { await wakeLock.release(); wakeLock = null; }
}

// Re-acquire after tab becomes visible again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') acquireWakeLock();
});
```

Call `acquireWakeLock()` when the game starts (after `enterSystem()`), `releaseWakeLock()` on game over.

### 4.2 — Fullscreen API

Enter fullscreen when the player enters the game from splash.

**Reference:** https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API

```js
function requestFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}
```

Call inside `enterSystem()` after the splash hides.

### 4.3 — Web Share API (score sharing at game over)

**Reference:** https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share

Add share button to `#gameOver` UI:

```html
<button id="shareBtn" onclick="shareScore()" style="display:none">
  SHARE RESULT
</button>
```

```js
async function shareScore() {
  if (!navigator.share) return;
  const title = document.getElementById('gameOverTitle').textContent;
  const score = document.getElementById('finalScore').textContent;
  await navigator.share({
    title: 'Zombie Systems Office',
    text: `${title} — ${score} | Alive on paper. Dead in practice.`,
    url: 'https://nimble-daifuku-ac626d.netlify.app/'
  });
}

// Show share button only if Web Share is supported
if (navigator.share) {
  document.getElementById('shareBtn').style.display = 'block';
}
```

### Verification
- On mobile: game starts → screen stays on throughout session
- Tap "ENTER SYSTEM" → browser enters fullscreen
- At game over → SHARE RESULT button appears → tapping opens OS share sheet

---

## Phase 5: Manifest Polish

**Goal:** App store-quality install experience.

### 5.1 — Add `screenshots` to `manifest.json`

Required for richer install dialogs on Chrome/Edge (mini-info bar → full install sheet):

```json
"screenshots": [
  {
    "src": "screenshot-1.png",
    "sizes": "390x844",
    "type": "image/png",
    "form_factor": "narrow",
    "label": "Card battle gameplay"
  }
]
```

Action: take a screenshot of gameplay at 390×844px (iPhone-size), save as `screenshot-1.png`.

### 5.2 — Add `categories`

```json
"categories": ["games", "entertainment"]
```

### 5.3 — Final `manifest.json` target state

```json
{
  "name": "Zombie Systems Office",
  "short_name": "ZSO",
  "description": "Alive on paper. Dead in practice. A tactical card combat mini-game about corporate decay.",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "fullscreen",
  "background_color": "#050508",
  "theme_color": "#050508",
  "orientation": "portrait",
  "categories": ["games", "entertainment"],
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "shortcuts": [ ... ],
  "screenshots": [ ... ]
}
```

Note: `display: "fullscreen"` replaces `"standalone"` so the game launches with no browser chrome at all.

---

## Implementation Order

| Phase | Effort | Impact | Do First? |
|-------|--------|--------|-----------|
| 1 — Fix offline caching | Small | Critical — app unusable offline | ✅ Yes |
| 2 — Update banner | Small | High — stale code problem | ✅ Yes |
| 3 — Install prompt | Medium | High — discoverability | After 1+2 |
| 4 — Game enhancements | Medium | High — native feel | After 3 |
| 5 — Manifest polish | Small | Medium — store quality | Last |

---

## API Reference Checklist

| API | MDN Link | Browser Support |
|-----|----------|-----------------|
| Service Worker | https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API | All modern |
| Cache API | https://developer.mozilla.org/en-US/docs/Web/API/Cache | All modern |
| beforeinstallprompt | https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event | Chrome/Edge only |
| Wake Lock | https://developer.mozilla.org/en-US/docs/Web/API/WakeLock | Chrome/Edge/Firefox |
| Fullscreen | https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API | All modern |
| Web Share | https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share | Mobile Chrome/Safari |
| Manifest shortcuts | https://developer.mozilla.org/en-US/docs/Web/Manifest/shortcuts | Chrome/Edge Android |
