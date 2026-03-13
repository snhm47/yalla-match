import {
  db,
  collection,
  getDocs,
  query,
  orderBy
} from "./firebase.js";

const historyList = document.getElementById("historyList");
const historyEmptyState = document.getElementById("historyEmptyState");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

async function renderHistory() {
  const q = query(collection(db, "matches"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  historyList.innerHTML = "";

  if (snapshot.empty) {
    historyEmptyState.style.display = "block";
    return;
  }

  historyEmptyState.style.display = "none";

  snapshot.forEach((docSnap) => {
    const match = docSnap.data();
    const item = document.createElement("div");
    item.className = "history-item";

    const scorers = (match.events || [])
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

clearHistoryBtn.style.display = "none";
renderHistory();