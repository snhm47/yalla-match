import {
  db,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "./firebase.js";

const leagueForm = document.getElementById("leagueForm");
const leagueNameInput = document.getElementById("leagueName");
const leagueSeasonInput = document.getElementById("leagueSeason");
const leagueMessage = document.getElementById("leagueMessage");
const leaguesList = document.getElementById("leaguesList");
const leaguesEmptyState = document.getElementById("leaguesEmptyState");

async function getLeagues() {
  const q = query(collection(db, "leagues"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

async function getMatches() {
  const q = query(collection(db, "matches"), orderBy("createdAt", "desc"));
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

function buildStandings(registeredTeams, leagueMatches) {
  const table = new Map();

  function ensureTeam(name) {
    if (!table.has(name)) {
      table.set(name, {
        name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0
      });
    }
    return table.get(name);
  }

  registeredTeams.forEach((team) => ensureTeam(team.name));

  leagueMatches.forEach((match) => {
    const teamAName = match.teamA?.name || "Team A";
    const teamBName = match.teamB?.name || "Team B";
    const scoreA = Number(match.teamA?.score || 0);
    const scoreB = Number(match.teamB?.score || 0);

    const teamA = ensureTeam(teamAName);
    const teamB = ensureTeam(teamBName);

    teamA.played += 1;
    teamB.played += 1;

    teamA.goalsFor += scoreA;
    teamA.goalsAgainst += scoreB;
    teamB.goalsFor += scoreB;
    teamB.goalsAgainst += scoreA;

    if (scoreA > scoreB) {
      teamA.wins += 1;
      teamA.points += 3;
      teamB.losses += 1;
    } else if (scoreB > scoreA) {
      teamB.wins += 1;
      teamB.points += 3;
      teamA.losses += 1;
    } else {
      teamA.draws += 1;
      teamB.draws += 1;
      teamA.points += 1;
      teamB.points += 1;
    }
  });

  const standings = [...table.values()].map((team) => ({
    ...team,
    goalDiff: team.goalsFor - team.goalsAgainst
  }));

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  return standings;
}

function renderStandings(standings) {
  if (!standings.length) {
    return `<div class="empty-state">No teams in this league yet.</div>`;
  }

  return standings
    .map(
      (team, index) => `
        <div class="player-item">
          <div>
            <strong>#${index + 1} ${team.name}</strong>
            <div class="player-meta">
              P: ${team.played} | W: ${team.wins} | D: ${team.draws} | L: ${team.losses}
            </div>
            <div class="player-meta">
              GF: ${team.goalsFor} | GA: ${team.goalsAgainst} | GD: ${team.goalDiff}
            </div>
          </div>
          <div>
            <strong>${team.points} pts</strong>
          </div>
        </div>
      `
    )
    .join("");
}

async function renderLeagues() {
  const leagues = await getLeagues();
  const matches = await getMatches();

  leaguesList.innerHTML = "";

  if (!leagues.length) {
    leaguesEmptyState.style.display = "block";
    return;
  }

  leaguesEmptyState.style.display = "none";

  for (const league of leagues) {
    const leagueTeams = await getLeagueTeams(league.id);
    const leagueMatches = matches.filter((match) => match.leagueId === league.id);
    const standings = buildStandings(leagueTeams, leagueMatches);

    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <div class="section-head">
        <div>
          <strong>${league.name}</strong>
          <div class="player-meta">Season: ${league.season}</div>
          <div class="player-meta">Registered teams: ${leagueTeams.length} | Matches: ${leagueMatches.length}</div>
        </div>
        <button class="btn btn-danger" type="button">Delete</button>
      </div>

      <div class="players-list">
        ${renderStandings(standings)}
      </div>
    `;

    item.querySelector("button").addEventListener("click", async () => {
      await deleteLeague(league.id);
    });

    leaguesList.appendChild(item);
  }
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
  await renderLeagues();
}

async function deleteLeague(leagueId) {
  await deleteDoc(doc(db, "leagues", leagueId));
  await renderLeagues();
}

leagueForm.addEventListener("submit", addLeague);
renderLeagues();