# Personal Beyblade X Tournament Lab — PWA

This is an installable Progressive Web App.

## Features
- Mobile-first one-tap first-to-4 scoring
- Spin, Burst, Over, and Xtreme buttons
- Own Finish prompt after Over/Xtreme
- Undo and match saving
- Editable 3-Bey deck plus independent Test Bey
- Owned-part quantity checks
- BulletGriffon integrated-ratchet rule
- Offline operation after first load
- Local analytics
- JSON backup and CSV export
- Existing DranStrike test data preloaded

## Important
A PWA must be served over HTTPS (or localhost) to install and use its service worker.
Opening index.html directly from Files is not sufficient.

## Easiest free hosting
1. Create a free GitHub account.
2. Create a new public repository.
3. Upload all files from this folder.
4. Open repository Settings > Pages.
5. Under Build and deployment, choose Deploy from a branch.
6. Select main and /root.
7. Open the generated HTTPS URL on Android Chrome.
8. Chrome menu > Add to Home screen > Install.

Alternative free hosting: Netlify Drop or Cloudflare Pages.

## Local computer test
From this folder, run:
python -m http.server 8000

Then open:
http://localhost:8000