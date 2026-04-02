import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
  limit,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9ExkvPG4FcTPm155x3j_8UM58VFF9NmU",
  authDomain: "mal3abna-app.firebaseapp.com",
  projectId: "mal3abna-app",
  storageBucket: "mal3abna-app.firebasestorage.app",
  messagingSenderId: "404906328881",
  appId: "1:404906328881:web:27f89e188053799e1f6610"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortByCreatedAtDesc(items = []) {
  return [...items].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

function sortByCreatedAtAsc(items = []) {
  return [...items].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
}

function getScopedAppStateId(sessionId, key) {
  return `${key}_${sessionId}`;
}

async function waitForAuthUser() {
  if (auth.currentUser) return auth.currentUser;

  return await new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        reject(new Error("User is not authenticated."));
      }
    }, reject);
  });
}

async function ensureUserSession() {
  const user = await waitForAuthUser();
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  const normalizedUserEmail = normalizeEmail(user.email || "");

  if (userSnap.exists()) {
    const data = userSnap.data() || {};
    const personalSessionId = data.personalSessionId || "";
    const currentSessionId = data.currentSessionId || personalSessionId || "";

    if (personalSessionId && currentSessionId) {
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email || "",
          normalizedEmail: normalizedUserEmail,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      return currentSessionId;
    }
  }

  const newSessionRef = doc(collection(db, "sessions"));
  const newSessionId = newSessionRef.id;

  await setDoc(newSessionRef, {
    ownerId: user.uid,
    ownerEmail: user.email || "",
    memberIds: [user.uid],
    memberEmails: normalizedUserEmail ? [normalizedUserEmail] : [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: user.email || "",
      normalizedEmail: normalizedUserEmail,
      personalSessionId: newSessionId,
      currentSessionId: newSessionId,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return newSessionId;
}

async function getCurrentSessionId() {
  const user = await waitForAuthUser();
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return await ensureUserSession();
  }

  const data = userSnap.data() || {};
  if (data.currentSessionId) return data.currentSessionId;

  return await ensureUserSession();
}

async function getCurrentUserProfile() {
  const user = await waitForAuthUser();
  const userSnap = await getDoc(doc(db, "users", user.uid));
  return userSnap.exists() ? { uid: user.uid, ...userSnap.data() } : null;
}

async function getCurrentSessionInfo() {
  const sessionId = await getCurrentSessionId();
  const sessionSnap = await getDoc(doc(db, "sessions", sessionId));

  if (!sessionSnap.exists()) {
    return null;
  }

  return {
    id: sessionSnap.id,
    ...sessionSnap.data()
  };
}

async function createInviteForEmail(email) {
  const user = await waitForAuthUser();
  const sessionId = await getCurrentSessionId();
  const invitedEmail = normalizeEmail(email);

  if (!invitedEmail) {
    throw new Error("Please enter an email address.");
  }

  if (invitedEmail === normalizeEmail(user.email || "")) {
    throw new Error("You cannot invite your own email.");
  }

  const existingQuery = query(
    collection(db, "invites"),
    where("sessionId", "==", sessionId),
    where("invitedEmail", "==", invitedEmail),
    where("status", "==", "pending"),
    limit(1)
  );

  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    throw new Error("That email already has a pending invite.");
  }

  const inviteRef = await addDoc(collection(db, "invites"), {
    sessionId,
    invitedEmail,
    invitedByUid: user.uid,
    invitedByEmail: user.email || "",
    status: "pending",
    createdAt: serverTimestamp()
  });

  return inviteRef.id;
}

async function getPendingInvitesForCurrentUser() {
  const user = await waitForAuthUser();
  const normalizedUserEmail = normalizeEmail(user.email || "");

  if (!normalizedUserEmail) return [];

  const invitesQuery = query(
    collection(db, "invites"),
    where("invitedEmail", "==", normalizedUserEmail),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(invitesQuery);

  return sortByCreatedAtDesc(
    snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
  );
}

async function acceptInvite(inviteId) {
  const user = await waitForAuthUser();
  const inviteRef = doc(db, "invites", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invite not found.");
  }

  const invite = inviteSnap.data() || {};
  const normalizedUserEmail = normalizeEmail(user.email || "");

  if (invite.status !== "pending") {
    throw new Error("This invite is no longer pending.");
  }

  if (invite.invitedEmail !== normalizedUserEmail) {
    throw new Error("This invite does not belong to your account.");
  }

  const sessionId = invite.sessionId;
  const sessionRef = doc(db, "sessions", sessionId);

  await setDoc(
    sessionRef,
    {
      memberIds: arrayUnion(user.uid),
      memberEmails: arrayUnion(normalizedUserEmail),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      email: user.email || "",
      normalizedEmail: normalizedUserEmail,
      currentSessionId: sessionId,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await setDoc(
    inviteRef,
    {
      status: "accepted",
      acceptedByUid: user.uid,
      acceptedAt: serverTimestamp()
    },
    { merge: true }
  );

  return sessionId;
}

export {
  db,
  auth,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
  limit,
  arrayUnion,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  normalizeEmail,
  toMillis,
  sortByCreatedAtDesc,
  sortByCreatedAtAsc,
  waitForAuthUser,
  ensureUserSession,
  getCurrentSessionId,
  getCurrentUserProfile,
  getCurrentSessionInfo,
  getScopedAppStateId,
  createInviteForEmail,
  getPendingInvitesForCurrentUser,
  acceptInvite
};