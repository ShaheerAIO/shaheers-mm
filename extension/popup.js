// Change to "http://127.0.0.1:3000" for local development
const MENU_MANAGER_URL = "https://shaheers-mm.vercel.app";

const states = {
  wrongPage: document.getElementById("state-wrong-page"),
  ready: document.getElementById("state-ready"),
  loading: document.getElementById("state-loading"),
  preview: document.getElementById("state-preview"),
  error: document.getElementById("state-error"),
};

function showState(name) {
  Object.values(states).forEach((el) => el.classList.add("hidden"));
  states[name].classList.remove("hidden");
}

let pendingModel = null;

// ---------------------------------------------------------------------------
// Init — check if we're on a DoorDash store page
// ---------------------------------------------------------------------------

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.url.includes("doordash.com/store/")) {
      showState("wrongPage");
      return;
    }
    showState("ready");
  } catch {
    showState("wrongPage");
  }
}

// ---------------------------------------------------------------------------
// Scrape
// ---------------------------------------------------------------------------

async function doScrape() {
  showState("loading");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const response = await chrome.tabs.sendMessage(tab.id, { action: "scrape" });

    if (!response?.ok || !response.data) {
      throw new Error(
        "Could not find menu data on this page. Try scrolling down to load the full menu, then try again."
      );
    }

    // Map raw data to normalized model (mapper.js is loaded in popup.html)
    const model = mapToModel(response.data);

    if (!model.Item || model.Item.length === 0) {
      throw new Error("Scraping succeeded but no menu items were found.");
    }

    pendingModel = model;

    // Show preview
    const name = model.Menu?.[0]?.menuName || "DoorDash Store";
    const cats = (model.Category || []).length;
    const items = (model.Item || []).length;

    document.getElementById("preview-name").textContent = name;
    document.getElementById("preview-stats").textContent =
      `${cats} categories · ${items} items`;

    showState("preview");
  } catch (err) {
    document.getElementById("error-msg").textContent = err.message;
    showState("error");
  }
}

// ---------------------------------------------------------------------------
// Import — store data and open menu manager
// ---------------------------------------------------------------------------

async function doImport() {
  if (!pendingModel) return;

  await chrome.storage.local.set({
    ddImportPending: true,
    ddImportData: pendingModel,
    ddImportTimestamp: Date.now(),
  });

  await chrome.tabs.create({ url: MENU_MANAGER_URL });
  window.close();
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

document.getElementById("btn-scrape").addEventListener("click", doScrape);
document.getElementById("btn-import").addEventListener("click", doImport);
document.getElementById("btn-retry").addEventListener("click", doScrape);
document.getElementById("btn-error-retry").addEventListener("click", doScrape);

init();
