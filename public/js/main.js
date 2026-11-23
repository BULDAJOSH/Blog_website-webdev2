document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("post-grid");
  const status = document.getElementById("feed-status");
  const playerForm = document.getElementById("player-search-form");
  const playerInput = document.getElementById("player-search-input");
  const playerStatus = document.getElementById("player-search-status");
  const playerResults = document.getElementById("player-results");
  const playerSearchLabel = document.getElementById("player-search-label");
  let posts = [];

  function makeCard(post) {
    const card = document.createElement("a");
    card.className = "post-card";
    card.href = `./post.html?id=${encodeURIComponent(post.id)}`;

    const top = document.createElement("div");
    top.className = "card-topline";
    const date = document.createElement("time");
    date.textContent = Courtside.formatDate(post.createdAt);
    date.dateTime = post.createdAt;
    top.append(date);

    const title = document.createElement("h3");
    title.textContent = post.title;
    const excerpt = document.createElement("p");
    excerpt.className = "card-excerpt";
    excerpt.textContent = post.content;
    const footer = document.createElement("div");
    footer.className = "card-footer";
    const author = document.createElement("span");
    author.innerHTML = '<span class="avatar"></span><span></span>';
    author.querySelector(".avatar").textContent = Courtside.initials(post.name);
    author.lastElementChild.textContent = post.name || "Anonymous";
    const comments = document.createElement("span");
    comments.className = "comment-indicator";
    comments.textContent = `${(post.comments || []).length} ${(post.comments || []).length === 1 ? "comment" : "comments"}  ↗`;
    footer.append(author, comments);
    card.append(top, title, excerpt, footer);
    return card;
  }

  function render() {
    grid.replaceChildren();
    if (!posts.length) {
      status.textContent = "No posts yet. Be the first to write one.";
      status.classList.remove("hidden");
      return;
    }
    status.classList.add("hidden");
    posts.forEach((post) => grid.append(makeCard(post)));
  }

  function loadPosts() {
    try {
      posts = Courtside.getPosts();
      render();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    }
  }

  playerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!playerForm.reportValidity()) return;

    const query = playerInput.value.trim();
    playerResults.replaceChildren();
    playerStatus.textContent = "Searching players…";
    playerStatus.classList.remove("error");
    const button = playerForm.querySelector('button[type="submit"]');
    button.disabled = true;
    playerSearchLabel.textContent = "Searching…";

    try {
      const url = new URL("https://www.thesportsdb.com/api/v1/json/123/searchplayers.php");
      url.searchParams.set("p", query);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Player search returned HTTP ${response.status}.`);
      const payload = await response.json();
      if (!payload || (payload.player !== null && !Array.isArray(payload.player))) {
        throw new Error("The player search service returned unexpected data.");
      }
      const players = (payload.player || [])
        .filter((player) => player && player.strSport === "Basketball" && typeof player.strPlayer === "string")
        .map((player) => ({
          name: player.strPlayer.trim(),
          team: typeof player.strTeam === "string" ? player.strTeam : "",
          position: typeof player.strPosition === "string" ? player.strPosition : "",
          nationality: typeof player.strNationality === "string" ? player.strNationality : ""
        }))
        .filter((player) => player.name);
      if (!players.length) {
        playerStatus.textContent = "No basketball players found. Try another name.";
        return;
      }

      playerStatus.textContent = `${players.length} player${players.length === 1 ? "" : "s"} found.`;
      players.forEach((player) => {
        const item = document.createElement("li");
        item.className = "player-result";
        const name = document.createElement("h3");
        name.textContent = player.name;
        const details = [player.team, player.position, player.nationality].filter(Boolean);
        const description = document.createElement("p");
        description.textContent = details.join(" · ") || "Player details unavailable.";
        item.append(name, description);
        playerResults.append(item);
      });
    } catch (error) {
      playerStatus.textContent = error.message;
      playerStatus.classList.add("error");
    } finally {
      button.disabled = false;
      playerSearchLabel.textContent = "Search";
    }
  });

  loadPosts();
});
