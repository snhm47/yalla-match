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

function getMatchOrRedirect() {
  const match = getCurrentMatch();

  if (!match) {
    alert("No current match found. Please generate teams first.");
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

function updateScorersOptions() {
  const match = getCurrentMatch();
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
    item.innerHTML = `
      <strong>${event.minute}'</strong> - ${event.scorer} scored for ${event.teamName}
    `;
    timelineList.appendChild(item);
  });
}

function addGoalEvent(event) {
  event.preventDefault();

  const match = getMatchOrRedirect();
  if (!match) return;

  const selectedTeam = goalTeamSelect.value;
  const scorer = goalScorerSelect.value;
  const minute = Number(goalMinuteInput.value) || 1;

  const isTeamA = selectedTeam === "A";
  const teamName = isTeamA ? match.teamA.name : match.teamB.name;

  const newEvent = {
    id: generateId("event"),
    type: "goal",
    minute,
    scorer,
    team: selectedTeam,
    teamName
  };

  match.events.push(newEvent);

  if (isTeamA) {
    match.teamA.score += 1;
  } else {
    match.teamB.score += 1;
  }

  saveCurrentMatch(match);
  renderScore(match);
  renderTimeline(match);

  goalMinuteInput.value = "";
}

function quickAddGoal(teamKey) {
  goalTeamSelect.value = teamKey;
  updateScorersOptions();

  const match = getCurrentMatch();
  if (!match) return;

  const players = teamKey === "A" ? match.teamA.players : match.teamB.players;
  if (!players.length) return;

  const scorer = players[0].name;
  const minute = match.events.length + 1;

  const fakeSubmitEvent = {
    preventDefault() {}
  };

  goalScorerSelect.value = scorer;
  goalMinuteInput.value = minute;
  addGoalEvent(fakeSubmitEvent);
}

function undoLastEvent() {
  const match = getMatchOrRedirect();
  if (!match || !match.events.length) return;

  const lastEvent = match.events.pop();

  if (lastEvent.type === "goal") {
    if (lastEvent.team === "A" && match.teamA.score > 0) {
      match.teamA.score -= 1;
    } else if (lastEvent.team === "B" && match.teamB.score > 0) {
      match.teamB.score -= 1;
    }
  }

  saveCurrentMatch(match);
  renderScore(match);
  renderTimeline(match);
}

function endMatch() {
  const match = getMatchOrRedirect();
  if (!match) return;

  const history = getMatchHistory();
  history.unshift(match);
  saveMatchHistory(history);
  clearCurrentMatch();

  alert("Match ended and saved to history.");
  window.location.href = "history.html";
}

function initMatchPage() {
  const match = getMatchOrRedirect();
  if (!match) return;

  renderScore(match);
  updateScorersOptions();
  renderTimeline(match);
}

goalTeamSelect.addEventListener("change", updateScorersOptions);
goalForm.addEventListener("submit", addGoalEvent);
undoEventBtn.addEventListener("click", undoLastEvent);
endMatchBtn.addEventListener("click", endMatch);
goalTeamABtn.addEventListener("click", () => quickAddGoal("A"));
goalTeamBBtn.addEventListener("click", () => quickAddGoal("B"));

initMatchPage();