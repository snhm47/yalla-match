import {
  db,
  collection,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  orderBy,
  serverTimestamp
} from "./firebase.js";

const leagueForm = document.getElementById("leagueForm");
const leagueNameInput = document.getElementById("leagueName");
const leagueSeasonInput = document.getElementById("leagueSeason");
const leagueMessage = document.getElementById("leagueMessage");

const leagueSelect = document.getElementById("leagueSelect");
const teamSelect = document.getElementById("teamSelect");
const addTeamToLeagueBtn = document.getElementById("addTeamToLeagueBtn");

const leaguesEmptyState = document.getElementById("leaguesEmptyState");
const leaguesList = document.getElementById("leaguesList");

async function getLeagues() {
  const q = query(collection(db, "leagues"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

async function getTeams() {
  const q = query(collection(db, "teams"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

async function getLeagueTeams(leagueId) {
  const snapshot = await getDocs(collection(db, "leagues", leagueId, "teams"));
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

async function getLeagueMatches(leagueId) {
  const q = query(collection(db, "matches"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
    .filter((match) => match.leagueId === leagueId);
}

async function populateLeagueSelect() {
  const leagues = await getLeagues();

  leagueSelect.innerHTML = `<option value="">Select a league</option>`;

  leagues.forEach((league) => {
    const option = document.createElement("option");
    option.value = league.id;
    option.textContent = `${league.name} (${league.season || "No season"})`;
    leagueSelect.appendChild(option);
  });
}

async function populateTeamSelect() {
  const teams = await getTeams();

  teamSelect.innerHTML = `<option value="">Select a team</option>`;

  teams.forEach((team) => {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = `${team.name}${team.leagueName ? ` - ${team.leagueName}` : ""}`;
    teamSelect.appendChild(option);
  });
}

async function addLeague(event) {
  event.preventDefault();

  const name = leagueNameInput.value.trim();
  const season = leagueSeasonInput.value.trim();

  if (!name || !season) {
    leagueMessage.textContent = "Please fill all league fields.";
    return;
  }

  await addDoc(collection(db, "leagues"), {
    name,
    season,
    createdAt: serverTimestamp()
  });

  leagueForm.reset();
  leagueMessage.textContent = "League added successfully.";

  await populateLeagueSelect();
  await renderLeagues();
}

async function addTeamToLeague() {
  const leagueId = leagueSelect.value;
  const teamId = teamSelect.value;

  if (!leagueId) {
    leagueMessage.textContent = "Please choose a league.";
    return;
  }

  if (!teamId) {
    leagueMessage.textContent = "Please choose a team.";
    return;
  }

  const teamSnap = await getDoc(doc(db, "teams", teamId));

  if (!teamSnap.exists()) {
    leagueMessage.textContent = "Selected team was not found.";
    return;
  }

  const teamData = teamSnap.data();

  await setDoc(
    doc(db, "leagues", leagueId, "teams", teamId),
    {
      teamId,
      name: teamData.name,
      leagueId,
      players: teamData.players || [],
      totalRating: teamData.totalRating || 0,
      addedAt: serverTimestamp()
    },
    { merge: true }
  );

  leagueMessage.textContent = "Team added to league successfully.";
  await renderLeagues();
}

async function removeTeamFromLeague(leagueId, teamId) {
  await deleteDoc(doc(db, "leagues", leagueId, "teams", teamId));
  await renderLeagues();
}

async function deleteLeagueById(leagueId) {
  await deleteDoc(doc(db, "leagues", leagueId));
  leagueMessage.textContent = "League deleted.";

  await populateLeagueSelect();
  await renderLeagues();
}

function createTeamHtml(leagueId, team) {
  const playerCount = Array.isArray(team.players) ? team.players.length : 0;

  return `
    <div class="player-item">
      <div>
        <strong>${team.name}</strong>
        <div class="player-meta">
          Players: ${playerCount} | Rating: ${team.totalRating || 0}
        </div>
      </div>
      <button class="btn btn-danger remove-team-btn" type="button" data-league-id="${leagueId}" data-team-id="${team.id}">
        Remove
      </button>
    </div>
  `;
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
      <div class="empty-state league-table-empty">
        Add teams to this league to show the table.
      </div>
    `;
  }

  const standings = buildStandingsFromMatches(teams, matches);

  const rowsHtml = standings.map((row, index) => `
    <tr>
      <td class="col-rank">
        <span class="rank-badge">${index + 1}</span>
      </td>
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
        <div class="league-table-note">
          Updated from played matches in this league.
        </div>
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

async function renderLeagues() {
  const leagues = await getLeagues();
  leaguesList.innerHTML = "";

  if (!leagues.length) {
    leaguesEmptyState.style.display = "block";
    return;
  }

  leaguesEmptyState.style.display = "none";

  for (const league of leagues) {
    const teams = await getLeagueTeams(league.id);
    const matches = await getLeagueMatches(league.id);

    const item = document.createElement("div");
    item.className = "history-item league-card";

    const teamsHtml = teams.length
      ? teams.map((team) => createTeamHtml(league.id, team)).join("")
      : `<div class="empty-state">No teams added to this league yet.</div>`;

    const leagueTableHtml = createLeagueTableHtml(teams, matches);

    item.innerHTML = `
      <div class="section-head">
        <div>
          <strong>${league.name}</strong>
          <div class="player-meta">Season: ${league.season || "No season"}</div>
          <div class="player-meta">Teams in league: ${teams.length}</div>
        </div>
        <button class="btn btn-danger delete-league-btn" type="button" data-league-id="${league.id}">
          Delete League
        </button>
      </div>

      <div class="players-list league-teams-list">
        ${teamsHtml}
      </div>

      ${leagueTableHtml}
    `;

    leaguesList.appendChild(item);
  }

  leaguesList.querySelectorAll(".remove-team-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const leagueId = button.dataset.leagueId;
      const teamId = button.dataset.teamId;
      await removeTeamFromLeague(leagueId, teamId);
    });
  });

  leaguesList.querySelectorAll(".delete-league-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const leagueId = button.dataset.leagueId;
      await deleteLeagueById(leagueId);
    });
  });
}

leagueForm.addEventListener("submit", addLeague);
addTeamToLeagueBtn.addEventListener("click", addTeamToLeague);

populateLeagueSelect();
populateTeamSelect();
renderLeagues();