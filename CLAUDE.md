# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Operational Dysfunction" — a single-file card battle mini-game themed around toxic workplace dynamics. The entire game (HTML, CSS, JS) lives in `index.html` with no build step or dependencies.

## Running

- **Local:** Open `index.html` in a browser. No build tools needed.
- **Docker:**
  ```bash
  docker build -t operational-dysfunction .
  docker run --rm -p 8080:80 operational-dysfunction
  ```
  Serves via Nginx on port 8080.

## Architecture

This is a zero-dependency, single-file game. All markup, styles, and logic are in `index.html`:

- **Card data** (`CARDS` array ~line 142): Each card has a suit (PARALYSIS, EROSION, INERTIA, SHADOW), stats (power, toxicity, influence, awareness), and an ability.
- **Game state** (`state` object): Tracks player/AI hands, deck, scores, battlefield cards, phase, and suit momentum.
- **Ability system** (`applyAbility`): Modifies combat context (power adjustments, suit-ignore, steal, double toxicity, etc.).
- **Combat flow**: Player picks a card → AI responds with a valid defender (matching suit + sufficient power) or forfeits → abilities resolve → toxicity scores.
- **Suit momentum**: Playing consecutive cards of the same suit grants +2 power.
- **AI logic** (`aiRespond`): Filters hand for valid defenders, picks the first match.

## Deployment

`Dockerfile` uses `nginx:1.27-alpine`. `nginx.conf` sets up SPA fallback routing and aggressive caching for static assets. Service worker caching is configured with no-cache headers for `sw.js`.
