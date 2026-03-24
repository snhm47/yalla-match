// const STORAGE_KEYS = {
//   players: "mal3abna_players",
//   teams: "mal3abna_teams",
//   currentMatch: "mal3abna_current_match",
//   history: "mal3abna_match_history"
// };

// function getPlayers() {
//   return JSON.parse(localStorage.getItem(STORAGE_KEYS.players)) || [];
// }

// function savePlayers(players) {
//   localStorage.setItem(STORAGE_KEYS.players, JSON.stringify(players));
// }

// function getTeams() {
//   return JSON.parse(localStorage.getItem(STORAGE_KEYS.teams)) || null;
// }

// function saveTeams(teams) {
//   localStorage.setItem(STORAGE_KEYS.teams, JSON.stringify(teams));
// }

// function getCurrentMatch() {
//   return JSON.parse(localStorage.getItem(STORAGE_KEYS.currentMatch)) || null;
// }

// function saveCurrentMatch(match) {
//   localStorage.setItem(STORAGE_KEYS.currentMatch, JSON.stringify(match));
// }

// function clearCurrentMatch() {
//   localStorage.removeItem(STORAGE_KEYS.currentMatch);
// }

// function getMatchHistory() {
//   return JSON.parse(localStorage.getItem(STORAGE_KEYS.history)) || [];
// }

// function saveMatchHistory(history) {
//   localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
// }

// function generateId(prefix = "id") {
//   return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
// }