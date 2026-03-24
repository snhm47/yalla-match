import { auth, onAuthStateChanged, signOut } from "./firebase.js";

function ensureAuthBar() {
  let authBar = document.getElementById("authBar");

  if (!authBar) {
    authBar = document.createElement("div");
    authBar.id = "authBar";
    authBar.className = "container";
    authBar.style.display = "flex";
    authBar.style.justifyContent = "space-between";
    authBar.style.alignItems = "center";
    authBar.style.gap = "12px";
    authBar.style.padding = "10px 0";

    const left = document.createElement("div");
    left.id = "authBarUser";
    left.className = "player-meta";

    const right = document.createElement("button");
    right.id = "logoutBtn";
    right.className = "btn btn-danger";
    right.type = "button";
    right.textContent = "Logout";

    authBar.appendChild(left);
    authBar.appendChild(right);

    document.body.insertBefore(authBar, document.body.firstChild);

    right.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "auth.html";
    });
  }

  return authBar;
}

onAuthStateChanged(auth, (user) => {
  const authBar = ensureAuthBar();
  const authBarUser = authBar.querySelector("#authBarUser");

  if (user) {
    authBarUser.textContent = `Logged in as: ${user.email || "User"}`;
  } else {
    window.location.href = "auth.html";
  }
});