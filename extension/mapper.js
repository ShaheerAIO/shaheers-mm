// Maps raw scraped DoorDash data into the 14-sheet model.
// Direct port of DDScraper/backend/mapper.py.

/**
 * Map raw scrape data to the normalized menu model.
 * @param {object} raw - Output from content.js scrape()
 * @returns {object} Normalized model matching /api/scrape-json response shape
 */
function mapToModel(raw) {
  const source = raw.source || "ld_json";
  return source === "rsc" ? mapRsc(raw) : mapLdJson(raw);
}

// ---------------------------------------------------------------------------
// RSC mapping
// ---------------------------------------------------------------------------

function mapRsc(raw) {
  const storeId = raw.store_id || "unknown";
  const storeName = raw.store_name || "DoorDash Import";
  const itemLists = raw.item_lists || [];

  const menuId = 1;
  let catCounter = 0;
  let itemCounter = 0;
  let catItemCounter = 0;

  const menus = [];
  const categories = [];
  const items = [];
  const categoryItems = [];
  const seenItems = {};

  menus.push({
    id: menuId,
    menuName: storeName,
    posDisplayName: storeName,
    posButtonColor: "#FCA98F",
    picture: null,
    sortOrder: 1,
  });

  for (let catIdx = 0; catIdx < itemLists.length; catIdx++) {
    const itemList = itemLists[catIdx];
    if (!itemList || typeof itemList !== "object") continue;

    catCounter++;
    const catId = catCounter;
    const catName = unescape(itemList.name || `Category ${catId}`);

    categories.push({
      id: catId,
      categoryName: catName,
      posDisplayName: catName,
      kdsDisplayName: catName,
      color: "#FF7B42",
      image: null,
      kioskImage: null,
      parentCategoryId: null,
      tagIds: null,
      menuIds: String(menuId),
      sortOrder: catIdx + 1,
    });

    const listItems = itemList.items || [];

    for (let itemIdx = 0; itemIdx < listItems.length; itemIdx++) {
      const itemRaw = listItems[itemIdx];
      if (!itemRaw || typeof itemRaw !== "object") continue;

      const ddId = itemRaw.id || "";
      const itemName = unescape(itemRaw.name || "").trim();
      if (!itemName) continue;

      const dedupKey = ddId || itemName;
      if (seenItems[dedupKey] !== undefined) {
        catItemCounter++;
        categoryItems.push({
          id: catItemCounter,
          categoryId: catId,
          itemId: seenItems[dedupKey],
          sortOrder: itemIdx + 1,
        });
        continue;
      }

      itemCounter++;
      const itemId = itemCounter;
      seenItems[dedupKey] = itemId;

      const description = unescape(itemRaw.description || "");
      const price = parseDdPrice(itemRaw.displayPrice || "");
      const image = itemRaw.imageUrl || null;

      items.push(buildItem(itemId, itemName, description, price, image));

      catItemCounter++;
      categoryItems.push({
        id: catItemCounter,
        categoryId: catId,
        itemId: itemId,
        sortOrder: itemIdx + 1,
      });
    }
  }

  return buildResult(storeId, menus, categories, items, categoryItems);
}

// ---------------------------------------------------------------------------
// ld+json mapping
// ---------------------------------------------------------------------------

function mapLdJson(raw) {
  const storeId = raw.store_id || "unknown";
  const storeName = raw.store_name || "DoorDash Import";
  const sections = raw.sections || [];

  const menuId = 1;
  let catCounter = 0;
  let itemCounter = 0;
  let catItemCounter = 0;

  const menus = [];
  const categories = [];
  const items = [];
  const categoryItems = [];
  const seenItems = {};

  menus.push({
    id: menuId,
    menuName: storeName,
    posDisplayName: storeName,
    posButtonColor: "#FCA98F",
    picture: null,
    sortOrder: 1,
  });

  for (let catIdx = 0; catIdx < sections.length; catIdx++) {
    const section = sections[catIdx];
    if (!section) continue;

    catCounter++;
    const catId = catCounter;
    const catName = unescape(section.name || `Category ${catId}`);

    categories.push({
      id: catId,
      categoryName: catName,
      posDisplayName: catName,
      kdsDisplayName: catName,
      color: "#FF7B42",
      image: null,
      kioskImage: null,
      parentCategoryId: null,
      tagIds: null,
      menuIds: String(menuId),
      sortOrder: catIdx + 1,
    });

    const menuItems = section.hasMenuItem || [];

    for (let itemIdx = 0; itemIdx < menuItems.length; itemIdx++) {
      const menuItem = menuItems[itemIdx];
      const itemName = unescape(menuItem.name || "").trim();
      if (!itemName) continue;

      if (seenItems[itemName] !== undefined) {
        catItemCounter++;
        categoryItems.push({
          id: catItemCounter,
          categoryId: catId,
          itemId: seenItems[itemName],
          sortOrder: itemIdx + 1,
        });
        continue;
      }

      itemCounter++;
      const itemId = itemCounter;
      seenItems[itemName] = itemId;

      const description = unescape(menuItem.description || "");
      const price = parseSchemaPrice(menuItem);

      items.push(buildItem(itemId, itemName, description, price, null));

      catItemCounter++;
      categoryItems.push({
        id: catItemCounter,
        categoryId: catId,
        itemId: itemId,
        sortOrder: itemIdx + 1,
      });
    }
  }

  return buildResult(storeId, menus, categories, items, categoryItems);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildItem(id, name, description, price, image) {
  return {
    id,
    itemName: name,
    posDisplayName: name,
    kdsName: name,
    itemDescription: description,
    itemPicture: image,
    onlineImage: image,
    landscapeImage: image,
    thirdPartyImage: image,
    kioskItemImage: image,
    itemPrice: price,
    taxLinkedWithParentSetting: true,
    calculatePricesWithTaxIncluded: false,
    takeoutException: false,
    stockStatus: "inStock",
    stockValue: 0,
    orderQuantityLimit: true,
    minLimit: 1,
    maxLimit: 999,
    noMaxLimit: false,
    stationIds: "1",
    preparationTime: null,
    calories: null,
    tagIds: null,
    inheritTagsFromCategory: false,
    saleCategory: "Food Sales",
    allergenIds: null,
    inheritModifiersFromCategory: false,
    addonIds: null,
    isSpecialRequest: true,
  };
}

function buildResult(storeId, menus, categories, items, categoryItems) {
  return {
    store_id: storeId,
    Menu: menus,
    Category: categories,
    Item: items,
    "Item Modifiers": [],
    "Category ModifierGroups": [],
    "Category Modifiers": [],
    "Category Items": categoryItems,
    "Item Modifier Group": [],
    "Modifier Group": [],
    Modifier: [],
    "Modifier Option": [],
    "Modifier ModifierOptions": [],
    Allergen: [],
    Tag: [],
  };
}

function unescape(text) {
  if (!text) return "";
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

function parseDdPrice(displayPrice) {
  if (!displayPrice) return 0;
  const cleaned = displayPrice.replace(/\$/g, "").replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseSchemaPrice(menuItem) {
  const offers = menuItem.offers;
  if (!offers || typeof offers !== "object") return 0;
  const raw = offers.price || 0;
  if (typeof raw === "string") return parseDdPrice(raw);
  return typeof raw === "number" ? raw : 0;
}
