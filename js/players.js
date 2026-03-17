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

const playerForm = document.getElementById("playerForm");
const playerNameInput = document.getElementById("playerName");
const playerRatingInput = document.getElementById("playerRating");
const playerPositionInput = document.getElementById("playerPosition");
const playersList = document.getElementById("playersList");
const playersEmptyState = document.getElementById("playersEmptyState");
const clearPlayersBtn = document.getElementById("clearPlayersBtn");
const usePositionCheckbox = document.getElementById("usePosition");
const positionGroup = document.getElementById("positionGroup");

function updatePositionVisibility() {
  const shouldShow = usePositionCheckbox.checked;
  positionGroup.classList.toggle("show", shouldShow);
}

async function getPlayers() {
  const q = query(collection(db, "players"), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

async function renderPlayers() {
  const players = await getPlayers();
  playersList.innerHTML = "";

  if (players.length === 0) {
    playersEmptyState.style.display = "block";
    return;
  }

  playersEmptyState.style.display = "none";

  players.forEach((player) => {
    const item = document.createElement("div");
    item.className = "player-item";

    const positionText = player.position ? player.position : "No position";

    item.innerHTML = `
      <div>
        <strong>${player.name}</strong>
        <div class="player-meta">Rating: ${player.rating} | Position: ${positionText}</div>
      </div>
      <button class="btn btn-danger" type="button">Delete</button>
    `;

    item.querySelector("button").addEventListener("click", async () => {
      await deletePlayer(player.id);
    });

    playersList.appendChild(item);
  });
}

async function addPlayer(event) {
  event.preventDefault();

  const name = playerNameInput.value.trim();
  const rating = Number(playerRatingInput.value);
  const position = usePositionCheckbox.checked ? playerPositionInput.value : "";

  if (!name) {
    alert("Please enter a player name.");
    return;
  }

  if (rating < 1 || rating > 10) {
    alert("Rating must be between 1 and 10.");
    return;
  }

  await addDoc(collection(db, "players"), {
    name,
    rating,
    position,
    createdAt: serverTimestamp()
  });

  playerForm.reset();
  playerRatingInput.value = 5;
  playerPositionInput.value = "GK";
  usePositionCheckbox.checked = false;
  updatePositionVisibility();

  await renderPlayers();
}

async function deletePlayer(playerId) {
  await deleteDoc(doc(db, "players", playerId));
  await renderPlayers();
}

async function clearAllPlayers() {
  const confirmed = confirm("Are you sure you want to delete all players?");
  if (!confirmed) return;

  const players = await getPlayers();
  await Promise.all(
    players.map((player) => deleteDoc(doc(db, "players", player.id)))
  );

  await renderPlayers();
}

usePositionCheckbox.addEventListener("change", updatePositionVisibility);
playerForm.addEventListener("submit", addPlayer);
clearPlayersBtn.addEventListener("click", clearAllPlayers);

updatePositionVisibility();
renderPlayers();