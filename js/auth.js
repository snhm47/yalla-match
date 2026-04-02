import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  ensureUserSession
} from "./firebase.js";

const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const rememberMe = document.getElementById("rememberMe");

const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authMessage = document.getElementById("authMessage");

const toggleText = document.getElementById("toggleText");
const toggleModeBtn = document.getElementById("toggleModeBtn");

let isLoginMode = true;

function getInviteIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("invite") || "";
}

function getRedirectAfterAuth() {
  const inviteId = getInviteIdFromUrl();
  return inviteId
    ? `invites.html?invite=${encodeURIComponent(inviteId)}`
    : "index.html";
}

function updateModeUI() {
  if (isLoginMode) {
    authTitle.textContent = "Login";
    authSubtitle.textContent = getInviteIdFromUrl()
      ? "Login to accept your invite and join the shared workspace."
      : "Enter your account to continue to Yala Match.";
    authSubmitBtn.textContent = "Login";
    toggleText.textContent = "Don't have an account?";
    toggleModeBtn.textContent = "Create Account";
  } else {
    authTitle.textContent = "Sign Up";
    authSubtitle.textContent = getInviteIdFromUrl()
      ? "Create your account to accept the invite and join the shared workspace."
      : "Create your account and enter Yala Match.";
    authSubmitBtn.textContent = "Sign Up";
    toggleText.textContent = "Already have an account?";
    toggleModeBtn.textContent = "Login";
  }

  authMessage.textContent = "";
}

function getReadableError(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already in use.";
    case "auth/invalid-email":
      return "The email address is not valid.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return error?.message || "Something went wrong.";
  }
}

async function applySelectedPersistence() {
  const selected = rememberMe.value;

  if (selected === "session") {
    await setPersistence(auth, browserSessionPersistence);
    return;
  }

  await setPersistence(auth, browserLocalPersistence);
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    authMessage.textContent = "Please fill in email and password.";
    return;
  }

  try {
    authMessage.textContent = "Please wait...";
    await applySelectedPersistence();

    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }

    await ensureUserSession();
    window.location.href = getRedirectAfterAuth();
  } catch (error) {
    authMessage.textContent = getReadableError(error);
  }
}

toggleModeBtn.addEventListener("click", () => {
  isLoginMode = !isLoginMode;
  updateModeUI();
});

authForm.addEventListener("submit", handleAuthSubmit);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      await ensureUserSession();
      window.location.href = getRedirectAfterAuth();
    } catch (error) {
      console.error("Failed to prepare user session:", error);
    }
  }
});

updateModeUI();