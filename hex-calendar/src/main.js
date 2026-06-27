import { HexCalendarGame } from "./game.js?v=20260628-traypack1";

async function main() {
  const response = await fetch("./public/data/puzzle.json");
  if (!response.ok) {
    throw new Error(`Could not load puzzle data: ${response.status}`);
  }
  const data = await response.json();
  const root = document.querySelector("#app");
  new HexCalendarGame(root, data);
}

main().catch((error) => {
  const root = document.querySelector("#app");
  root.innerHTML = `<main class="load-error">Failed to load puzzle data.</main>`;
  console.error(error);
});
