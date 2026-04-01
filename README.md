# Operational Dysfunction

A polished, shippable mini-game with:

- 🎮 card-based tactical loop with balancing/momentum systems
- ✨ animations and visual polish
- 🔊 procedural sound effects with mute toggle
- 📱 PWA support (manifest + service worker)
- ⚡ Netlify deployment

## Play

Live at https://nimble-daifuku-ac626d.netlify.app/

## Local

Open `index.html` directly, or run a static server for full PWA behavior.

## Deploy

**Netlify:** Pushes to `main` deploy automatically. Configuration in `netlify.toml`.

**Docker Hub:** Pushes to `main` and version tags (`v*`) publish the image automatically via GitHub Actions.

```bash
docker pull <your-dockerhub-username>/operational-dysfunction
docker run --rm -p 8080:80 <your-dockerhub-username>/operational-dysfunction
```

**Self-hosted:**

```bash
docker build -t operational-dysfunction .
docker run --rm -p 8080:80 operational-dysfunction
```
