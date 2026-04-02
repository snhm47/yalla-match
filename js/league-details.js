import {
  db,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  getCurrentSessionId,
  sortByCreatedAtDesc
} from "./firebase.js";

const leagueTitle = document.getElementById("leagueTitle");
const leagueMeta = document.getElementById("leagueMeta");

const leagueTeamsEmptyState = document.getElementById("leagueTeamsEmptyState");
const leagueTeamsList = document.getElementById("leagueTeamsList");

const leagueTableContainer = document.getElementById("leagueTableContainer");

const leagueMatchesEmptyState = document.getElementById("leagueMatchesEmptyState");
const leagueMatchesList = document.getElementById("leagueMatchesList");

function getLeagueIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function getLeague(leagueId) {
  const sessionId = await getCurrentSessionId();
  const snap = await getDoc(doc(db, "leagues", leagueId));
  if (!snap.exists()) return null;

  const league = { id: snap.id, ...snap.data() };
  if (league.sessionId !== sessionId) return null;

  return league;
}

async function getLeagueTeams(leagueId) {
  const snapshot = await getDocs(collection(db, "leagues", leagueId, "teams"));
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

async function getLeagueMatches(leagueId) {
  const sessionId = await getCurrentSessionId();
  const q = query(
    collection(db, "matches"),
    where("sessionId", "==", sessionId),
    where("leagueId", "==", leagueId)
  );

  const snapshot = await getDocs(q);

  return sortByCreatedAtDesc(
    snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
  );
}

function buildStandingsFromMatches(teams, matches) {
  const tableMap = new Map();

  teams.forEach((team) => {
    const teamId = team.teamId || team.id;

    tableMap.set(teamId, {
      teamId,
      teamName: team.name || "Unknown Team",
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
      rating: team.totalRating || 0
    });
  });

  for (const match of matches) {
    const teamA = match.teamA || {};
    const teamB = match.teamB || {};

    const teamAId = teamA.id;
    const teamBId = teamB.id;

    if (!teamAId || !teamBId) continue;
    if (!tableMap.has(teamAId) || !tableMap.has(teamBId)) continue;

    const scoreA = Number(teamA.score || 0);
    const scoreB = Number(teamB.score || 0);

    const rowA = tableMap.get(teamAId);
    const rowB = tableMap.get(teamBId);

    rowA.played += 1;
    rowB.played += 1;

    rowA.gf += scoreA;
    rowA.ga += scoreB;

    rowB.gf += scoreB;
    rowB.ga += scoreA;

    if (scoreA > scoreB) {
      rowA.wins += 1;
      rowA.points += 3;
      rowB.losses += 1;
    } else if (scoreB > scoreA) {
      rowB.wins += 1;
      rowB.points += 3;
      rowA.losses += 1;
    } else {
      rowA.draws += 1;
      rowB.draws += 1;
      rowA.points += 1;
      rowB.points += 1;
    }
  }

  const standings = Array.from(tableMap.values()).map((row) => ({
    ...row,
    gd: row.gf - row.ga
  }));

  standings.sort((a, b) =>
    b.points - a.points ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    b.wins - a.wins ||
    b.rating - a.rating ||
    a.teamName.localeCompare(b.teamName)
  );

  return standings;
}

function createLeagueTableHtml(teams, matches) {
  if (!teams.length) {
    return `
      <div class="empty-state">
        Add teams to this league to show the table.
      </div>
    `;
  }

  const standings = buildStandingsFromMatches(teams, matches);

  const rowsHtml = standings.map((row, index) => `
    <tr>
      <td class="col-rank"><span class="rank-badge">${index + 1}</span></td>
      <td class="col-team">${row.teamName}</td>
      <td class="col-p">${row.played}</td>
      <td class="col-w">${row.wins}</td>
      <td class="col-d">${row.draws}</td>
      <td class="col-l">${row.losses}</td>
      <td class="col-gf">${row.gf}</td>
      <td class="col-ga">${row.ga}</td>
      <td class="col-gd">${row.gd}</td>
      <td class="col-pts points-cell">${row.points}</td>
    </tr>
  `).join("");

  return `
    <div class="league-table-wrap">
      <div class="league-table-header">
        <div class="league-table-title">League Table</div>
        <div class="league-table-note">Updated from played matches in this league.</div>
      </div>

      <div class="league-table-scroll">
        <table class="league-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-team">Team</th>
              <th class="col-p">P</th>
              <th class="col-w">W</th>
              <th class="col-d">D</th>
              <th class="col-l">L</th>
              <th class="col-gf">GF</th>
              <th class="col-ga">GA</th>
              <th class="col-gd">GD</th>
              <th class="col-pts">Pts</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderLeagueInfo(league, teams, matches) {
  leagueTitle.textContent = league.name;
  leagueMeta.textContent = `Season: ${league.season || "No season"} | Teams: ${teams.length} | Matches: ${matches.length}`;
}

function renderTeams(teams) {
  leagueTeamsList.innerHTML = "";

  if (!teams.length) {
    leagueTeamsEmptyState.style.display = "block";
    return;
  }

  leagueTeamsEmptyState.style.display = "none";

  teams.forEach((team) => {
    const item = document.createElement("div");
    item.className = "player-item";

    item.innerHTML = `
      <div>
        <strong>${team.name}</strong>
        <div class="player-meta">
          Players: ${Array.isArray(team.players) ? team.players.length : 0} | Rating: ${team.totalRating || 0}
        </div>
      </div>
    `;

    leagueTeamsList.appendChild(item);
  });
}

function renderMatches(matches) {
  leagueMatchesList.innerHTML = "";

  if (!matches.length) {
    leagueMatchesEmptyState.style.display = "block";
    return;
  }

  leagueMatchesEmptyState.style.display = "none";

  matches.forEach((match) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const goalsHtml = (match.events || []).length
      ? match.events
          .filter((event) => event.type === "goal")
          .map(
            (event) => `
              <div class="player-meta">
                ${event.minute}' ${event.scorerName || "Unknown scorer"} (${event.teamName || "Unknown team"})
              </div>
            `
          )
          .join("")
      : `<div class="player-meta">No goals recorded.</div>`;

    item.innerHTML = `
      <strong>${match.teamA?.name || "Team A"} ${match.teamA?.score ?? 0} - ${match.teamB?.score ?? 0} ${match.teamB?.name || "Team B"}</strong>
      <div class="player-meta">${new Date(match.date || Date.now()).toLocaleString()}</div>
      <div style="margin-top: 12px;">
        ${goalsHtml}
      </div>
    `;

    leagueMatchesList.appendChild(item);
  });
}

async function initLeagueDetailsPage() {
  const leagueId = getLeagueIdFromUrl();

  if (!leagueId) {
    leagueTitle.textContent = "League not found";
    leagueMeta.textContent = "Missing league id.";
    return;
  }

  const league = await getLeague(leagueId);

  if (!league) {
    leagueTitle.textContent = "League not found";
    leagueMeta.textContent = "This league does not exist in your current workspace.";
    return;
  }

  const teams = await getLeagueTeams(leagueId);
  const matches = await getLeagueMatches(leagueId);

  renderLeagueInfo(league, teams, matches);
  renderTeams(teams);
  leagueTableContainer.innerHTML = createLeagueTableHtml(teams, matches);
  renderMatches(matches);
}

initLeagueDetailsPage();