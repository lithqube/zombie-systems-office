# Operational Dysfunction

A polished, shippable mini-game with:

- 🎮 card-based tactical loop with balancing/momentum systems
- ✨ animations and visual polish
- 🔊 procedural sound effects with mute toggle
- 📱 PWA support (manifest + service worker)
- 🐳 Docker + Nginx containerized deployment

## Local

Open `index.html` directly, or run a static server for full PWA behavior.

## Docker

```bash
docker build -t operational-dysfunction .
docker run --rm -p 8080:80 operational-dysfunction
```

Then open http://localhost:8080.
