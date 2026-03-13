const historyList = document.getElementById("historyList");
const historyEmptyState = document.getElementById("historyEmptyState");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

function renderHistory() {
  const history = getMatchHistory();
  historyList.innerHTML = "";

  if (history.length === 0) {
    historyEmptyState.style.display = "block";
    return;
  }

  historyEmptyState.style.display = "none";

  history.forEach((match) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const scorers = match.events
      .filter((event) => event.type === "goal")
      .map((event) => `${event.minute}' ${event.scorer} (${event.teamName})`)
      .join("<br>");

    const formattedDate = new Date(match.date).toLocaleString();

    item.innerHTML = `
      <strong>${match.teamA.name} ${match.teamA.score} - ${match.teamB.score} ${match.teamB.name}</strong>
      <div class="player-meta">Date: ${formattedDate}</div>
      <div class="player-meta" style="margin-top: 8px;">
        ${scorers || "No scorers recorded"}
      </div>
    `;

    historyList.appendChild(item);
  });
}

function clearHistory() {
  const confirmed = confirm("Are you sure you want to delete all match history?");
  if (!confirmed) return;

  saveMatchHistory([]);
  renderHistory();
}

clearHistoryBtn.addEventListener("click", clearHistory);

renderHistory();