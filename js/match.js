import {
  db,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  doc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "./firebase.js";

const matchTeamAName = document.getElementById("matchTeamAName");
const matchTeamBName = document.getElementById("matchTeamBName");
const teamAScoreEl = document.getElementById("teamAScore");
const teamBScoreEl = document.getElementById("teamBScore");
const goalForm = document.getElementById("goalForm");
const goalTeamSelect = document.getElementById("goalTeam");
const goalScorerSelect = document.getElementById("goalScorer");
const goalMinuteInput = document.getElementById("goalMinute");
const timelineList = document.getElementById("timelineList");
const timelineEmptyState = document.getElementById("timelineEmptyState");
const undoEventBtn = document.getElementById("undoEventBtn");
const endMatchBtn = document.getElementById("endMatchBtn");
const goalTeamABtn = document.getElementById("goalTeamABtn");
const goalTeamBBtn = document.getElementById("goalTeamBBtn");
const leagueInfoText = document.getElementById("leagueInfoText");

async function getCurrentMatch() {
  const snap = await getDoc(doc(db, "appState", "currentMatch"));
  if (!snap.exists()) return null;
  return snap.data();
}

async function saveCurrentMatch(match) {
  await setDoc(doc(db, "appState", "currentMatch"), {
    ...match,
    updatedAt: serverTimestamp()
  });
}

async function getMatchOrRedirect() {
  const match = await getCurrentMatch();

  if (!match) {
    alert("No current match found. Please generate teams and choose two teams first.");
    window.location.href = "teams.html";
    return null;
  }

  return match;
}

async function getAllPlayers() {
  const q = query(collection(db, "players"), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

function renderLeagueInfo(match) {
  leagueInfoText.textContent = match.leagueName
    ? `League Match: ${match.leagueName}`
    : "Friendly Match";
}

function renderScore(match) {
  matchTeamAName.textContent = match.teamA.name;
  matchTeamBName.textContent = match.teamB.name;
  teamAScoreEl.textContent = match.teamA.score;
  teamBScoreEl.textContent = match.teamB.score;
}

function populateGoalTeamOptions(match) {
  goalTeamSelect.innerHTML = `
    <option value="A">${match.teamA.name}</option>
    <option value="B">${match.teamB.name}</option>
  `;
}

async function updateScorersOptions() {
  const match = await getCurrentMatch();
  if (!match) return;

  const selectedTeam = goalTeamSelect.value;
  const players = selectedTeam === "A" ? match.teamA.players : match.teamB.players;

  goalScorerSelect.innerHTML = "";

  players.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.id;
    option.textContent = player.name;
    goalScorerSelect.appendChild(option);
  });
}

function renderTimeline(match) {
  timelineList.innerHTML = "";

  if (!match.events.length) {
    timelineEmptyState.style.display = "block";
    return;
  }

  timelineEmptyState.style.display = "none";

  match.events.forEach((event) => {
    const scorerName = event.scorerName || event.scorer || "Unknown scorer";
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.innerHTML = `<strong>${event.minute}'</strong> - ${scorerName} scored for ${event.teamName}`;
    timelineList.appendChild(item);
  });
}

async function addGoalEvent(event) {
  event.preventDefault();

  const match = await getMatchOrRedirect();
  if (!match) return;

  const selectedTeam = goalTeamSelect.value;
  const scorerId = goalScorerSelect.value;
  const minute = Number(goalMinuteInput.value) || 1;
  const isTeamA = selectedTeam === "A";
  const teamPlayers = isTeamA ? match.teamA.players : match.teamB.players;
  const scorerPlayer = teamPlayers.find((player) => player.id === scorerId);
  const scorerName = scorerPlayer ? scorerPlayer.name : "Unknown Player";
  const teamName = isTeamA ? match.teamA.name : match.teamB.name;

  match.events.push({
    id: crypto.randomUUID(),
    type: "goal",
    minute,
    scorerId,
    scorerName,
    team: selectedTeam,
    teamName
  });

  if (isTeamA) {
    match.teamA.score += 1;
  } else {
    match.teamB.score += 1;
  }

  await saveCurrentMatch(match);
  renderScore(match);
  renderTimeline(match);
  goalMinuteInput.value = "";
}

async function quickAddGoal(teamKey) {
  goalTeamSelect.value = teamKey;
  await updateScorersOptions();

  const match = await getCurrentMatch();
  if (!match) return;

  const players = teamKey === "A" ? match.teamA.players : match.teamB.players;
  if (!players.length) return;

  goalScorerSelect.value = players[0].id;
  goalMinuteInput.value = String(match.events.length + 1);

  await addGoalEvent({ preventDefault() {} });
}

async function undoLastEvent() {
  const match = await getMatchOrRedirect();
  if (!match || !match.events.length) return;

  const lastEvent = match.events.pop();

  if (lastEvent.type === "goal") {
    if (lastEvent.team === "A" && match.teamA.score > 0) {
      match.teamA.score -= 1;
    }

    if (lastEvent.team === "B" && match.teamB.score > 0) {
      match.teamB.score -= 1;
    }
  }

  await saveCurrentMatch(match);
  renderScore(match);
  renderTimeline(match);
}

async function updatePlayerStatsForMatch(match) {
  const allPlayers = await getAllPlayers();
  const playersMap = new Map(allPlayers.map((player) => [player.id, player]));

  const teamAIds = (match.teamA.players || []).map((p) => p.id);
  const teamBIds = (match.teamB.players || []).map((p) => p.id);

  const scoreA = match.teamA.score || 0;
  const scoreB = match.teamB.score || 0;

  const goalCounts = {};
  (match.events || []).forEach((event) => {
    if (event.type === "goal" && event.scorerId) {
      goalCounts[event.scorerId] = (goalCounts[event.scorerId] || 0) + 1;
    }
  });

  const updates = [];

  for (const playerId of [...teamAIds, ...teamBIds]) {
    const player = playersMap.get(playerId);
    if (!player) continue;

    const stats = player.stats || {
      matchesPlayed: 0,
      goals: 0,
      wins: 0,
      losses: 0,
      draws: 0
    };

    const inTeamA = teamAIds.includes(playerId);
    let wins = stats.wins || 0;
    let losses = stats.losses || 0;
    let draws = stats.draws || 0;

    if (scoreA === scoreB) {
      draws += 1;
    } else if ((inTeamA && scoreA > scoreB) || (!inTeamA && scoreB > scoreA)) {
      wins += 1;
    } else {
      losses += 1;
    }

    const updatedStats = {
      matchesPlayed: (stats.matchesPlayed || 0) + 1,
      goals: (stats.goals || 0) + (goalCounts[playerId] || 0),
      wins,
      losses,
      draws
    };

    updates.push(
      setDoc(doc(db, "players", playerId), {
        ...player,
        stats: updatedStats
      })
    );
  }

  await Promise.all(updates);
}

async function endMatch() {
  const match = await getMatchOrRedirect();
  if (!match) return;

  await addDoc(collection(db, "matches"), {
    ...match,
    createdAt: serverTimestamp()
  });

  await updatePlayerStatsForMatch(match);
  await deleteDoc(doc(db, "appState", "currentMatch"));

  alert("Match ended and saved to history.");
  window.location.href = "history.html";
}

async function initMatchPage() {
  const match = await getMatchOrRedirect();
  if (!match) return;

  renderLeagueInfo(match);
  renderScore(match);
  populateGoalTeamOptions(match);
  await updateScorersOptions();
  renderTimeline(match);
}

goalTeamSelect.addEventListener("change", updateScorersOptions);
goalForm.addEventListener("submit", addGoalEvent);
undoEventBtn.addEventListener("click", undoLastEvent);
endMatchBtn.addEventListener("click", endMatch);
goalTeamABtn.addEventListener("click", () => quickAddGoal("A"));
goalTeamBBtn.addEventListener("click", () => quickAddGoal("B"));

initMatchPage();