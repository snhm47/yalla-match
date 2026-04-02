import {
  auth,
  onAuthStateChanged,
  ensureUserSession,
  createInviteForEmail,
  getPendingInvitesForCurrentUser,
  acceptInvite,
  getCurrentUserProfile,
  getCurrentSessionInfo,
  getDoc,
  doc,
  db
} from "./firebase.js";

const EMAILJS_PUBLIC_KEY = "IXCeF8_G4cNyxgVeI";
const EMAILJS_SERVICE_ID = "service_iq1qyvy";
const EMAILJS_TEMPLATE_ID = "invite_friend_real";

const APP_NAME = "Yala Match";
const APP_BASE_URL = "https://yalla-match-delta.vercel.app";

const workspaceModeText = document.getElementById("workspaceModeText");
const workspaceOwnerText = document.getElementById("workspaceOwnerText");
const workspaceIdText = document.getElementById("workspaceIdText");

const inviteEmailInput = document.getElementById("inviteEmailInput");
const sendInviteBtn = document.getElementById("sendInviteBtn");
const inviteMessage = document.getElementById("inviteMessage");

const pendingInvitesList = document.getElementById("pendingInvitesList");
const pendingInvitesEmpty = document.getElementById("pendingInvitesEmpty");

let emailJsInitialized = false;
let autoAcceptTried = false;

function getInviteIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("invite") || "";
}

function setInviteMessage(message, isError = false) {
  if (!inviteMessage) return;
  inviteMessage.textContent = message || "";
  inviteMessage.style.color = isError ? "red" : "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ensureEmailJsConfigured() {
  if (!window.emailjs) {
    throw new Error("EmailJS script did not load.");
  }

  if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) {
    throw new Error("EmailJS configuration is missing.");
  }

  if (!emailJsInitialized) {
    window.emailjs.init({
      publicKey: EMAILJS_PUBLIC_KEY,
      blockHeadless: true,
      limitRate: {
        id: "invite-email",
        throttle: 1500
      }
    });
    emailJsInitialized = true;
  }
}

function createInviteCard(invite) {
  const item = document.createElement("div");
  item.className = "history-item";
  item.style.display = "flex";
  item.style.justifyContent = "space-between";
  item.style.alignItems = "center";
  item.style.gap = "12px";
  item.style.flexWrap = "wrap";

  item.innerHTML = `
    <div>
      <strong>${invite.invitedByEmail || "Unknown sender"}</strong>
      <div class="player-meta">Invited you to join a shared workspace.</div>
    </div>
    <button class="btn btn-primary" type="button">Accept</button>
  `;

  const btn = item.querySelector("button");

  btn.addEventListener("click", async () => {
    try {
      btn.disabled = true;
      btn.textContent = "Accepting...";
      await acceptInvite(invite.id);
      setInviteMessage("Invite accepted. You are now inside the shared workspace.");
      await renderInvitesPage();
      window.location.href = "index.html";
    } catch (error) {
      setInviteMessage(error?.message || "Failed to accept invite.", true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Accept";
    }
  });

  return item;
}

async function renderWorkspaceInfo() {
  const [profile, sessionInfo] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentSessionInfo()
  ]);

  workspaceModeText.textContent = "Workspace";
  workspaceOwnerText.textContent = sessionInfo?.ownerEmail || "Unknown";
  workspaceIdText.textContent = profile?.currentSessionId?.slice(0, 8) || "N/A";
}

async function renderPendingInvites() {
  const invites = await getPendingInvitesForCurrentUser();

  pendingInvitesList.innerHTML = "";

  if (!invites.length) {
    pendingInvitesEmpty.style.display = "block";
    return;
  }

  pendingInvitesEmpty.style.display = "none";

  invites.forEach((invite) => {
    pendingInvitesList.appendChild(createInviteCard(invite));
  });
}

async function tryAutoAcceptInviteFromUrl() {
  const inviteId = getInviteIdFromUrl();

  if (!inviteId || autoAcceptTried) return;
  autoAcceptTried = true;

  const inviteSnap = await getDoc(doc(db, "invites", inviteId));

  if (!inviteSnap.exists()) {
    setInviteMessage("Invite was not found.", true);
    return;
  }

  const invite = inviteSnap.data() || {};
  const currentUserEmail = auth.currentUser?.email || "";

  if (invite.status !== "pending") {
    setInviteMessage("This invite is no longer pending.");
    return;
  }

  if (invite.invitedEmail !== currentUserEmail) {
    setInviteMessage(
      `This invite belongs to ${invite.invitedEmail || "another email"}. Please log in with that exact email.`,
      true
    );
    return;
  }

  setInviteMessage("Accepting your invite automatically...");

  await acceptInvite(inviteId);
  setInviteMessage("Invite accepted. You are now inside the shared workspace.");

  await renderInvitesPage();

  setTimeout(() => {
    window.location.href = "index.html";
  }, 800);
}

async function sendRealInviteEmail(recipientEmail, sessionInfo, inviteId) {
  ensureEmailJsConfigured();

  const invitedByEmail = auth.currentUser?.email || "Unknown";
  const inviteLink = `${APP_BASE_URL}/auth.html?invite=${encodeURIComponent(inviteId)}`;

  const templateParams = {
    recipient_email: recipientEmail,
    invited_by_email: invitedByEmail,
    workspace_owner: sessionInfo?.ownerEmail || invitedByEmail,
    invite_link: inviteLink,
    app_name: APP_NAME
  };

  return await window.emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    templateParams
  );
}

async function renderInvitesPage() {
  await renderWorkspaceInfo();
  await renderPendingInvites();
}

sendInviteBtn?.addEventListener("click", async () => {
  const email = inviteEmailInput.value.trim();

  if (!email) {
    setInviteMessage("Please enter an email address.", true);
    return;
  }

  if (!isValidEmail(email)) {
    setInviteMessage("Please enter a valid email address.", true);
    return;
  }

  try {
    sendInviteBtn.disabled = true;
    sendInviteBtn.textContent = "Sending...";
    setInviteMessage("Creating invite...");

    const inviteId = await createInviteForEmail(email);
    const sessionInfo = await getCurrentSessionInfo();

    await sendRealInviteEmail(email, sessionInfo, inviteId);

    inviteEmailInput.value = "";
    setInviteMessage(`Invite created and email sent to ${email} successfully.`);
    await renderInvitesPage();
  } catch (error) {
    console.error("Invite/email error:", error);
    setInviteMessage(
      error?.text || error?.message || "Could not send invite email.",
      true
    );
  } finally {
    sendInviteBtn.disabled = false;
    sendInviteBtn.textContent = "Send Real Invite Email";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const inviteId = getInviteIdFromUrl();
    window.location.href = inviteId
      ? `auth.html?invite=${encodeURIComponent(inviteId)}`
      : "auth.html";
    return;
  }

  try {
    await ensureUserSession();
    ensureEmailJsConfigured();
    await renderInvitesPage();
    await tryAutoAcceptInviteFromUrl();
  } catch (error) {
    console.error("Failed to initialize invites page:", error);
    setInviteMessage(error?.message || "Failed to load invites page.", true);
  }
});