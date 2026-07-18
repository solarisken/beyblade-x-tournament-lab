# X Tournament Director 2 — Flat-root edition

Every application file is stored directly in the repository root. There are no
`src`, `components`, `engine`, `data`, `tests`, or `.github` folders.

## Publish with GitHub Pages

1. Delete the previous app files and folders from the repository.
2. Keep `CNAME` only if you use a custom domain.
3. Extract the ZIP.
4. Upload every extracted file directly to the repository root.
5. In **Settings → Pages**, select:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**

`index.html` must remain at the repository root.

The standalone HTML file can also be opened directly without GitHub.
