import {
  db,
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from "./firebase.js";

const savedTeamsEmptyState = document.getElementById("savedTeamsEmptyState");
const savedTeamsList = document.getElementById("savedTeamsList");

async function getSavedTeams() {
  const q = query(collection(db, "teams"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

async function removeTeam(teamId) {
  await deleteDoc(doc(db, "teams", teamId));
  await renderSavedTeams();
}

async function renderSavedTeams() {
  const teams = await getSavedTeams();
  savedTeamsList.innerHTML = "";

  if (!teams.length) {
    savedTeamsEmptyState.style.display = "block";
    return;
  }

  savedTeamsEmptyState.style.display = "none";

  teams.forEach((team) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const playersHtml = (team.players || []).length
      ? team.players
          .map(
            (player) => `
              <div class="player-meta">
                ${player.name} | Rating: ${player.rating || 0} | Position: ${player.position || "No position"}
              </div>
            `
          )
          .join("")
      : `<div class="player-meta">No players</div>`;

    item.innerHTML = `
      <div class="section-head">
        <div>
          <strong>${team.name}</strong>
          <div class="player-meta">
            League: ${team.leagueName || "Friendly / Not linked"}
          </div>
          <div class="player-meta">
            Total Rating: ${team.totalRating || 0} | Players: ${(team.players || []).length}
          </div>
        </div>
        <button class="btn btn-danger" type="button">Delete</button>
      </div>

      <div class="players-list" style="margin-top: 14px;">
        ${playersHtml}
      </div>
    `;

    item.querySelector("button").addEventListener("click", async () => {
      await removeTeam(team.id);
    });

    savedTeamsList.appendChild(item);
  });
}

renderSavedTeams();