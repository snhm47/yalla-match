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
      leagueName: teamData.leagueName || "",
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

function attachLeagueCardEvents() {
  leaguesList.querySelectorAll(".league-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      const clickedInteractive = event.target.closest("button");
      if (clickedInteractive) return;

      const leagueId = card.dataset.leagueId;
      window.open(`league-details.html?id=${encodeURIComponent(leagueId)}`, "_blank");
    });
  });

  leaguesList.querySelectorAll(".remove-team-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const leagueId = button.dataset.leagueId;
      const teamId = button.dataset.teamId;
      await removeTeamFromLeague(leagueId, teamId);
    });
  });

  leaguesList.querySelectorAll(".delete-league-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const leagueId = button.dataset.leagueId;
      await deleteLeagueById(leagueId);
    });
  });
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

    const item = document.createElement("div");
    item.className = "history-item league-card";
    item.dataset.leagueId = league.id;
    item.style.cursor = "pointer";

    const teamsHtml = teams.length
      ? teams.map((team) => createTeamHtml(league.id, team)).join("")
      : `<div class="empty-state">No teams added to this league yet.</div>`;

    item.innerHTML = `
      <div class="section-head">
        <div>
          <strong>${league.name}</strong>
          <div class="player-meta">Season: ${league.season || "No season"}</div>
          <div class="player-meta">Teams in league: ${teams.length}</div>
          <div class="player-meta">Click this row to open league details.</div>
        </div>
        <button class="btn btn-danger delete-league-btn" type="button" data-league-id="${league.id}">
          Delete League
        </button>
      </div>

      <div class="players-list league-teams-list">
        ${teamsHtml}
      </div>
    `;

    leaguesList.appendChild(item);
  }

  attachLeagueCardEvents();
}

leagueForm.addEventListener("submit", addLeague);
addTeamToLeagueBtn.addEventListener("click", addTeamToLeague);

populateLeagueSelect();
populateTeamSelect();
renderLeagues();