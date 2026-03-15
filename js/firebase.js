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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9ExkvPG4FcTPm155x3j_8UM58VFF9NmU",
  authDomain: "mal3abna-app.firebaseapp.com",
  projectId: "mal3abna-app",
  storageBucket: "mal3abna-app.firebasestorage.app",
  messagingSenderId: "404906328881",
  appId: "1:404906328881:web:27f89e188053799e1f6610",
  measurementId: "G-GTJ2R99ZKS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
  db,
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
  serverTimestamp
};