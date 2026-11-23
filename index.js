const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const PORT = process.env.PORT || 3000;
const DEFAULT_DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const PLAYER_SEARCH_URL = "https://www.thesportsdb.com/api/v1/json/123/searchplayers.php";
const CATEGORIES = new Set([
  "Game Experience",
  "Player Discussion",
  "Basketball Opinions",
  "Other"
]);

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function readString(value, label, { required = false, max = 5000 } = {}) {
  if (typeof value !== "string") {
    if (required) throw validationError(`${label} is required.`);
    return "";
  }

  const result = value.trim();
  if (required && !result) throw validationError(`${label} is required.`);
  if (result.length > max) {
    throw validationError(`${label} must be ${max} characters or fewer.`);
  }
  return result;
}

function isValidId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
}

function createApp({ dataFile = DEFAULT_DATA_FILE, fetchImpl = fetch } = {}) {
  const app = express();
  let writeQueue = Promise.resolve();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(express.static(PUBLIC_DIR));

  async function readData() {
    let raw;
    try {
      raw = await fs.readFile(dataFile, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const initial = JSON.stringify({ posts: [] }, null, 2) + "\n";
      try {
        await fs.writeFile(dataFile, initial, { flag: "wx" });
        raw = initial;
      } catch (createError) {
        if (createError.code !== "EEXIST") throw createError;
        raw = await fs.readFile(dataFile, "utf8");
      }
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      const error = new Error("The data file contains invalid JSON. It was left unchanged.");
      error.status = 500;
      throw error;
    }

    if (!data || !Array.isArray(data.posts)) {
      const error = new Error("The data file must contain a posts array. It was left unchanged.");
      error.status = 500;
      throw error;
    }
    return data;
  }

  async function writeData(data) {
    const temporaryFile = `${dataFile}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, {
        flag: "wx"
      });
      await fs.rename(temporaryFile, dataFile);
    } catch (error) {
      await fs.rm(temporaryFile, { force: true }).catch(() => {});
      throw error;
    }
  }

  function serializeWrite(operation) {
    const result = writeQueue.then(operation);
    writeQueue = result.catch(() => {});
    return result;
  }

  function findPost(data, id) {
    return data.posts.find((post) => post.id === id);
  }

  app.get("/api/players", async (req, res, next) => {
    const query = readString(req.query.q, "Player name", { max: 80 });
    if (query.length < 2) {
      return res.status(400).json({ error: "Enter at least two characters to search." });
    }

    const url = new URL(PLAYER_SEARCH_URL);
    url.searchParams.set("p", query);

    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
    } catch (cause) {
      const error = new Error("The player search service could not be reached.");
      error.status = 502;
      error.cause = cause;
      return next(error);
    }

    if (!response.ok) {
      const error = new Error(`The player search service returned HTTP ${response.status}.`);
      error.status = 502;
      return next(error);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (cause) {
      const error = new Error("The player search service returned invalid data.");
      error.status = 502;
      error.cause = cause;
      return next(error);
    }

    if (!payload || (payload.player !== null && !Array.isArray(payload.player))) {
      const error = new Error("The player search service returned an unexpected response.");
      error.status = 502;
      return next(error);
    }

    const players = (payload.player || [])
      .filter((player) => player && player.strSport === "Basketball" && typeof player.strPlayer === "string")
      .map((player) => ({
        id: typeof player.idPlayer === "string" ? player.idPlayer : "",
        name: player.strPlayer.trim(),
        team: typeof player.strTeam === "string" ? player.strTeam : "",
        position: typeof player.strPosition === "string" ? player.strPosition : "",
        nationality: typeof player.strNationality === "string" ? player.strNationality : ""
      }))
      .filter((player) => player.name);

    res.json(players);
  });

  app.get("/api/posts", async (req, res, next) => {
    try {
      const data = await readData();
      const posts = [...data.posts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      res.json(posts);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/posts/:id", async (req, res, next) => {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid post ID." });
    }
    try {
      const data = await readData();
      const post = findPost(data, req.params.id);
      if (!post) return res.status(404).json({ error: "Post not found." });
      res.json(post);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/posts/:id/comments", async (req, res, next) => {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid post ID." });
    }
    try {
      const data = await readData();
      const post = findPost(data, req.params.id);
      if (!post) return res.status(404).json({ error: "Post not found." });
      const comments = Array.isArray(post.comments) ? post.comments : [];
      res.json([...comments].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts", async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
      const content = readString(body.content, "Your post", {
        required: true,
        max: 5000
      });
      const title = readString(body.title, "Post title", { max: 120 })
        || content.split(/\r?\n/, 1)[0].slice(0, 120)
        || "New post";
      const post = {
        id: `post_${randomUUID()}`,
        name: readString(body.name, "Display name", { max: 60 }) || "Anonymous",
        title,
        category: readString(body.category, "Category", { max: 40 }) || "Other",
        playerOrTeam: readString(body.playerOrTeam, "Player or team", { max: 100 }),
        gameDetails: readString(body.gameDetails, "Game details", { max: 300 }),
        content,
        createdAt: new Date().toISOString(),
        comments: []
      };
      if (!CATEGORIES.has(post.category)) {
        throw validationError("Choose a valid post category.");
      }
      const saved = await serializeWrite(async () => {
        const data = await readData();
        data.posts.push(post);
        await writeData(data);
        return post;
      });
      res.status(201).json(saved);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:id/comments", async (req, res, next) => {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid post ID." });
    }
    try {
      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
      const comment = {
        id: `comment_${randomUUID()}`,
        name: readString(body.name, "Display name", { max: 60 }) || "Anonymous",
        content: readString(body.content, "Comment", {
          required: true,
          max: 2000
        }),
        createdAt: new Date().toISOString()
      };
      const saved = await serializeWrite(async () => {
        const data = await readData();
        const post = findPost(data, req.params.id);
        if (!post) {
          const error = new Error("Post not found.");
          error.status = 404;
          throw error;
        }
        if (!Array.isArray(post.comments)) post.comments = [];
        post.comments.push(comment);
        await writeData(data);
        return comment;
      });
      res.status(201).json(saved);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });

  app.use((req, res) => {
    res.status(404).type("html").send(`<!doctype html>
      <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Not found — Courtside</title><link rel="stylesheet" href="/css/style.css"></head>
      <body><main class="not-found container"><p class="eyebrow">OUT OF BOUNDS</p>
      <h1>This page missed<br>the <span>rim.</span></h1>
      <p>Nothing to see here. Let’s get you back in the game.</p>
      <a class="button button-primary" href="/">Back to the feed <span>↗</span></a></main></body></html>`);
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error.type === "entity.parse.failed" ? 400 : 500);
    if (status >= 500) console.error(error.message);
    res.status(status).json({
      error: status === 400
        ? (error.type === "entity.parse.failed" ? "Request body must be valid JSON." : error.message)
        : error.message || "An unexpected server error occurred."
    });
  });

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`Basketball Community is running at http://localhost:${PORT}`);
  });
}

module.exports = { createApp };
