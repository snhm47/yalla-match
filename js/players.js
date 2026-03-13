const playerForm = document.getElementById("playerForm");
const playerNameInput = document.getElementById("playerName");
const playerRatingInput = document.getElementById("playerRating");
const playerPositionInput = document.getElementById("playerPosition");
const playersList = document.getElementById("playersList");
const playersEmptyState = document.getElementById("playersEmptyState");
const clearPlayersBtn = document.getElementById("clearPlayersBtn");

function renderPlayers() {
  const players = getPlayers();
  playersList.innerHTML = "";

  if (players.length === 0) {
    playersEmptyState.style.display = "block";
    return;
  }

  playersEmptyState.style.display = "none";

  players.forEach((player) => {
    const item = document.createElement("div");
    item.className = "player-item";

    item.innerHTML = `
      <div>
        <strong>${player.name}</strong>
        <div class="player-meta">Rating: ${player.rating} | Position: ${player.position}</div>
      </div>
      <button class="btn btn-danger" data-id="${player.id}">Delete</button>
    `;

    const deleteBtn = item.querySelector("button");
    deleteBtn.addEventListener("click", () => deletePlayer(player.id));

    playersList.appendChild(item);
  });
}

function addPlayer(event) {
  event.preventDefault();

  const name = playerNameInput.value.trim();
  const rating = Number(playerRatingInput.value);
  const position = playerPositionInput.value;

  if (!name) {
    alert("Please enter a player name.");
    return;
  }

  if (rating < 1 || rating > 10) {
    alert("Rating must be between 1 and 10.");
    return;
  }

  const players = getPlayers();

  const newPlayer = {
    id: generateId("player"),
    name,
    rating,
    position
  };

  players.push(newPlayer);
  savePlayers(players);

  playerForm.reset();
  playerRatingInput.value = 5;
  playerPositionInput.value = "GK";

  renderPlayers();
}

function deletePlayer(playerId) {
  const players = getPlayers().filter((player) => player.id !== playerId);
  savePlayers(players);
  renderPlayers();
}

function clearAllPlayers() {
  const confirmed = confirm("Are you sure you want to delete all players?");
  if (!confirmed) return;

  savePlayers([]);
  renderPlayers();
}

playerForm.addEventListener("submit", addPlayer);
clearPlayersBtn.addEventListener("click", clearAllPlayers);

renderPlayers();