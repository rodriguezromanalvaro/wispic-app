# Wispic brand assets

This folder contains lightweight SVG assets for quick branding and OAuth use.

Files
- `wispic-logo.svg` – Horizontal logo with wordmark.
- `wispic-mark.svg` – Square mark for favicon / app icon.

Recommendations
- OAuth logo: square PNG 512×512 (max ~1MB). Use the mark.
- Favicon: modern browsers support SVG; you can point to `wispic-mark.svg`.

How to export PNG on Windows (no extra installs)
1. Open the SVG in Microsoft Edge.
2. Press Win+Shift+S to capture a full-window screenshot and save as PNG.
3. Optionally crop to exactly 512×512 with Photos or Paint.

Optional high‑quality export (requires Node.js)
If you prefer perfect 512×512 output, install the sharp CLI once:

```powershell
npm i -g sharp-cli
sharp assets/brand/wispic-mark.svg -o assets/brand/wispic-mark-512.png --width 512 --height 512
```

Then upload `wispic-mark-512.png` to the Google OAuth consent screen.

License
- These assets are generated for this project and you may use/modify them within Wispic.