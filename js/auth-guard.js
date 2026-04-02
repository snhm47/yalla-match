import { auth, onAuthStateChanged, ensureUserSession } from "./firebase.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  try {
    await ensureUserSession();
  } catch (error) {
    console.error("Failed to initialize workspace:", error);
    window.location.href = "auth.html";
  }
});