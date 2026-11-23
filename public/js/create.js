document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("post-form");
  const message = document.getElementById("form-message");
  const thoughts = document.getElementById("thoughts");
  const name = document.getElementById("display-name");
  thoughts.addEventListener("input", () => {
    document.getElementById("thought-count").textContent = String(thoughts.value.length);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    message.textContent = "";
    message.className = "form-message";
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    document.getElementById("submit-label").textContent = "Publishing…";
    const body = {
      name: name.value,
      content: thoughts.value
    };
    try {
      const post = Courtside.createPost(body);
      message.textContent = "Your post is live. Opening its comments…";
      message.classList.add("success");
      window.setTimeout(() => {
        window.location.assign(`./post.html?id=${encodeURIComponent(post.id)}`);
      }, 900);
    } catch (error) {
      message.textContent = error.message;
      message.classList.add("error");
      button.disabled = false;
      document.getElementById("submit-label").textContent = "Publish post";
    }
  });
});
