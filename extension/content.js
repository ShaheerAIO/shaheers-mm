// Content script injected on DoorDash store pages.
// Extracts menu data using two strategies (RSC payload, then ld+json fallback).

(() => {
  /**
   * Parse the store ID from the current URL.
   */
  function parseStoreId() {
    const url = location.href;
    let m = url.match(/\/store\/[^/]+\/(\d+)/);
    if (m) return m[1];
    m = url.match(/\/store\/([^/?]+)/);
    if (m) return m[1];
    return "unknown";
  }

  /**
   * Extract the store name from the ld+json Restaurant block.
   */
  function extractStoreName() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const d = JSON.parse(s.textContent);
        if (d["@type"] === "Restaurant") {
          return d.name || null;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  /**
   * Strategy 1: Extract rich item data from RSC (React Server Components) payload.
   * Returns an array of category objects with nested items.
   */
  function extractRscItemLists() {
    try {
      const scripts = document.querySelectorAll("script");
      let payload = null;

      for (const s of scripts) {
        const t = s.textContent || "";
        if (t.includes("MenuPageItemList") && t.includes("itemLists")) {
          const match = t.match(/self\.__next_f\.push\(\[1,"(.*)"\]\)/s);
          if (match) {
            try {
              payload = JSON.parse('"' + match[1] + '"');
            } catch {
              continue;
            }
          }
        }
      }

      if (!payload) return [];

      const idx = payload.indexOf('"itemLists":[');
      if (idx < 0) return [];

      const arrStart = payload.indexOf("[", idx);
      let bracket = 0;
      let arrEnd = arrStart;
      for (let i = arrStart; i < payload.length; i++) {
        if (payload[i] === "[") bracket++;
        else if (payload[i] === "]") {
          bracket--;
          if (bracket === 0) {
            arrEnd = i + 1;
            break;
          }
        }
      }

      const raw = payload.slice(arrStart, arrEnd);
      const cleaned = raw.replace(/"\$L?[0-9a-f]+"/g, '"__ref__"');
      return JSON.parse(cleaned);
    } catch {
      return [];
    }
  }

  /**
   * Strategy 2 (fallback): Extract menu sections from ld+json.
   */
  function extractLdJsonMenu() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const d = JSON.parse(s.textContent);
          if (d["@type"] === "Menu" || d.hasMenuSection) {
            let sections = d.hasMenuSection || [];
            if (sections.length && Array.isArray(sections[0])) {
              sections = sections[0];
            }
            return sections;
          }
        } catch {
          // ignore
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * HTML entity decode helper.
   */
  function unescape(text) {
    if (!text) return "";
    const el = document.createElement("textarea");
    el.innerHTML = text;
    return el.value;
  }

  /**
   * Main scrape function — returns raw data in the same shape as scraper.py's scrape_store().
   */
  function scrape() {
    const storeId = parseStoreId();
    let storeName = extractStoreName();
    if (storeName) storeName = unescape(storeName);

    const itemLists = extractRscItemLists();

    if (itemLists.length > 0) {
      return {
        store_id: storeId,
        store_name: storeName,
        source: "rsc",
        item_lists: itemLists,
      };
    }

    const sections = extractLdJsonMenu();

    if (sections.length > 0) {
      return {
        store_id: storeId,
        store_name: storeName,
        source: "ld_json",
        sections: sections,
      };
    }

    return null;
  }

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "scrape") {
      const result = scrape();
      sendResponse({ ok: !!result, data: result });
    }
    if (msg.action === "ping") {
      sendResponse({ ok: true, isDoorDash: true });
    }
    return true; // keep channel open for async response
  });
})();
