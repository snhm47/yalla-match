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

function renderMatches(matches) {
  historyList.innerHTML = "";

  if (!matches.length) {
    historyEmptyState.style.display = "block";
    return;
  }

  historyEmptyState.style.display = "none";

  matches.forEach((match) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const scoreA = match.teamA?.score ?? 0;
    const scoreB = match.teamB?.score ?? 0;
    const teamAName = match.teamA?.name || "Team A";
    const teamBName = match.teamB?.name || "Team B";
    const leagueText = match.leagueName ? `League: ${match.leagueName}` : "Friendly Match";

    const goals = (match.events || []).filter((event) => event.type === "goal");

    const goalsHtml = goals.length
      ? goals
          .map(
            (event) => `
              <div class="player-meta">
                ${event.minute}' ${getScorerName(event)} (${event.teamName || "Unknown team"})
              </div>
            `
          )
          .join("")
      : `<div class="player-meta">No goals recorded.</div>`;

    item.innerHTML = `
      <strong>${teamAName} ${scoreA} - ${scoreB} ${teamBName}</strong>
      <div class="player-meta">${leagueText}</div>
      <div class="player-meta">Date: ${new Date(match.date || Date.now()).toLocaleString()}</div>
      <div style="margin-top:12px;">
        ${goalsHtml}
      </div>
    `;

    historyList.appendChild(item);
  });
}

async function initHistoryPage() {
  const matches = await getMatches();
  renderMatches(matches);
}

initHistoryPage();