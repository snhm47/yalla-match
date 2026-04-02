import {
  auth,
  onAuthStateChanged,
  signOut,
  ensureUserSession,
  getCurrentSessionInfo,
  getCurrentUserProfile
} from "./firebase.js";

function ensureHeaderWorkspaceUi() {
  const headerRow = document.querySelector(".site-header .header-row");
  if (!headerRow) return null;

  let wrapper = document.getElementById("workspaceHeaderTools");
  if (wrapper) return wrapper;

  wrapper = document.createElement("div");
  wrapper.id = "workspaceHeaderTools";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "10px";
  wrapper.style.flexWrap = "wrap";
  wrapper.style.marginTop = "10px";

  const workspaceBadge = document.createElement("div");
  workspaceBadge.id = "workspaceHeaderBadge";
  workspaceBadge.style.padding = "8px 12px";
  workspaceBadge.style.borderRadius = "999px";
  workspaceBadge.style.background = "rgba(255,255,255,0.12)";
  workspaceBadge.style.color = "#fff";
  workspaceBadge.style.fontSize = "0.92rem";
  workspaceBadge.textContent = "Workspace: Loading...";

  const inviteLink = document.createElement("a");
  inviteLink.href = "invites.html";
  inviteLink.textContent = "Invite Friend";
  inviteLink.className = "btn btn-success";
  inviteLink.style.textDecoration = "none";

  const logoutBtn = document.createElement("button");
  logoutBtn.className = "btn btn-danger";
  logoutBtn.textContent = "Logout";

  wrapper.appendChild(workspaceBadge);
  wrapper.appendChild(inviteLink);
  wrapper.appendChild(logoutBtn);

  const titleBlock = headerRow.firstElementChild;
  if (titleBlock) {
    titleBlock.appendChild(wrapper);
  } else {
    headerRow.appendChild(wrapper);
  }

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "auth.html";
  });

  return wrapper;
}

async function refreshHeaderWorkspaceUi() {
  ensureHeaderWorkspaceUi();

  const badge = document.getElementById("workspaceHeaderBadge");

  const [profile, sessionInfo] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentSessionInfo()
  ]);

  const ownerEmail = sessionInfo?.ownerEmail || "Unknown";

  badge.textContent = `Workspace: ${ownerEmail}`;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const existing = document.getElementById("workspaceHeaderTools");
    if (existing) existing.remove();
    return;
  }

  try {
    await ensureUserSession();
    await refreshHeaderWorkspaceUi();
  } catch (error) {
    console.error(error);
  }
});