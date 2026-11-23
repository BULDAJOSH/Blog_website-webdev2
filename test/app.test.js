const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { after, before, test } = require("node:test");
const { createApp } = require("../index");

let directory;
let dataFile;
let server;
let baseUrl;

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "courtside-test-"));
  dataFile = path.join(directory, "data.json");
  server = createApp({ dataFile }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await fs.rm(directory, { recursive: true, force: true });
});

async function postJson(url, body) {
  return fetch(`${baseUrl}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("creates a post and stores it in the local JSON file", async () => {
  const response = await postJson("/api/posts", {
    title: "A night to remember",
    category: "Game Experience",
    content: "The crowd was electric."
  });
  assert.equal(response.status, 201);
  const post = await response.json();
  assert.match(post.id, /^post_/);
  assert.equal(post.name, "Anonymous");
  assert.equal(post.comments.length, 0);
  assert.ok(post.createdAt);
  const stored = JSON.parse(await fs.readFile(dataFile, "utf8"));
  assert.equal(stored.posts[0].id, post.id);

  const getResponse = await fetch(`${baseUrl}/api/posts/${post.id}`);
  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).title, "A night to remember");
});

test("creates a simple post and accepts a comment on it", async () => {
  const postResponse = await postJson("/api/posts", {
    name: "Sam",
    content: "A quick thought\nMore details here."
  });
  assert.equal(postResponse.status, 201);
  const post = await postResponse.json();
  assert.equal(post.title, "A quick thought");
  assert.equal(post.category, "Other");

  const commentResponse = await postJson(`/api/posts/${post.id}/comments`, {
    content: "Thanks for sharing!"
  });
  assert.equal(commentResponse.status, 201);
  const comment = await commentResponse.json();
  assert.equal(comment.content, "Thanks for sharing!");
});

test("searches TheSportsDB for basketball players and validates the query", async () => {
  let requestedUrl;
  const playerServer = createApp({
    dataFile: path.join(directory, "players.json"),
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return new Response(JSON.stringify({
        player: [
          {
            idPlayer: "34153733",
            strPlayer: "LeBron James",
            strSport: "Basketball",
            strTeam: "Los Angeles Lakers",
            strPosition: "Small Forward",
            strNationality: "United States"
          },
          { strPlayer: "A non-basketball result", strSport: "Soccer" }
        ]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  }).listen(0);

  try {
    await new Promise((resolve) => playerServer.once("listening", resolve));
    const base = `http://127.0.0.1:${playerServer.address().port}`;
    const response = await fetch(`${base}/api/players?q=LeBron%20James`);
    assert.equal(response.status, 200);
    assert.equal(requestedUrl.searchParams.get("p"), "LeBron James");
    assert.deepEqual(await response.json(), [{
      id: "34153733",
      name: "LeBron James",
      team: "Los Angeles Lakers",
      position: "Small Forward",
      nationality: "United States"
    }]);

    const shortQuery = await fetch(`${base}/api/players?q=A`);
    assert.equal(shortQuery.status, 400);
  } finally {
    await new Promise((resolve, reject) => playerServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("reports player search service failures", async () => {
  const playerServer = createApp({
    dataFile: path.join(directory, "players-failure.json"),
    fetchImpl: async () => new Response("unavailable", { status: 503 })
  }).listen(0);

  try {
    await new Promise((resolve) => playerServer.once("listening", resolve));
    const response = await fetch(`http://127.0.0.1:${playerServer.address().port}/api/players?q=Jordan`);
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /HTTP 503/);
  } finally {
    await new Promise((resolve, reject) => playerServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("validates post and comment input, then returns comments in chronological order", async () => {
  const invalidPost = await postJson("/api/posts", { content: "  " });
  assert.equal(invalidPost.status, 400);

  const postResponse = await postJson("/api/posts", {
    title: "Comment test",
    category: "Other",
    content: "A post for comment validation."
  });
  const post = await postResponse.json();
  const invalidComment = await postJson(`/api/posts/${post.id}/comments`, { content: "   " });
  assert.equal(invalidComment.status, 400);

  const commentResponse = await postJson(`/api/posts/${post.id}/comments`, {
    name: "",
    content: "Great story!"
  });
  assert.equal(commentResponse.status, 201);
  const comment = await commentResponse.json();
  assert.equal(comment.name, "Anonymous");
  const commentsResponse = await fetch(`${baseUrl}/api/posts/${post.id}/comments`);
  const comments = await commentsResponse.json();
  assert.equal(comments.length, 1);
  assert.equal(comments[0].content, "Great story!");
});

test("reports missing posts and leaves corrupted data unchanged", async () => {
  const missing = await fetch(`${baseUrl}/api/posts/post_missing`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "Post not found.");

  const corruptFile = path.join(directory, "corrupt.json");
  await fs.writeFile(corruptFile, "{this is not valid json");
  const corruptServer = createApp({ dataFile: corruptFile }).listen(0);
  await new Promise((resolve) => corruptServer.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${corruptServer.address().port}/api/posts`);
    assert.equal(response.status, 500);
    assert.equal(await fs.readFile(corruptFile, "utf8"), "{this is not valid json");
  } finally {
    await new Promise((resolve, reject) => corruptServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("serves the three community pages and returns a real 404 for unknown pages", async () => {
  for (const page of ["/", "/create.html", "/post.html"]) {
    const response = await fetch(`${baseUrl}${page}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    if (page === "/") {
      assert.match(await response.text(), /id="player-search-form"/);
    }
  }
  const missingPage = await fetch(`${baseUrl}/not-a-page`);
  assert.equal(missingPage.status, 404);
  assert.match(await missingPage.text(), /This page missed/);
  const htmlPages = (await fs.readdir(path.join(__dirname, "..", "public")))
    .filter((file) => file.endsWith(".html"));
  assert.equal(htmlPages.length, 3);
});

test("stores posts and comments in browser storage across page loads", async () => {
  const source = await fs.readFile(path.join(__dirname, "../public/js/shared.js"), "utf8");
  const values = new Map();
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value)
  };
  const loadCourtside = () => {
    const window = {
      localStorage: storage,
      crypto: { randomUUID: () => `${values.size + 1}` }
    };
    vm.runInNewContext(source, {
      document: { querySelector: () => null },
      window,
      Date,
      Intl,
      Math
    });
    return window.Courtside;
  };

  const firstPage = loadCourtside();
  const post = firstPage.createPost({ name: "Sam", content: "A game-day story" });
  firstPage.addComment(post.id, { name: "Lee", content: "Great story!" });

  const reloadedPage = loadCourtside();
  assert.equal(reloadedPage.getPosts().length, 1);
  assert.equal(reloadedPage.getPost(post.id).comments[0].content, "Great story!");
});
