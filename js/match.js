import {
  db,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  doc,
  collection,
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
    option.value = player.name;
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
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.innerHTML = `<strong>${event.minute}'</strong> - ${event.scorer} scored for ${event.teamName}`;
    timelineList.appendChild(item);
  });
}

async function addGoalEvent(event) {
  event.preventDefault();

  const match = await getMatchOrRedirect();
  if (!match) return;

  const selectedTeam = goalTeamSelect.value;
  const scorer = goalScorerSelect.value;
  const minute = Number(goalMinuteInput.value) || 1;
  const isTeamA = selectedTeam === "A";
  const teamName = isTeamA ? match.teamA.name : match.teamB.name;

  match.events.push({
    id: crypto.randomUUID(),
    type: "goal",
    minute,
    scorer,
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

  goalScorerSelect.value = players[0].name;
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

async function endMatch() {
  const match = await getMatchOrRedirect();
  if (!match) return;

  await addDoc(collection(db, "matches"), {
    ...match,
    createdAt: serverTimestamp()
  });

  await deleteDoc(doc(db, "appState", "currentMatch"));

  alert("Match ended and saved to history.");
  window.location.href = "history.html";
}

async function initMatchPage() {
  const match = await getMatchOrRedirect();
  if (!match) return;

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