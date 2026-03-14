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
  return team.reduce((sum, player) => sum + Number(player.rating), 0);
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
  const sorted = [...players].sort((a, b) => b.rating - a.rating);

  const teams = Array.from({ length: teamCount }, (_, index) => ({
    name: `Team ${index + 1}`,
    players: [],
    rating: 0
  }));

  for (const player of sorted) {
    const availableTeams = teams.filter(
      (team) => team.players.length < playersPerTeam
    );

    if (availableTeams.length === 0) break;

    availableTeams.sort((a, b) => a.rating - b.rating);

    availableTeams[0].players.push(player);
    availableTeams[0].rating += Number(player.rating);
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
          .map((player) => {
            const positionText = player.position
              ? ` | Position: ${player.position}`
              : "";

            return `
              <div class="team-player">
                <strong>${player.name}</strong>
                <div class="player-meta">Rating: ${player.rating}${positionText}</div>
              </div>
            `;
          })
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

  const usablePlayers = players.slice(0, neededPlayers);

  const mode = splitModeSelect.value;
  const generatedTeams =
    mode === "balanced"
      ? generateBalancedTeams(usablePlayers, teamCount, playersPerTeam)
      : generateRandomTeams(usablePlayers, teamCount, playersPerTeam);

  const fairness = calculateOverallFairness(generatedTeams);

  renderTeams(generatedTeams);
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

  teamsMessage.textContent = "Teams generated successfully.";
}

async function saveTeamsAndStartMatch() {
  const snap = await getDoc(doc(db, "appState", "currentTeams"));

  if (!snap.exists()) {
    teamsMessage.textContent = "Generate teams first.";
    return;
  }

  const teamsData = snap.data();

  await setDoc(doc(db, "appState", "currentMatch"), {
    date: new Date().toISOString(),
    teams: teamsData.teams.map((team) => ({
      name: team.name,
      players: team.players,
      score: 0
    })),
    events: [],
    fairness: teamsData.fairness,
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
  fairnessValue.textContent = `${teamsData.fairness || 0}%`;
}

generateTeamsBtn.addEventListener("click", generateTeams);
startMatchBtn.addEventListener("click", saveTeamsAndStartMatch);

loadExistingTeams();