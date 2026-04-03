import {
  db,
  collection,
  getDocs,
  query,
  where,
  getCurrentSessionId,
  sortByCreatedAtDesc
} from "./firebase.js";

const historyList = document.getElementById("historyList");
const historyEmptyState = document.getElementById("historyEmptyState");

async function getMatches() {
  const sessionId = await getCurrentSessionId();
  const q = query(collection(db, "matches"), where("sessionId", "==", sessionId));
  const snapshot = await getDocs(q);

  return sortByCreatedAtDesc(
    snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
  );
}

function getScorerName(event) {
  return event.scorerName || event.scorer || "Unknown scorer";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return new Date().toLocaleString();

  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString();
  }

  return new Date(value).toLocaleString();
}

function getMinuteValue(event) {
  const minute = Number(event?.minute);
  return Number.isFinite(minute) ? minute : 999;
}

function belongsToTeam(event, teamName, sideKey) {
  const eventTeamName = normalizeText(event.teamName);
  const eventTeamSide = normalizeText(event.teamSide || event.team);
  const normalizedTeamName = normalizeText(teamName);

  if (eventTeamName && normalizedTeamName && eventTeamName === normalizedTeamName) {
    return true;
  }

  if (eventTeamSide && sideKey && eventTeamSide === normalizeText(sideKey)) {
    return true;
  }

  return false;
}

function getTeamGoals(goals, teamName, sideKey) {
  return goals
    .filter((event) => belongsToTeam(event, teamName, sideKey))
    .sort((a, b) => getMinuteValue(a) - getMinuteValue(b));
}

function buildScorersHtml(teamGoals, alignRight = false) {
  if (!teamGoals.length) {
    return `<div class="history-no-goals ${alignRight ? "right" : ""}">No scorers</div>`;
  }

  return teamGoals
    .map((event) => {
      const minute = escapeHtml(event.minute ?? "?");
      const scorerName = escapeHtml(getScorerName(event));

      return `
        <div class="history-scorer-row ${alignRight ? "right" : ""}">
          <span class="history-minute">${minute}'</span>
          <span class="history-scorer-name">${scorerName}</span>
        </div>
      `;
    })
    .join("");
}

function renderMatches(matches) {
  historyList.innerHTML = "";

  if (!matches.length) {
    historyEmptyState.style.display = "block";
    return;
  }

  historyEmptyState.style.display = "none";

  matches.forEach((match) => {
    const item = document.createElement("div");
    item.className = "history-item history-match-card";

    const teamAName = match.teamA?.name || "Team A";
    const teamBName = match.teamB?.name || "Team B";
    const scoreA = match.teamA?.score ?? 0;
    const scoreB = match.teamB?.score ?? 0;

    const leagueText = match.leagueName || "Friendly Match";
    const dateText = formatDate(match.date || match.createdAt);

    const goals = (match.events || []).filter((event) => event.type === "goal");
    const teamAGoals = getTeamGoals(goals, teamAName, "A");
    const teamBGoals = getTeamGoals(goals, teamBName, "B");

    item.innerHTML = `
      <div class="history-top-row">
        <span class="history-league-badge">${escapeHtml(leagueText)}</span>
        <span class="history-date">${escapeHtml(dateText)}</span>
      </div>

      <div class="history-scoreboard">
        <div class="history-team-column left">
          <div class="history-team-name">${escapeHtml(teamAName)}</div>
          <div class="history-scorers-list">
            ${buildScorersHtml(teamAGoals, false)}
          </div>
        </div>

        <div class="history-center-column">
          <div class="history-score-line">
            <span class="history-score-number">${escapeHtml(scoreA)}</span>
            <span class="history-score-separator">-</span>
            <span class="history-score-number">${escapeHtml(scoreB)}</span>
          </div>
          <div class="history-final-text">Final Score</div>
        </div>

        <div class="history-team-column right">
          <div class="history-team-name">${escapeHtml(teamBName)}</div>
          <div class="history-scorers-list">
            ${buildScorersHtml(teamBGoals, true)}
          </div>
        </div>
      </div>
    `;

    historyList.appendChild(item);
  });
}

async function initHistoryPage() {
  try {
    const matches = await getMatches();
    renderMatches(matches);
  } catch (error) {
    console.error("Failed to load history:", error);
    historyEmptyState.style.display = "block";
    historyEmptyState.textContent = "Failed to load saved matches.";
  }
}

initHistoryPage();