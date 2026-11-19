# Re-Ag? — Really, you agree?

A lightweight community website built with static HTML/CSS/JavaScript and Supabase.

## Pages
- `index.html` — community feed, composer, sorting, search, likes, replies, bookmarks and reports
- `profile.html` — public member profile, profile editing, posts, replies and liked posts
- `explore.html` — search posts and discover members
- `notifications.html` — notifications for likes and replies\n- `saved.html` — bookmarked posts
- `settings.html` — appearance and account controls
- `arcade.html` — existing Re-Ag? Jumper mini-game (keep the current repository copy)

## Setup
1. Keep the existing Supabase project and public publishable key in `app.js`.
2. In Supabase SQL Editor, run `profile-migration.sql`.
3. Upload the files in this package to the repository root, replacing `index.html` and adding the other files.
4. Keep the existing `arcade.html` and `sw.js` files.
5. Keep your existing `arcade.html` file in the repository root; this package updates the service worker to cache it alongside the new pages.\n6. In Supabase Authentication → URL Configuration, make sure the Site URL and redirect URL include your GitHub Pages address:
   `https://arc-dev-2010.github.io/re-ag/`
7. Enable GitHub Pages for the `main` branch and root folder.

## Notes
- Avatar images are not uploaded. The default avatar uses initials; an optional direct image URL can be set in Edit Profile.
- The Supabase publishable key is intended for browser use. Never put a service-role key in this repository.
- Enable and test Row Level Security on every public table before inviting users.
- Notifications require the SQL migration above.
- This is a community starter, not a substitute for moderation, backups, abuse controls or a production security review.
