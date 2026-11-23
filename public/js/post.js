document.addEventListener("DOMContentLoaded", () => {
  const id = new URLSearchParams(window.location.search).get("id");
  const status = document.getElementById("post-status");
  const article = document.getElementById("post-detail");
  const discussion = document.getElementById("discussion");
  const commentForm = document.getElementById("comment-form");
  const commentMessage = document.getElementById("comment-message");
  const commentStatus = document.getElementById("comments-status");
  const commentsList = document.getElementById("comments-list");
  let post;

  function renderComments(comments) {
    commentsList.replaceChildren();
    document.getElementById("comment-count").textContent = String(comments.length);
    if (!comments.length) {
      commentStatus.textContent = "No comments yet. Be the first to comment.";
      commentStatus.classList.remove("hidden");
      return;
    }
    commentStatus.classList.add("hidden");
    comments.forEach((comment) => {
      const item = document.createElement("li");
      item.className = "comment-item";
      const head = document.createElement("div");
      head.className = "comment-head";
      const author = document.createElement("span");
      author.className = "comment-author";
      const avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.textContent = Courtside.initials(comment.name);
      const name = document.createElement("strong");
      name.textContent = comment.name || "Anonymous";
      author.append(avatar, name);
      const date = document.createElement("time");
      date.textContent = Courtside.formatDate(comment.createdAt);
      date.dateTime = comment.createdAt;
      head.append(author, date);
      const content = document.createElement("p");
      content.textContent = comment.content;
      item.append(head, content);
      commentsList.append(item);
    });
  }

  function loadComments() {
    renderComments(post.comments || []);
  }

  function loadPost() {
    if (!id) {
      status.textContent = "No story was selected. Head back to the feed to choose one.";
      status.classList.add("error");
      return;
    }
    try {
      post = Courtside.getPost(id);
      if (!post) throw new Error("Post not found in this browser.");
      document.title = `${post.title} — Courtside`;
      document.getElementById("detail-date").textContent = Courtside.formatDate(post.createdAt);
      document.getElementById("detail-title").textContent = post.title;
      document.getElementById("detail-author").textContent = post.name || "Anonymous";
      document.getElementById("detail-avatar").textContent = Courtside.initials(post.name);
      document.getElementById("detail-content").textContent = post.content;
      status.classList.add("hidden");
      article.hidden = false;
      discussion.hidden = false;
      loadComments();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    }
  }

  commentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!post || !commentForm.reportValidity()) return;
    const button = commentForm.querySelector('button[type="submit"]');
    button.disabled = true;
    document.getElementById("comment-submit-label").textContent = "Adding…";
    commentMessage.textContent = "";
    commentMessage.className = "form-message";
    const formData = new FormData(commentForm);
    try {
      Courtside.addComment(id, {
        name: formData.get("name"),
        content: formData.get("content")
      });
      post = Courtside.getPost(id);
      commentForm.reset();
      commentMessage.textContent = "Your comment is in. The huddle is updated.";
      commentMessage.classList.add("success");
      loadComments();
    } catch (error) {
      commentMessage.textContent = error.message;
      commentMessage.classList.add("error");
    } finally {
      button.disabled = false;
      document.getElementById("comment-submit-label").textContent = "Post comment";
    }
  });

  loadPost();
});
