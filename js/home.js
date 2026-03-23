import {
  db,
  collection,
  getDocs,
  query,
  orderBy
} from "./firebase.js";

const homeLatestMatchTeams = document.getElementById("homeLatestMatchTeams");
const homeLatestMatchMeta = document.getElementById("homeLatestMatchMeta");

function safeText(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function formatDate(value) {
  if (!value) return "Unknown date";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown date";
  }
}

function getGoalEvents(match) {
  return (match.events || []).filter((event) => event.type === "goal");
}

function getLatestScorerText(match) {
  const goalEvents = getGoalEvents(match);

  if (!goalEvents.length) {
    return "No goals recorded";
  }

  const latestGoal = goalEvents[goalEvents.length - 1];
  const scorerName = safeText(latestGoal.scorerName, "Unknown scorer");
  const minute = Number(latestGoal.minute || 0);

  return `Latest scorer: ${scorerName} (${minute}')`;
}

async function getMatches() {
  const q = query(collection(db, "matches"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

function renderMatchBlock(teamAName, teamBName, scoreA, scoreB) {
  homeLatestMatchTeams.innerHTML = `
    <div class="team-side left">
      <div class="team-name-left">${teamAName}</div>
      <div class="team-score-left">${scoreA}</div>
    </div>

    <div class="team-vs-block">
      <span class="team-vs">VS</span>
    </div>

    <div class="team-side right">
      <div class="team-name-right">${teamBName}</div>
      <div class="team-score-right">${scoreB}</div>
    </div>
  `;
}

function renderMeta(match) {
  const leagueText = match.leagueName
    ? `League: ${match.leagueName}`
    : "Friendly Match";

  const dateText = formatDate(match.date);
  const scorerText = getLatestScorerText(match);

  homeLatestMatchMeta.innerHTML = `
    <div>${leagueText}</div>
    <div>${dateText}</div>
    <div>${scorerText}</div>
  `;
}

function formatLatestMatch(match) {
  const teamAName = safeText(match.teamA?.name, "Team A");
  const teamBName = safeText(match.teamB?.name, "Team B");
  const scoreA = Number(match.teamA?.score ?? 0);
  const scoreB = Number(match.teamB?.score ?? 0);

  renderMatchBlock(teamAName, teamBName, scoreA, scoreB);
  renderMeta(match);
}

function renderNoMatches() {
  renderMatchBlock("No Match", "Yet", "-", "-");
  homeLatestMatchMeta.innerHTML = `
    <div>Friendly Match</div>
    <div>No saved matches yet.</div>
    <div>Start a match to see it here.</div>
  `;
}

async function initHomePage() {
  try {
    const matches = await getMatches();

    if (!matches.length) {
      renderNoMatches();
      return;
    }

    formatLatestMatch(matches[0]);
  } catch (error) {
    console.error("Failed to load latest match:", error);
    renderNoMatches();
  }
}

initHomePage();