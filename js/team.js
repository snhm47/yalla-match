import {
  db,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  query,
  orderBy,
  serverTimestamp
} from "./firebase.js";

const splitModeSelect = document.getElementById("splitMode");
const generateTeamsBtn = document.getElementById("generateTeamsBtn");
const startMatchBtn = document.getElementById("startMatchBtn");
const teamAList = document.getElementById("teamAList");
const teamBList = document.getElementById("teamBList");
const teamARating = document.getElementById("teamARating");
const teamBRating = document.getElementById("teamBRating");
const fairnessValue = document.getElementById("fairnessValue");
const teamsMessage = document.getElementById("teamsMessage");

async function getPlayers() {
  const q = query(collection(db, "players"), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

function shuffle(array) {
  const cloned = [...array];
  for (let i = cloned.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function calculateTeamRating(team) {
  return team.reduce((sum, player) => sum + Number(player.rating), 0);
}

function calculateFairness(teamA, teamB) {
  const ratingA = calculateTeamRating(teamA);
  const ratingB = calculateTeamRating(teamB);
  const maxRating = Math.max(ratingA, ratingB);
  const minRating = Math.min(ratingA, ratingB);
  if (maxRating === 0) return 100;
  return Math.round((minRating / maxRating) * 100);
}

function generateRandomTeams(players) {
  const shuffled = shuffle(players);
  const half = Math.ceil(shuffled.length / 2);
  return {
    teamA: shuffled.slice(0, half),
    teamB: shuffled.slice(half)
  };
}

function generateBalancedTeams(players) {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const teamA = [];
  const teamB = [];
  let ratingA = 0;
  let ratingB = 0;

  sorted.forEach((player) => {
    if (ratingA <= ratingB) {
      teamA.push(player);
      ratingA += player.rating;
    } else {
      teamB.push(player);
      ratingB += player.rating;
    }
  });

  return { teamA, teamB };
}

function renderTeam(listElement, team) {
  listElement.innerHTML = "";

  if (team.length === 0) {
    listElement.innerHTML = `<div class="empty-state">No players</div>`;
    return;
  }

  team.forEach((player) => {
    const item = document.createElement("div");
    item.className = "team-player";
    item.innerHTML = `
      <strong>${player.name}</strong>
      <div class="player-meta">Rating: ${player.rating} | Position: ${player.position}</div>
    `;
    listElement.appendChild(item);
  });
}

async function generateTeams() {
  const players = await getPlayers();

  if (players.length < 2) {
    teamsMessage.textContent = "Add at least 2 players first.";
    return;
  }

  const mode = splitModeSelect.value;
  const result = mode === "balanced"
    ? generateBalancedTeams(players)
    : generateRandomTeams(players);

  const ratingA = calculateTeamRating(result.teamA);
  const ratingB = calculateTeamRating(result.teamB);
  const fairness = calculateFairness(result.teamA, result.teamB);

  renderTeam(teamAList, result.teamA);
  renderTeam(teamBList, result.teamB);
  teamARating.textContent = ratingA;
  teamBRating.textContent = ratingB;
  fairnessValue.textContent = `${fairness}%`;

  await setDoc(doc(db, "appState", "currentTeams"), {
    teamA: { name: "Team A", players: result.teamA, rating: ratingA },
    teamB: { name: "Team B", players: result.teamB, rating: ratingB },
    fairness,
    updatedAt: serverTimestamp()
  });

  teamsMessage.textContent = "Teams generated successfully.";
}

async function saveTeamsAndStartMatch() {
  const snap = await getDoc(doc(db, "appState", "currentTeams"));
  if (!snap.exists()) {
    teamsMessage.textContent = "Generate teams first.";
    return;
  }

  const teams = snap.data();

  await setDoc(doc(db, "appState", "currentMatch"), {
    date: new Date().toISOString(),
    teamA: {
      name: teams.teamA.name,
      players: teams.teamA.players,
      score: 0
    },
    teamB: {
      name: teams.teamB.name,
      players: teams.teamB.players,
      score: 0
    },
    events: [],
    updatedAt: serverTimestamp()
  });

  window.location.href = "match.html";
}

async function loadExistingTeams() {
  const snap = await getDoc(doc(db, "appState", "currentTeams"));
  if (!snap.exists()) return;

  const teams = snap.data();
  renderTeam(teamAList, teams.teamA.players);
  renderTeam(teamBList, teams.teamB.players);
  teamARating.textContent = teams.teamA.rating;
  teamBRating.textContent = teams.teamB.rating;
  fairnessValue.textContent = `${teams.fairness}%`;
}

generateTeamsBtn.addEventListener("click", generateTeams);
startMatchBtn.addEventListener("click", saveTeamsAndStartMatch);

loadExistingTeams();