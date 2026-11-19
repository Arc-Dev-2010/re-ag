
const SUPABASE_URL = "https://feiykfffaiiffqqnvsjg.supabase.co";
const SUPABASE_KEY = "sb_publishable_oqfKmutURj5n_T3okkLEYA_8QsnWrq-";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);

let currentUser = null;
let currentSort = "newest";
let cachedPosts = [];
let likedPosts = new Set();
let savedPosts = new Set();

function notify(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function timeAgo(date) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

// ---------- AUTHENTICATION ----------

function createAuthDialog() {
  if ($("authDialog")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div id="authDialog" style="
      display:none;position:fixed;inset:0;z-index:100;
      background:rgba(0,0,0,.42);align-items:center;justify-content:center;
      padding:18px;">
      <section style="
        width:min(100%,390px);background:var(--surface);
        color:var(--ink);border:1px solid var(--line);
        border-radius:18px;padding:24px;box-shadow:var(--shadow);">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2 id="authTitle" style="font-size:21px;margin:0">Welcome back</h2>
          <button id="authClose" class="icon-button" aria-label="Close">×</button>
        </div>
        <p id="authDescription" style="font-size:13px;color:var(--muted)">
          Sign in to join the conversation.
        </p>
        <form id="authForm">
          <input id="authName" autocomplete="name" placeholder="Display name"
            maxlength="40" style="display:none;width:100%;padding:12px;margin:7px 0;border:1px solid var(--line);border-radius:9px;background:var(--page);color:var(--ink)">
          <input id="authEmail" type="email" autocomplete="email" required
            placeholder="Email address" style="width:100%;padding:12px;margin:7px 0;border:1px solid var(--line);border-radius:9px;background:var(--page);color:var(--ink)">
          <input id="authPassword" type="password" autocomplete="current-password"
            minlength="6" required placeholder="Password" style="width:100%;padding:12px;margin:7px 0;border:1px solid var(--line);border-radius:9px;background:var(--page);color:var(--ink)">
          <button id="authSubmit" class="post-button" style="width:100%;margin-top:12px">Sign in</button>
        </form>
        <p id="authMessage" role="status" style="font-size:12px;color:var(--muted);min-height:18px"></p>
        <button id="authSwitch" style="border:0;background:none;color:var(--accent-ink);padding:5px 0">
          Create an account instead
        </button>
      </section>
    </div>
  `);

  $("authClose").onclick = closeAuth;
  $("authDialog").addEventListener("click", e => {
    if (e.target.id === "authDialog") closeAuth();
  });

  $("authSwitch").onclick = () => {
    authMode = authMode === "login" ? "signup" : "login";
    updateAuthDialog();
  };

  $("authForm").addEventListener("submit", submitAuth);
}

let authMode = "login";

function updateAuthDialog() {
  const signup = authMode === "signup";
  $("authTitle").textContent = signup ? "Create your account" : "Welcome back";
  $("authDescription").textContent = signup
    ? "Join Re-Ag? and share your thoughts."
    : "Sign in to join the conversation.";
  $("authName").style.display = signup ? "block" : "none";
  $("authName").required = signup;
  $("authSubmit").textContent = signup ? "Create account" : "Sign in";
  $("authSwitch").textContent = signup
    ? "Already have an account? Sign in"
    : "Create an account instead";
  $("authMessage").textContent = "";
}

function openAuth(mode = "login") {
  createAuthDialog();
  authMode = mode;
  updateAuthDialog();
  $("authDialog").style.display = "flex";
}

function closeAuth() {
  if ($("authDialog")) $("authDialog").style.display = "none";
}

async function submitAuth(e) {
  e.preventDefault();

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  const name = $("authName").value.trim();

  $("authSubmit").disabled = true;
  $("authMessage").textContent = "Please wait…";

  try {
    if (authMode === "signup") {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name }
        }
      });

      if (error) throw error;

      if (data.session) {
        notify("Account created!");
        closeAuth();
      } else {
        $("authMessage").textContent =
          "Account created. Check your email to confirm your address, then sign in.";
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuth();
      notify("Welcome back!");
    }
  } catch (error) {
    $("authMessage").textContent = error.message;
  } finally {
    $("authSubmit").disabled = false;
  }
}

async function refreshUser() {
  const { data } = await db.auth.getUser();
  currentUser = data.user || null;
  updateAccountMenu();
  return currentUser;
}

function updateAccountMenu() {
  const buttons = document.querySelectorAll("#profileMenu button");
  if (buttons.length < 4) return;

  buttons[0].textContent = currentUser ? "My profile" : "My profile · Sign in";
  buttons[1].textContent = "Saved vents";
  buttons[2].textContent = "Settings";
  buttons[3].textContent = currentUser ? "Sign out" : "Sign in / Create account";
}

// ---------- PROFILES ----------

async function getProfiles(userIds) {
  if (!userIds.length) return {};

  const { data, error } = await db
    .from("profiles")
    .select("id, username, display_name")
    .in("id", userIds);

  if (error) {
    console.error("Profile lookup:", error);
    return {};
  }

  return Object.fromEntries((data || []).map(profile => [profile.id, profile]));
}

// ---------- COMMUNITY FEED ----------

async function loadFeed() {
  const feed = $("feed");
  feed.innerHTML = '<div class="empty">Loading community…</div>';

  let query = db
    .from("posts")
    .select("id,user_id,content,created_at")
    .order("created_at", { ascending: currentSort === "newest" ? false : true })
    .limit(50);

  const { data: posts, error } = await query;

  if (error) {
    feed.innerHTML = '<div class="empty">Could not load posts. Please refresh.</div>';
    console.error(error);
    return;
  }

  cachedPosts = posts || [];

  if (!cachedPosts.length) {
    feed.innerHTML = '<div class="empty">It's quiet here. Be the first to post.</div>';
    return;
  }

  const ids = [...new Set(cachedPosts.map(post => post.user_id))];
  const profiles = await getProfiles(ids);

  const postIds = cachedPosts.map(post => post.id);

  const [likesResult, commentsResult] = await Promise.all([
    db.from("likes").select("post_id,user_id").in("post_id", postIds),
    db.from("comments").select("post_id").in("post_id", postIds)
  ]);

  const likes = likesResult.data || [];
  const comments = commentsResult.data || [];

  likedPosts = new Set(
    likes.filter(like => like.user_id === currentUser?.id).map(like => like.post_id)
  );

  const likeCounts = {};
  const commentCounts = {};

  likes.forEach(like => {
    likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1;
  });

  comments.forEach(comment => {
    commentCounts[comment.post_id] = (commentCounts[comment.post_id] || 0) + 1;
  });

  if (currentUser) {
    const { data: bookmarks } = await db
      .from("bookmarks")
      .select("post_id")
      .eq("user_id", currentUser.id);

    savedPosts = new Set((bookmarks || []).map(item => item.post_id));
  } else {
    savedPosts = new Set();
  }

  renderPosts(profiles, likeCounts, commentCounts);
}

function renderPosts(profiles, likeCounts = {}, commentCounts = {}) {
  const feed = $("feed");
  const query = $("searchInput").value.trim().toLowerCase();

  let posts = [...cachedPosts];

  if (currentSort === "popular") {
    posts.sort((a, b) => (likeCounts[b.id] || 0) - (likeCounts[a.id] || 0));
  }

  if (query) {
    posts = posts.filter(post => {
      const profile = profiles[post.user_id] || {};
      return `${profile.username || ""} ${profile.display_name || ""} ${post.content}`
        .toLowerCase().includes(query);
    });
  }

  if (!posts.length) {
    feed.innerHTML = '<div class="empty">No matching posts found.</div>';
    return;
  }

  feed.innerHTML = posts.map(post => {
    const profile = profiles[post.user_id] || {};
    const name = profile.display_name || profile.username || "Member";
    const initial = escapeHTML(name.charAt(0).toUpperCase());
    const liked = likedPosts.has(post.id);
    const saved = savedPosts.has(post.id);

    return `
      <article class="post" data-post-id="${post.id}">
        <div class="post-meta">
          <span class="avatar">${initial}</span>
          <span class="post-user">${escapeHTML(name)}</span>
          <span class="post-time">· ${timeAgo(post.created_at)}</span>
        </div>
        <p>${escapeHTML(post.content)}</p>
        <div class="post-actions">
          <button class="action like ${liked ? "active" : ""}" data-action="like">
            <span>${likeCounts[post.id] || 0} ♥</span>
          </button>
          <button class="action comments" data-action="comments">
            ${commentCounts[post.id] || 0} comments
          </button>
          <button class="action save ${saved ? "active" : ""}" data-action="save">
            ${saved ? "Saved" : "Save"}
          </button>
          <button class="action" data-action="report">Report</button>
        </div>
        <div class="comments-area"></div>
      </article>
    `;
  }).join("");
}

// ---------- POSTING ----------

async function publishPost() {
  const input = $("ventInput");
  const content = input.value.trim();

  if (!content) {
    input.focus();
    notify("Write something first.");
    return;
  }

  if (!currentUser) {
    openAuth();
    return;
  }

  $("publishButton").disabled = true;

  const { error } = await db.from("posts").insert({
    user_id: currentUser.id,
    content
  });

  $("publishButton").disabled = false;

  if (error) {
    notify(error.message);
    return;
  }

  input.value = "";
  notify("Your vent has been published.");
  await loadFeed();
}

// ---------- LIKES AND BOOKMARKS ----------

async function toggleLike(postId) {
  if (!currentUser) return openAuth();

  const exists = likedPosts.has(postId);

  const result = exists
    ? await db.from("likes").delete().eq("post_id", postId).eq("user_id", currentUser.id)
    : await db.from("likes").insert({ post_id: postId, user_id: currentUser.id });

  if (result.error) {
    notify(result.error.message);
    return;
  }

  await loadFeed();
}

async function toggleBookmark(postId) {
  if (!currentUser) return openAuth();

  const exists = savedPosts.has(postId);

  const result = exists
    ? await db.from("bookmarks").delete().eq("post_id", postId).eq("user_id", currentUser.id)
    : await db.from("bookmarks").insert({ post_id: postId, user_id: currentUser.id });

  if (result.error) {
    notify(result.error.message);
    return;
  }

  notify(exists ? "Bookmark removed." : "Vent bookmarked.");
  await loadFeed();
}

// ---------- COMMENTS ----------

async function showComments(postId, area) {
  if (area.dataset.loaded === "true") {
    area.innerHTML = "";
    area.dataset.loaded = "false";
    return;
  }

  area.innerHTML = '<p>Loading comments…</p>';

  const { data, error } = await db
    .from("comments")
    .select("id,user_id,content,created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    area.textContent = error.message;
    return;
  }

  const profiles = await getProfiles([...new Set((data || []).map(c => c.user_id))]);

  area.innerHTML = `
    <div class="comments-panel">
      ${(data || []).map(comment => `
        <p style="color:var(--ink)">
          <strong>${escapeHTML(profiles[comment.user_id]?.display_name || "Member")}:</strong>
          ${escapeHTML(comment.content)}
        </p>
      `).join("")}
      <form class="comment-form">
        <input maxlength="1000" required placeholder="Write a reply…">
        <button type="submit">Reply</button>
      </form>
    </div>
  `;

  area.dataset.loaded = "true";
}

async function submitComment(postId, form) {
  if (!currentUser) return openAuth();

  const input = form.querySelector("input");
  const content = input.value.trim();

  if (!content) return;

  const { error } = await db.from("comments").insert({
    post_id: postId,
    user_id: currentUser.id,
    content
  });

  if (error) {
    notify(error.message);
    return;
  }

  notify("Reply posted.");
  const area = form.closest(".comments-area");
  area.dataset.loaded = "false";
  await showComments(postId, area);
}

// ---------- REPORTING ----------

async function reportPost(postId) {
  if (!currentUser) return openAuth();

  const reason = prompt("Why are you reporting this post?\n\nChoose: spam, harassment, inappropriate, other");
  if (!reason) return;

  const allowed = ["spam", "harassment", "inappropriate", "other"];
  const normalized = reason.trim().toLowerCase();

  if (!allowed.includes(normalized)) {
    notify("Please enter spam, harassment, inappropriate, or other.");
    return;
  }

  const { error } = await db.from("reports").insert({
    reporter_id: currentUser.id,
    post_id: postId,
    reason: normalized
  });

  notify(error ? error.message : "Report submitted. Thank you.");
}

// ---------- SAVED POSTS ----------

async function showSavedPosts() {
  if (!currentUser) return openAuth();

  const { data, error } = await db
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", currentUser.id);

  if (error) return notify(error.message);

  const ids = (data || []).map(item => item.post_id);
  cachedPosts = cachedPosts.filter(post => ids.includes(post.id));

  if (!cachedPosts.length) {
    $("feed").innerHTML = '<div class="empty">You have no saved vents yet.</div>';
    return;
  }

  const profiles = await getProfiles([...new Set(cachedPosts.map(p => p.user_id))]);
  renderPosts(profiles);
}

// ---------- EVENTS ----------

$("publishButton").addEventListener("click", publishPost);

$("sortToggle").addEventListener("click", () => {
  $("sortMenu").classList.toggle("open");
});

$("sortMenu").addEventListener("click", async e => {
  const button = e.target.closest("[data-sort]");
  if (!button) return;

  currentSort = button.dataset.sort;
  $("sortToggle").innerHTML =
    (currentSort === "popular" ? "Popular vents" : "Newest") + ' <span>⌄</span>';

  $("sortMenu").classList.remove("open");
  await loadFeed();
});

$("searchInput").addEventListener("input", async () => {
  await loadFeed();
});

$("feed").addEventListener("click", async e => {
  const button = e.target.closest("[data-action]");
  if (!button) return;

  const post = button.closest("[data-post-id]");
  if (!post) return;

  const postId = post.dataset.postId;

  if (button.dataset.action === "like") await toggleLike(postId);
  if (button.dataset.action === "save") await toggleBookmark(postId);
  if (button.dataset.action === "comments") {
    await showComments(postId, post.querySelector(".comments-area"));
  }
  if (button.dataset.action === "report") await reportPost(postId);
});

$("feed").addEventListener("submit", async e => {
  if (!e.target.matches(".comment-form")) return;
  e.preventDefault();

  const post = e.target.closest("[data-post-id]");
  if (post) await submitComment(post.dataset.postId, e.target);
});

$("profileMenu").addEventListener("click", async e => {
  const button = e.target.closest("button");
  if (!button) return;

  const index = [...$("profileMenu").querySelectorAll("button")].indexOf(button);
  $("profileMenu").classList.remove("open");

  if (index === 0) {
    if (!currentUser) return openAuth();
    const { data } = await db.from("profiles")
      .select("display_name,username")
      .eq("id", currentUser.id)
      .maybeSingle();

    const newName = prompt("Display name:", data?.display_name || "");
    if (newName === null || !newName.trim()) return;

    const { error } = await db.from("profiles")
      .update({ display_name: newName.trim() })
      .eq("id", currentUser.id);

    notify(error ? error.message : "Profile updated.");
    await loadFeed();
  }

  if (index === 1) await showSavedPosts();

  if (index === 2) {
    notify("Settings will be expanded in a later update.");
  }

  if (index === 3) {
    if (currentUser) {
      await db.auth.signOut();
      notify("Signed out.");
    } else {
      openAuth();
    }
  }
});

// ---------- EXISTING DESIGN INTERACTIONS ----------

$("brandToggle").addEventListener("click", () => {
  const open = $("brandPanel").classList.toggle("open");
  $("brandToggle").setAttribute("aria-expanded", String(open));
});

$("profileToggle").addEventListener("click", () =>
  $("profileMenu").classList.toggle("open")
);

$("middleAccountToggle")?.addEventListener("click", () =>
  $("profileMenu").classList.toggle("open")
);

$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

document.addEventListener("click", e => {
  if (!e.target.closest(".brand-wrap")) {
    $("brandPanel").classList.remove("open");
    $("brandToggle").setAttribute("aria-expanded", "false");
  }

  if (!e.target.closest(".profile-wrap") &&
      !e.target.closest("#middleAccountToggle")) {
    $("profileMenu").classList.remove("open");
  }

  if (!e.target.closest(".sort-wrap")) {
    $("sortMenu").classList.remove("open");
  }
});

// ---------- STARTUP + LIVE UPDATES ----------

async function startApp() {
  createAuthDialog();

  const { data } = await db.auth.getSession();
  currentUser = data.session?.user || null;

  updateAccountMenu();
  await loadFeed();

  db.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAccountMenu();
    setTimeout(loadFeed, 0);
  });

  db.channel("reag-community")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "posts"
    }, loadFeed)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "likes"
    }, loadFeed)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "comments"
    }, loadFeed)
    .subscribe();
}

startApp();
