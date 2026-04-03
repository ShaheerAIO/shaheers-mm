// Bridge content script injected on shaheers-mm.vercel.app.
// Reads pending import data from chrome.storage.local and passes it to the React app.

(async () => {
  try {
    const result = await chrome.storage.local.get([
      "ddImportPending",
      "ddImportData",
      "ddImportTimestamp",
    ]);

    if (!result.ddImportPending || !result.ddImportData) return;

    // Ignore stale data (older than 5 minutes)
    if (result.ddImportTimestamp && Date.now() - result.ddImportTimestamp > 5 * 60 * 1000) {
      await chrome.storage.local.remove(["ddImportPending", "ddImportData", "ddImportTimestamp"]);
      return;
    }

    // Clear the flag immediately so we don't re-import on refresh
    await chrome.storage.local.remove(["ddImportPending", "ddImportData", "ddImportTimestamp"]);

    // Wait for React app to mount
    let attempts = 0;
    while (attempts < 50) {
      if (document.getElementById("root")?.children.length > 0) break;
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    // Small extra delay for React hydration
    await new Promise((r) => setTimeout(r, 300));

    window.postMessage(
      {
        type: "DD_EXTENSION_IMPORT",
        data: result.ddImportData,
      },
      "*"
    );
  } catch (err) {
    console.error("[DoorDash Extension] Bridge error:", err);
  }
})();
