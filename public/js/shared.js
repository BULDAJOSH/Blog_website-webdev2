(() => {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open navigation" : "Close navigation");
      nav.classList.toggle("nav-open", !open);
    });
  }

  const storageKey = "courtside.posts.v1";

  function readPosts() {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === null) return [];
    const posts = JSON.parse(saved);
    if (!Array.isArray(posts)) throw new Error("Saved posts could not be read.");
    return posts;
  }

  function writePosts(posts) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(posts));
    } catch {
      throw new Error("Browser storage is unavailable or full. Your changes were not saved.");
    }
  }

  function createId(prefix) {
    const id = window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${id}`;
  }

  window.Courtside = {
    getPosts() {
      return readPosts().sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    getPost(id) {
      return readPosts().find((post) => post.id === id) || null;
    },
    createPost({ name, content }) {
      const cleanContent = String(content || "").trim();
      if (!cleanContent) throw new Error("Your post is required.");
      const post = {
        id: createId("post"),
        name: String(name || "").trim() || "Anonymous",
        title: cleanContent.split(/\r?\n/, 1)[0].slice(0, 120) || "New post",
        category: "Other",
        playerOrTeam: "",
        gameDetails: "",
        content: cleanContent,
        createdAt: new Date().toISOString(),
        comments: []
      };
      const posts = readPosts();
      posts.push(post);
      writePosts(posts);
      return post;
    },
    addComment(postId, { name, content }) {
      const cleanContent = String(content || "").trim();
      if (!cleanContent) throw new Error("Comment is required.");
      const posts = readPosts();
      const post = posts.find((item) => item.id === postId);
      if (!post) throw new Error("Post not found.");
      if (!Array.isArray(post.comments)) post.comments = [];
      const comment = {
        id: createId("comment"),
        name: String(name || "").trim() || "Anonymous",
        content: cleanContent,
        createdAt: new Date().toISOString()
      };
      post.comments.push(comment);
      writePosts(posts);
      return comment;
    },
    formatDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Date unavailable";
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date);
    },
    initials(name) {
      const letters = String(name || "C").trim().split(/\s+/).slice(0, 2).map((part) => part[0]);
      return letters.join("").toUpperCase() || "C";
    }
  };
})();
