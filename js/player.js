import {
  db,
  getDoc,
  getDocs,
  doc,
  collection,
  query,
  orderBy
} from "./firebase.js";

const playerNameTitle = document.getElementById("playerNameTitle");
const playerBasicInfo = document.getElementById("playerBasicInfo");
const statMatches = document.getElementById("statMatches");
const statGoals = document.getElementById("statGoals");
const statWins = document.getElementById("statWins");
const statLosses = document.getElementById("statLosses");
const statDraws = document.getElementById("statDraws");
const recentMatchesEmpty = document.getElementById("recentMatchesEmpty");
const recentMatchesList = document.getElementById("recentMatchesList");

function getPlayerIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function getPlayer(playerId) {
  const snap = await getDoc(doc(db, "players", playerId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function getMatches() {
  const q = query(collection(db, "matches"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

function playerWasInMatch(match, playerId) {
  const inTeamA = (match.teamA?.players || []).some((p) => p.id === playerId);
  const inTeamB = (match.teamB?.players || []).some((p) => p.id === playerId);
  return inTeamA || inTeamB;
}

function renderPlayerInfo(player) {
  const stats = player.stats || {
    matchesPlayed: 0,
    goals: 0,
    wins: 0,
    losses: 0,
    draws: 0
  };

  playerNameTitle.textContent = player.name;
  playerBasicInfo.textContent = `Rating: ${player.rating} | Position: ${player.position || "No position"}`;

  statMatches.textContent = stats.matchesPlayed || 0;
  statGoals.textContent = stats.goals || 0;
  statWins.textContent = stats.wins || 0;
  statLosses.textContent = stats.losses || 0;
  statDraws.textContent = stats.draws || 0;
}

function renderRecentMatches(matches, playerId) {
  recentMatchesList.innerHTML = "";

  const playerMatches = matches.filter((match) => playerWasInMatch(match, playerId)).slice(0, 10);

  if (!playerMatches.length) {
    recentMatchesEmpty.style.display = "block";
    return;
  }

  recentMatchesEmpty.style.display = "none";

  playerMatches.forEach((match) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const teamAScore = match.teamA?.score ?? 0;
    const teamBScore = match.teamB?.score ?? 0;
    const leagueText = match.leagueName ? `League: ${match.leagueName}` : "Friendly Match";

    item.innerHTML = `
      <strong>${match.teamA?.name || "Team A"} ${teamAScore} - ${teamBScore} ${match.teamB?.name || "Team B"}</strong>
      <div class="player-meta">${leagueText}</div>
      <div class="player-meta">${new Date(match.date || Date.now()).toLocaleString()}</div>
    `;

    recentMatchesList.appendChild(item);
  });
}

async function initPlayerPage() {
  const playerId = getPlayerIdFromUrl();

  if (!playerId) {
    playerNameTitle.textContent = "Player not found";
    playerBasicInfo.textContent = "Missing player id.";
    return;
  }

  const player = await getPlayer(playerId);

  if (!player) {
    playerNameTitle.textContent = "Player not found";
    playerBasicInfo.textContent = "This player does not exist.";
    return;
  }

  renderPlayerInfo(player);

  const matches = await getMatches();
  renderRecentMatches(matches, playerId);
}

initPlayerPage();