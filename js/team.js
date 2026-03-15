import {
  db,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  query,
  orderBy,
  serverTimestamp
} from "./firebase.js";

const splitModeSelect = document.getElementById("splitMode");
const teamCountInput = document.getElementById("teamCount");
const playersPerTeamInput = document.getElementById("playersPerTeam");
const generateTeamsBtn = document.getElementById("generateTeamsBtn");
const startMatchBtn = document.getElementById("startMatchBtn");
const teamsContainer = document.getElementById("teamsContainer");
const fairnessValue = document.getElementById("fairnessValue");
const teamsMessage = document.getElementById("teamsMessage");
const matchTeamASelect = document.getElementById("matchTeamASelect");
const matchTeamBSelect = document.getElementById("matchTeamBSelect");

async function getPlayers() {
  const q = query(collection(db, "players"), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
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

function generateRandomTeams(players, teamCount, playersPerTeam) {
  const shuffled = shuffle(players);
  const teams = [];

  for (let i = 0; i < teamCount; i++) {
    const start = i * playersPerTeam;
    const end = start + playersPerTeam;

    teams.push({
      name: `Team ${i + 1}`,
      players: shuffled.slice(start, end)
    });
  }

  return teams;
}

function generateBalancedTeams(players, teamCount, playersPerTeam) {
  const sorted = [...players].sort(
    (a, b) => Number(b.rating || 0) - Number(a.rating || 0)
  );

  const teams = Array.from({ length: teamCount }, (_, index) => ({
    name: `Team ${index + 1}`,
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
                <div class="player-meta">Rating: ${player.rating} | Position: ${player.position}</div>
              </div>
            `
          )
          .join("")
      : `<div class="empty-state">No players</div>`;

    card.innerHTML = `
      <h2>${team.name}</h2>
      <div class="team-list">${playersHtml}</div>
      <div class="team-footer">
        <strong>Total Rating:</strong> ${teamRating}
      </div>
      <div class="team-footer">
        <strong>Players:</strong> ${team.players.length}
      </div>
    `;

    teamsContainer.appendChild(card);
  });
}

function populateMatchSelectors(teams) {
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

async function generateTeams() {
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

  const usablePlayers = shuffle(players).slice(0, neededPlayers);

  const mode = splitModeSelect.value;
  const generatedTeams =
    mode === "balanced"
      ? generateBalancedTeams(usablePlayers, teamCount, playersPerTeam)
      : generateRandomTeams(usablePlayers, teamCount, playersPerTeam);

  const fairness = calculateOverallFairness(generatedTeams);

  renderTeams(generatedTeams);
  populateMatchSelectors(generatedTeams);
  fairnessValue.textContent = `${fairness}%`;

  const teamsForFirebase = generatedTeams.map((team) => ({
    name: team.name,
    players: team.players,
    rating: calculateTeamRating(team.players)
  }));

  await setDoc(doc(db, "appState", "currentTeams"), {
    teams: teamsForFirebase,
    teamCount,
    playersPerTeam,
    fairness,
    updatedAt: serverTimestamp()
  });

  teamsMessage.textContent = "Teams generated successfully. Now choose two teams and start the match.";
}

async function saveTeamsAndStartMatch() {
  const snap = await getDoc(doc(db, "appState", "currentTeams"));

  if (!snap.exists()) {
    teamsMessage.textContent = "Generate teams first.";
    return;
  }

  const teamsData = snap.data();
  const teams = teamsData.teams || [];

  if (!teams.length) {
    teamsMessage.textContent = "No generated teams found.";
    return;
  }

  const teamAIndex = Number(matchTeamASelect.value);
  const teamBIndex = Number(matchTeamBSelect.value);

  if (matchTeamASelect.value === "" || matchTeamBSelect.value === "") {
    teamsMessage.textContent = "Please choose two teams first.";
    return;
  }

  if (teamAIndex === teamBIndex) {
    teamsMessage.textContent = "Please choose two different teams.";
    return;
  }

  const selectedTeamA = teams[teamAIndex];
  const selectedTeamB = teams[teamBIndex];

  if (!selectedTeamA || !selectedTeamB) {
    teamsMessage.textContent = "Selected teams are invalid.";
    return;
  }

  await setDoc(doc(db, "appState", "currentMatch"), {
    date: new Date().toISOString(),
    teamA: {
      name: selectedTeamA.name,
      players: selectedTeamA.players,
      score: 0
    },
    teamB: {
      name: selectedTeamB.name,
      players: selectedTeamB.players,
      score: 0
    },
    events: [],
    fairness: teamsData.fairness || 0,
    updatedAt: serverTimestamp()
  });

  window.location.href = "match.html";
}

async function loadExistingTeams() {
  const snap = await getDoc(doc(db, "appState", "currentTeams"));
  if (!snap.exists()) return;

  const teamsData = snap.data();

  if (teamsData.teamCount) {
    teamCountInput.value = teamsData.teamCount;
  }

  if (teamsData.playersPerTeam) {
    playersPerTeamInput.value = teamsData.playersPerTeam;
  }

  renderTeams(teamsData.teams || []);
  populateMatchSelectors(teamsData.teams || []);
  fairnessValue.textContent = `${teamsData.fairness || 0}%`;
}

generateTeamsBtn.addEventListener("click", generateTeams);
startMatchBtn.addEventListener("click", saveTeamsAndStartMatch);

loadExistingTeams();