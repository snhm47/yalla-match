import {
  db,
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  setDoc,
  query,
  where,
  serverTimestamp,
  getCurrentSessionId,
  getScopedAppStateId,
  sortByCreatedAtAsc,
  sortByCreatedAtDesc
} from "./firebase.js";

const splitModeSelect = document.getElementById("splitMode");
const teamCountInput = document.getElementById("teamCount");
const playersPerTeamInput = document.getElementById("playersPerTeam");
const teamNamesInput = document.getElementById("teamNamesInput");
const generateTeamsBtn = document.getElementById("generateTeamsBtn");
const saveTeamsBtn = document.getElementById("saveTeamsBtn");
const startMatchBtn = document.getElementById("startMatchBtn");
const teamsContainer = document.getElementById("teamsContainer");
const fairnessValue = document.getElementById("fairnessValue");
const teamsMessage = document.getElementById("teamsMessage");
const matchTeamASelect = document.getElementById("matchTeamASelect");
const matchTeamBSelect = document.getElementById("matchTeamBSelect");
const matchLeagueSelect = document.getElementById("matchLeagueSelect");

let latestGeneratedTeams = [];

async function getPlayers() {
  const sessionId = await getCurrentSessionId();
  const q = query(collection(db, "players"), where("sessionId", "==", sessionId));
  const snapshot = await getDocs(q);

  return sortByCreatedAtAsc(
    snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
  );
}

async function getLeagues() {
  const sessionId = await getCurrentSessionId();
  const q = query(collection(db, "leagues"), where("sessionId", "==", sessionId));
  const snapshot = await getDocs(q);

  return sortByCreatedAtDesc(
    snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
  );
}

async function populateLeagueSelect() {
  const leagues = await getLeagues();

  if (!matchLeagueSelect) return;

  matchLeagueSelect.innerHTML = `<option value="">Friendly Match</option>`;

  leagues.forEach((league) => {
    const option = document.createElement("option");
    option.value = league.id;
    option.textContent = `${league.name} (${league.season || "No season"})`;
    option.dataset.name = league.name;
    matchLeagueSelect.appendChild(option);
  });
}

function shuffle(array) {
  const cloned = [...array];
  for (let i = cloned.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function calculateTeamRating(team) {
  return team.reduce((sum, player) => sum + Number(player.rating || 0), 0);
}

function calculateOverallFairness(teams) {
  if (!teams.length) return 100;

  const ratings = teams.map((team) => calculateTeamRating(team.players));
  const maxRating = Math.max(...ratings);
  const minRating = Math.min(...ratings);

  if (maxRating === 0) return 100;
  return Math.round((minRating / maxRating) * 100);
}

function getCustomTeamNames(teamCount) {
  const raw = teamNamesInput?.value?.trim() || "";
  if (!raw) {
    return Array.from({ length: teamCount }, (_, index) => `Team ${index + 1}`);
  }

  const parsedNames = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const finalNames = [];

  for (let i = 0; i < teamCount; i++) {
    finalNames.push(parsedNames[i] || `Team ${i + 1}`);
  }

  return finalNames;
}

function generateRandomTeams(players, teamCount, playersPerTeam, teamNames) {
  const shuffled = shuffle(players);
  const teams = [];

  for (let i = 0; i < teamCount; i++) {
    const start = i * playersPerTeam;
    const end = start + playersPerTeam;

    teams.push({
      name: teamNames[i],
      players: shuffled.slice(start, end)
    });
  }

  return teams;
}

function generateBalancedTeams(players, teamCount, playersPerTeam, teamNames) {
  const sorted = [...players].sort(
    (a, b) => Number(b.rating || 0) - Number(a.rating || 0)
  );

  const teams = Array.from({ length: teamCount }, (_, index) => ({
    name: teamNames[index],
    players: [],
    rating: 0
  }));

  for (const player of sorted) {
    const availableTeams = teams.filter(
      (team) => team.players.length < playersPerTeam
    );

    if (!availableTeams.length) break;

    availableTeams.sort((a, b) => a.rating - b.rating);
    availableTeams[0].players.push(player);
    availableTeams[0].rating += Number(player.rating || 0);
  }

  return teams.map((team) => ({
    name: team.name,
    players: team.players
  }));
}

function renderTeams(teams) {
  teamsContainer.innerHTML = "";

  if (!teams.length) {
    teamsContainer.innerHTML = `<div class="empty-state">No teams generated yet.</div>`;
    return;
  }

  teams.forEach((team) => {
    const teamRating = calculateTeamRating(team.players);

    const card = document.createElement("div");
    card.className = "card team-card";

    const playersHtml = team.players.length
      ? team.players
          .map(
            (player) => `
              <div class="team-player">
                <strong>${player.name}</strong>
                <div class="player-meta">Rating: ${player.rating} | Position: ${player.position || "No position"}</div>
              </div>
            `
          )
          .join("")
      : `<div class="empty-state">No players</div>`;

    card.innerHTML = `
      <h2>${team.name}</h2>
      <div class="team-list">${playersHtml}</div>
      <div class="team-footer"><strong>Total Rating:</strong> ${teamRating}</div>
      <div class="team-footer"><strong>Players:</strong> ${team.players.length}</div>
    `;

    teamsContainer.appendChild(card);
  });
}

function populateMatchSelectors(teams) {
  if (!matchTeamASelect || !matchTeamBSelect) return;

  matchTeamASelect.innerHTML = `<option value="">Select first team</option>`;
  matchTeamBSelect.innerHTML = `<option value="">Select second team</option>`;

  teams.forEach((team, index) => {
    const optionA = document.createElement("option");
    optionA.value = String(index);
    optionA.textContent = team.name;
    matchTeamASelect.appendChild(optionA);

    const optionB = document.createElement("option");
    optionB.value = String(index);
    optionB.textContent = team.name;
    matchTeamBSelect.appendChild(optionB);
  });

  if (teams.length >= 2) {
    matchTeamASelect.value = "0";
    matchTeamBSelect.value = "1";
  }
}

function makeLeagueTeamDocId(teamName) {
  return (
    teamName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || crypto.randomUUID()
  );
}

async function registerTeamsToLeague(sessionId, leagueId, leagueName, teams) {
  if (!leagueId) return;

  const writes = teams.map((team) => {
    const teamId = makeLeagueTeamDocId(team.name);

    return setDoc(
      doc(db, "leagues", leagueId, "teams", teamId),
      {
        teamId,
        sessionId,
        name: team.name,
        leagueId,
        leagueName,
        players: team.players.map((player) => ({
          id: player.id,
          name: player.name,
          rating: player.rating || 0,
          position: player.position || ""
        })),
        totalRating: calculateTeamRating(team.players),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    );
  });

  await Promise.all(writes);
}

async function saveGeneratedTeamsToCollection(sessionId, teams, leagueId = "", leagueName = "") {
  const writes = teams.map((team) =>
    addDoc(collection(db, "teams"), {
      sessionId,
      name: team.name,
      leagueId,
      leagueName,
      players: team.players.map((player) => ({
        id: player.id,
        name: player.name,
        rating: player.rating || 0,
        position: player.position || ""
      })),
      totalRating: calculateTeamRating(team.players),
      createdAt: serverTimestamp()
    })
  );

  await Promise.all(writes);
}

async function generateTeams() {
  const sessionId = await getCurrentSessionId();
  const players = await getPlayers();

  const teamCount = Number(teamCountInput.value);
  const playersPerTeam = Number(playersPerTeamInput.value);

  if (teamCount < 2) {
    teamsMessage.textContent = "Number of teams must be at least 2.";
    return;
  }

  if (playersPerTeam < 1) {
    teamsMessage.textContent = "Players per team must be at least 1.";
    return;
  }

  const neededPlayers = teamCount * playersPerTeam;

  if (players.length < neededPlayers) {
    teamsMessage.textContent = `You need at least ${neededPlayers} players, but only ${players.length} exist.`;
    return;
  }

  const teamNames = getCustomTeamNames(teamCount);
  const usablePlayers = shuffle(players).slice(0, neededPlayers);

  const mode = splitModeSelect.value;
  const generatedTeams =
    mode === "balanced"
      ? generateBalancedTeams(usablePlayers, teamCount, playersPerTeam, teamNames)
      : generateRandomTeams(usablePlayers, teamCount, playersPerTeam, teamNames);

  const fairness = calculateOverallFairness(generatedTeams);

  latestGeneratedTeams = generatedTeams;

  renderTeams(generatedTeams);
  populateMatchSelectors(generatedTeams);
  fairnessValue.textContent = `${fairness}%`;

  const teamsForFirebase = generatedTeams.map((team) => ({
    name: team.name,
    players: team.players.map((player) => ({
      id: player.id,
      name: player.name,
      rating: player.rating || 0,
      position: player.position || ""
    })),
    rating: calculateTeamRating(team.players)
  }));

  await setDoc(doc(db, "appState", getScopedAppStateId(sessionId, "currentTeams")), {
    sessionId,
    teams: teamsForFirebase,
    teamCount,
    playersPerTeam,
    fairness,
    teamNames,
    updatedAt: serverTimestamp()
  });

  teamsMessage.textContent = "Teams generated successfully.";
}

async function saveGeneratedTeams() {
  const sessionId = await getCurrentSessionId();
  let teams = latestGeneratedTeams;

  if (!teams.length) {
    const snap = await getDoc(doc(db, "appState", getScopedAppStateId(sessionId, "currentTeams")));
    if (snap.exists()) {
      teams = snap.data().teams || [];
    }
  }

  if (!teams.length) {
    teamsMessage.textContent = "Generate teams first.";
    return;
  }

  const selectedLeagueId = matchLeagueSelect?.value || "";
  const selectedLeagueName = selectedLeagueId
    ? matchLeagueSelect.options[matchLeagueSelect.selectedIndex].dataset.name
    : "";

  await saveGeneratedTeamsToCollection(sessionId, teams, selectedLeagueId, selectedLeagueName);

  if (selectedLeagueId) {
    await registerTeamsToLeague(sessionId, selectedLeagueId, selectedLeagueName, teams);
  }

  teamsMessage.textContent = selectedLeagueId
    ? "Generated teams saved successfully and linked to the selected league."
    : "Generated teams saved successfully.";
}

async function startMatch() {
  const sessionId = await getCurrentSessionId();
  let teams = latestGeneratedTeams;

  if (!teams.length) {
    const snap = await getDoc(doc(db, "appState", getScopedAppStateId(sessionId, "currentTeams")));
    if (snap.exists()) {
      teams = snap.data().teams || [];
    }
  }

  if (!teams.length) {
    teamsMessage.textContent = "Generate teams first.";
    return;
  }

  const teamAIndex = Number(matchTeamASelect?.value);
  const teamBIndex = Number(matchTeamBSelect?.value);

  if (Number.isNaN(teamAIndex) || Number.isNaN(teamBIndex)) {
    teamsMessage.textContent = "Please choose two teams to start the match.";
    return;
  }

  if (teamAIndex === teamBIndex) {
    teamsMessage.textContent = "Please choose two different teams.";
    return;
  }

  const teamA = teams[teamAIndex];
  const teamB = teams[teamBIndex];

  if (!teamA || !teamB) {
    teamsMessage.textContent = "Could not find the selected teams.";
    return;
  }

  const leagueId = matchLeagueSelect?.value || "";
  const leagueName = leagueId
    ? matchLeagueSelect.options[matchLeagueSelect.selectedIndex].dataset.name
    : "";

  const fairness = calculateOverallFairness([
    { players: teamA.players || [] },
    { players: teamB.players || [] }
  ]);

  await setDoc(doc(db, "appState", getScopedAppStateId(sessionId, "currentMatch")), {
    sessionId,
    date: new Date().toISOString(),
    leagueId,
    leagueName,
    teamA: {
      id: teamA.id || `generated-a-${Date.now()}`,
      name: teamA.name,
      players: teamA.players || [],
      score: 0
    },
    teamB: {
      id: teamB.id || `generated-b-${Date.now()}`,
      name: teamB.name,
      players: teamB.players || [],
      score: 0
    },
    events: [],
    fairness,
    updatedAt: serverTimestamp()
  });

  window.location.href = "match.html";
}

generateTeamsBtn?.addEventListener("click", generateTeams);
saveTeamsBtn?.addEventListener("click", saveGeneratedTeams);
startMatchBtn?.addEventListener("click", startMatch);

populateLeagueSelect();