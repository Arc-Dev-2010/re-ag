# Re-Ag? + Neural Grid MESH — installation package

## Important status
This is an integration package for the existing GitHub Pages repository. It preserves the existing `app.js`, Supabase integration, database and `arcade.html` game. It does not claim to be deployed. Copy the new files into the repository root and replace the six HTML shell files with the versions in `site-shells/`.

## Files to add at repository root
- `mesh.css`
- `mesh-core.js`
- `mesh-ui.js`
- `mesh-bridge.js`
- `mesh-bridge.css`
- `styles-2030.css`
- `admin.html`, `admin.js`, `admin-migration.sql`
- `neural-grid.html`
- `games.html`
- `games.css`
- `games.js`
- `ai-about.html`
- `sw.js` (replace existing service worker)

## Replace existing HTML files
Copy the six files from `site-shells/` into the repository root, replacing `index.html`, `profile.html`, `explore.html`, `notifications.html`, `saved.html`, and `settings.html`. These are compatible shells that keep the existing `app.js` and Supabase CDN script, adding the navigation bridge.

## Preserve
Do not replace or delete `app.js`, `styles.css`, `arcade.html`, existing database tables, Supabase keys, or user data. The existing Jumper remains at `arcade.html`.

## Games
- Tic-Tac-Toe (adaptive local opponent + Minimax)
- 2048
- Memory Grid
- Reaction Lab
- Pattern Recall
- Existing Re-Ag? Jumper (preserved)

## Service worker
The new `sw.js` caches the new static assets. After deployment, visit the site once while online, then reload. If an old service worker persists, close old tabs and reload; browser cache eviction remains under iOS control.

## Test checklist
1. Open `index.html`, sign in and confirm the existing feed still loads.
2. Confirm Games, Neural Grid and AI Lab links appear in navigation.
3. Open `games.html`; play all five new games and the existing Jumper.
4. Play several Tic-Tac-Toe rounds; reload and confirm the local learning sample count persists in Neural Grid.
5. Open Neural Grid Studio; generate, edit, preview, save and reset a personal theme.
6. Open AI Lab and verify the public technical explanation.
7. Test offline after a successful online load.
8. Test on iPhone Safari and desktop browsers.

## Honest implementation notes
- No specialized AI/ML framework is used. The runtime is custom JavaScript.
- The experimental neural map is 9–16–9 (not a 5–6M parameter language model). It learns move preferences locally. Minimax is responsible for unbeatable game strategy.
- Code generation is constrained and template/rule-based, not an arbitrary general-purpose LLM.
- UI code preview is sandboxed. Saved host-site styling is restricted to local theme tokens; custom JS does not execute in the main Re-Ag? page.
- RAM allocation is managed by the application in 1 KB blocks, but the browser controls real physical memory and garbage collection.
- No backend migration is required for Neural Grid.

## Admin Mode
The bridge shows an Admin link only when the current Supabase session has `app_metadata.reag_role === 'admin'`. Run `admin-migration.sql` manually, then assign the role to the correct Supabase Auth UUID as the project owner. No admin password is embedded in JavaScript. The included console supports report review, dismissal and reported-post removal only; it does not implement account suspension or account deletion.
