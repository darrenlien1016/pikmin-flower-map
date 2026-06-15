// =======================
// Pikmin 花朵地圖
// 功能：花點倒數、本機儲存、GPS、清單互動、今日路線
// =======================

// 預設地圖中心：臺北市中正區羅斯福路一段91號附近
const defaultCenter = [25.031037, 121.51977];
const defaultZoom = 16;

// 讀取上一次地圖中心
function loadLastMapView() {
  const saved = localStorage.getItem("pikminLastMapView");

  if (!saved) {
    return {
      center: defaultCenter,
      zoom: defaultZoom
    };
  }

  try {
    const data = JSON.parse(saved);

    if (
      typeof data.lat === "number" &&
      typeof data.lng === "number" &&
      typeof data.zoom === "number"
    ) {
      return {
        center: [data.lat, data.lng],
        zoom: data.zoom
      };
    }
  } catch (error) {
    console.error("讀取上次地圖中心失敗", error);
  }

  return {
    center: defaultCenter,
    zoom: defaultZoom
  };
}

// 先用「上一次地圖中心」或「預設中心」建立地圖
const initialView = loadLastMapView();

const map = L.map("map").setView(initialView.center, initialView.zoom);

// 載入 OpenStreetMap 地圖
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// 儲存目前地圖中心
function saveMapView() {
  const center = map.getCenter();

  localStorage.setItem(
    "pikminLastMapView",
    JSON.stringify({
      lat: center.lat,
      lng: center.lng,
      zoom: map.getZoom()
    })
  );
}

// 地圖移動或縮放後，記住目前中心
map.on("moveend zoomend", function () {
  saveMapView();

  if (!lastGpsPosition && flowerSortMode === "distance") {
    renderAll();
  }
});

// =======================
// GPS 定位
// =======================

let userLocationMarker = null;
let lastGpsPosition = null;

// 每次開啟網頁時，嘗試抓 GPS 位置
function centerToGpsOnLoad() {
  if (!navigator.geolocation) {
    console.warn("這個瀏覽器不支援 GPS 定位");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      lastGpsPosition = { lat, lng };

      map.setView([lat, lng], Math.max(map.getZoom(), 16), {
        animate: true
      });

      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }

      userLocationMarker = L.circleMarker([lat, lng], {
        radius: 8,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.6
      })
        .addTo(map)
        .bindPopup("你目前的位置");

      saveMapView();
    },
    function (error) {
      console.warn("GPS 定位失敗，改用上一次地圖中心", error);
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000
    }
  );
}

// 使用者手動按「定位」時，把地圖中心移到 GPS 位置
function centerToGps() {
  if (!navigator.geolocation) {
    alert("這個瀏覽器不支援 GPS 定位");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      lastGpsPosition = { lat, lng };

      map.setView([lat, lng], 17, {
        animate: true
      });

      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }

      userLocationMarker = L.circleMarker([lat, lng], {
        radius: 8,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.6
      })
        .addTo(map)
        .bindPopup("你目前的位置")
        .openPopup();

      saveMapView();
    },
    function (error) {
      console.warn("GPS 定位失敗", error);
      alert("無法取得 GPS 定位。可能是瀏覽器未允許定位，或目前使用 file:// 本機檔案開啟。之後用手機 HTTPS 網址測試會比較準。");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

window.centerToGps = centerToGps;

// =======================
// 備份 / 匯出 / 匯入
// =======================

function exportBackup() {
  const validRouteIds = routeIds.filter((id) => findFlower(id));

  const backupData = {
    appName: "Pikmin 花朵地圖",
    appVersion: APP_VERSION,
    backupVersion: 2,
    exportedAt: new Date().toISOString(),
    flowerCount: flowers.length,
    routeCount: validRouteIds.length,
    flowers,
    routeIds,
    lastMapView: localStorage.getItem("pikminLastMapView")
  };

  const jsonText = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonText], {
    type: "application/json"
  });

  const dateText = new Date().toISOString().slice(0, 10);
  const fileName = `pikmin_flower_backup_${dateText}.json`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  trackEvent("export_backup", {
  flower_count: flowers.length,
  route_count: validRouteIds.length
});

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function shareBackupText() {
  const validRouteIds = routeIds.filter((id) => findFlower(id));

  trackEvent("share_backup", {
  flower_count: flowers.length,
  route_count: validRouteIds.length
});

  const now = new Date();

  const nowText = now.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  const dateText = now.toISOString().slice(0, 10);

  const backupData = {
    appName: "Pikmin 花朵地圖",
    appVersion: APP_VERSION,
    backupVersion: 2,
    exportedAt: now.toISOString(),
    flowerCount: flowers.length,
    routeCount: validRouteIds.length,
    flowers,
    routeIds,
    lastMapView: localStorage.getItem("pikminLastMapView")
  };

  const jsonText = JSON.stringify(backupData, null, 2);

  const fileName = `pikmin_flower_backup_${dateText}.json`;

  const shareText =
    `我分享 Pikmin 花朵地圖備份給你 🌸\n\n` +
    `版本：${APP_VERSION}\n` +
    `分享時間：${nowText}\n` +
    `花點數：${flowers.length}\n` +
    `路線點數：${validRouteIds.length}\n\n` +
    `使用方式：\n` +
    `1. 打開 Pikmin 花朵地圖\n` +
    `2. 按「匯入」\n` +
    `3. 選擇這個 JSON 備份檔\n` +
    `4. 匯入時可以選「合併」，就不會洗掉原本的花點`;

  const backupFile = new File([jsonText], fileName, {
    type: "application/json"
  });

  // 手機若支援檔案分享，就一次分享文字 + JSON 檔
  if (
    navigator.canShare &&
    navigator.canShare({ files: [backupFile] }) &&
    navigator.share
  ) {
    navigator.share({
      title: "Pikmin 花朵地圖備份",
      text: shareText,
      files: [backupFile]
    }).catch(function (error) {
      console.warn("分享取消或失敗", error);
    });

    return;
  }

  // 如果不支援檔案分享，就退回只複製文字
  if (navigator.clipboard) {
    navigator.clipboard.writeText(
      shareText +
      `\n\n提醒：這台手機不支援直接分享備份檔，請另外按「備份」下載 JSON 檔後一起傳。`
    ).then(function () {
      alert("分享文字已複製，可以貼到 LINE。請另外按「備份」把 JSON 檔一起傳給對方。");
    }).catch(function () {
      prompt("請複製以下文字貼到 LINE：", shareText);
    });

    return;
  }

  prompt("請複製以下文字貼到 LINE：", shareText);
}

function triggerImportBackup() {
  const input = document.getElementById("importBackupInput");

  if (!input) {
    alert("找不到匯入元件，請確認 index.html 是否已加入 importBackupInput。");
    return;
  }

  input.value = "";
  input.click();
}

function normalizeFlowerName(name) {
  return (name || "").trim().toLowerCase();
}

function normalizeFlowerId(id) {
  return String(id || "");
}

function getFlowerCoordinateKey(flower) {
  const lat = Number(flower.lat);
  const lng = Number(flower.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return "";
  }

  // 小數點 5 位，大約接近 1 公尺等級
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function getDuplicateMatch(existingFlower, importedFlower) {
  const existingId = normalizeFlowerId(existingFlower.id);
  const importedId = normalizeFlowerId(importedFlower.id);

  const sameId =
    existingFlower.id !== undefined &&
    importedFlower.id !== undefined &&
    existingId === importedId;

  const sameName =
    normalizeFlowerName(existingFlower.name) ===
    normalizeFlowerName(importedFlower.name);

  const keyA = getFlowerCoordinateKey(existingFlower);
  const keyB = getFlowerCoordinateKey(importedFlower);
  const sameCoordinateKey = keyA && keyB && keyA === keyB;

  const distance = getDistanceMeters(
    Number(existingFlower.lat),
    Number(existingFlower.lng),
    Number(importedFlower.lat),
    Number(importedFlower.lng)
  );

  // 1. 座標幾乎完全一樣，直接視為同一個花點
  if (sameCoordinateKey) {
    return {
      duplicated: true,
      sameName,
      sameId,
      reason: "sameCoordinate"
    };
  }

  // 2. 座標非常接近，視為同一個花點
  if (distance <= 100) {
    return {
      duplicated: true,
      sameName,
      sameId,
      reason: "nearCoordinate"
    };
  }

  // 3. ID 相同，但座標也要接近，才視為同一個花點
  if (sameId && distance <= 200) {
    return {
      duplicated: true,
      sameName,
      sameId,
      reason: "sameIdAndNearCoordinate"
    };
  }

  // 4. 名稱相同，但座標也要接近，才視為同一個花點
  if (sameName && distance <= 200) {
    return {
      duplicated: true,
      sameName,
      sameId,
      reason: "sameNameAndNearCoordinate"
    };
  }

  // ID 相同但座標差很遠，不當作同一點
  // 名稱相同但座標差很遠，也不當作同一點
  return {
    duplicated: false,
    sameName,
    sameId,
    reason: "notDuplicated"
  };
}

function isSameFlower(a, b) {
  return getDuplicateMatch(a, b).duplicated;
}

function mergeImportedFlowers(currentFlowers, importedFlowers) {
  const mergedFlowers = [...currentFlowers];

  let addedCount = 0;
  let skippedCount = 0;
  let skippedSameNameCount = 0;
  let skippedDifferentNameCount = 0;
  let skippedSameIdCount = 0;
  let skippedDifferentIdCount = 0;

  importedFlowers.forEach((importedFlower) => {
    let duplicateMatch = null;

    const duplicated = mergedFlowers.some((existingFlower) => {
      const match = getDuplicateMatch(existingFlower, importedFlower);

      if (match.duplicated) {
        duplicateMatch = match;
        return true;
      }

      return false;
    });

    if (duplicated) {
      skippedCount += 1;

      if (duplicateMatch && duplicateMatch.sameName) {
        skippedSameNameCount += 1;
      } else {
        skippedDifferentNameCount += 1;
      }

      if (duplicateMatch && duplicateMatch.sameId) {
        skippedSameIdCount += 1;
      } else {
        skippedDifferentIdCount += 1;
      }

      return;
    }

    mergedFlowers.push({
      ...importedFlower,
      id: Date.now() + Math.floor(Math.random() * 1000000),
      type: importedFlower.type || "",
      updatedAt: new Date().toISOString()
    });

    addedCount += 1;
  });

  return {
    mergedFlowers,
    addedCount,
    skippedCount,
    skippedSameNameCount,
    skippedDifferentNameCount,
    skippedSameIdCount,
    skippedDifferentIdCount
  };
}

function formatBackupTime(isoText) {
  if (!isoText) {
    return "未記錄";
  }

  const date = new Date(isoText);

  if (Number.isNaN(date.getTime())) {
    return "時間格式不明";
  }

  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function importBackupFromFile(file) {
  const reader = new FileReader();

  reader.onload = function (event) {
    try {
      const data = JSON.parse(event.target.result);

      if (!data || !Array.isArray(data.flowers)) {
        alert("備份檔格式不正確，找不到花點資料。");
        return;
      }

      const backupAppName = data.appName || "未知工具";
      const backupAppVersion = data.appVersion || "未記錄";
      const backupTime = formatBackupTime(data.exportedAt);
      const backupFlowerCount = Array.isArray(data.flowers)
        ? data.flowers.length
        : 0;
      const backupRouteCount = Array.isArray(data.routeIds)
        ? data.routeIds.length
        : 0;

      const importMode = prompt(
        `即將匯入備份資料：\n\n` +
        `工具：${backupAppName}\n` +
        `版本：${backupAppVersion}\n` +
        `匯出時間：${backupTime}\n` +
        `花點數：${backupFlowerCount}\n` +
        `路線點數：${backupRouteCount}\n\n` +
        `請選擇匯入方式：\n\n` +
        `1 = 覆蓋目前資料\n` +
        `2 = 合併到目前資料\n\n` +
        `按取消 = 不匯入`
      );

      if (importMode === null) {
        return;
      }

      const mode = importMode.trim();

      if (mode !== "1" && mode !== "2") {
        alert("請輸入 1 或 2。");
        return;
      }

      // 1 = 覆蓋目前資料
      if (mode === "1") {
        const ok = confirm(
          `你選擇「覆蓋目前資料」。\n\n` +
          `目前手機裡的花點與路線資料會被備份檔取代。\n\n` +
          `確定要繼續嗎？`
        );

        if (!ok) {
          return;
        }

        flowers = data.flowers.map((flower) => ({
          ...flower,
          type: flower.type || ""
        }));

        routeIds = Array.isArray(data.routeIds) ? data.routeIds : [];

        saveFlowers();
        saveRoute();

        if (data.lastMapView) {
          localStorage.setItem("pikminLastMapView", data.lastMapView);
        }

        selectedFlowerId = null;
        renderAll();

trackEvent("import_backup", {
  mode: "overwrite",
  flower_count: flowers.length,
  route_count: routeIds.filter((id) => findFlower(id)).length
});

        alert(
          `覆蓋匯入完成！\n\n` +
          `花點數：${flowers.length}\n` +
          `路線點數：${routeIds.filter((id) => findFlower(id)).length}`
        );

        return;
      }

      // 2 = 合併到目前資料
      if (mode === "2") {
        const result = mergeImportedFlowers(flowers, data.flowers);

        flowers = result.mergedFlowers;

        // 合併模式下：保留目前路線，不自動匯入對方路線
        // 因為對方的路線順序不一定適合你目前的位置與規劃
        saveFlowers();
        saveRoute();

        selectedFlowerId = null;
        renderAll();

trackEvent("merge_import", {
  added_count: result.addedCount,
  skipped_count: result.skippedCount,
  flower_count: flowers.length
});

       alert(
  `合併匯入完成！\n\n` +
  `原本花點數：${flowers.length - result.addedCount}\n` +
  `新增花點數：${result.addedCount}\n` +
  `略過重複花點：${result.skippedCount}\n` +
  `　其中名稱相同：${result.skippedSameNameCount}\n` +
  `　其中名稱不同：${result.skippedDifferentNameCount}\n` +
  `　其中 ID 相同：${result.skippedSameIdCount}\n` +
  `　其中 ID 不同：${result.skippedDifferentIdCount}\n` +
  `目前花點總數：${flowers.length}\n\n` +
  `提醒：合併模式會保留你原本的路線，不會匯入對方路線。`
);
      }
    } catch (error) {
      console.error("匯入備份失敗", error);
      alert("匯入失敗，請確認檔案是否為正確的 JSON 備份檔。");
    }
  };

  reader.readAsText(file);
}

window.exportBackup = exportBackup;
window.triggerImportBackup = triggerImportBackup;
window.shareBackupText = shareBackupText;

// =======================
// 本機儲存
// =======================

const APP_VERSION = "v0.3";

function trackEvent(eventName, params = {}) {
  console.log("GA event:", eventName, params);

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, {
      app_version: APP_VERSION,
      ...params
    });
    return;
  }

  console.warn("gtag 尚未載入，事件未送出：", eventName);
}

let flowers = loadFlowers();
let routeIds = loadRoute();
let selectedFlowerId = null;
let flowerSearchText = "";
let flowerSortMode = "time";

function loadFlowers() {
  const saved = localStorage.getItem("pikminFlowers");

  if (!saved) {
    return [];
  }

  try {
return JSON.parse(saved).map((flower) => ({
  ...flower,
  type: flower.type || ""
}));
  } catch (error) {
    console.error("讀取花點資料失敗", error);
    return [];
  }
}

function saveFlowers() {
  localStorage.setItem("pikminFlowers", JSON.stringify(flowers));
}

function loadRoute() {
  const saved = localStorage.getItem("pikminRoute");

  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error("讀取路線資料失敗", error);
    return [];
  }
}

function saveRoute() {
  localStorage.setItem("pikminRoute", JSON.stringify(routeIds));
}

// =======================
// 面板收合
// =======================

let activePanel = null;

function closePanel() {
  const panel = document.getElementById("bottomPanel");

  panel.classList.remove("panel-open");
  panel.classList.add("panel-closed");

  document.getElementById("routePanel").classList.remove("active");
  document.getElementById("flowerPanel").classList.remove("active");

  document.getElementById("routeButton").classList.remove("active");
  document.getElementById("flowerButton").classList.remove("active");

  activePanel = null;
}

function openPanel(type) {
  const panel = document.getElementById("bottomPanel");
  const title = document.getElementById("panelTitle");
  const routePanel = document.getElementById("routePanel");
  const flowerPanel = document.getElementById("flowerPanel");
  const routeButton = document.getElementById("routeButton");
  const flowerButton = document.getElementById("flowerButton");

  // 如果點同一顆按鈕，就收合
  if (activePanel === type && panel.classList.contains("panel-open")) {
    closePanel();
    return;
  }

  activePanel = type;

  panel.classList.remove("panel-closed");
  panel.classList.add("panel-open");

  routePanel.classList.remove("active");
  flowerPanel.classList.remove("active");
  routeButton.classList.remove("active");
  flowerButton.classList.remove("active");

  if (type === "route") {
    title.innerText = "路線";
    routePanel.classList.add("active");
    routeButton.classList.add("active");
  }

  if (type === "flowers") {
    title.innerText = "花朵";
    flowerPanel.classList.add("active");
    flowerButton.classList.add("active");
  }

updatePanelStats();
}

function forceOpenPanel(type) {
  const panel = document.getElementById("bottomPanel");
  const title = document.getElementById("panelTitle");
  const routePanel = document.getElementById("routePanel");
  const flowerPanel = document.getElementById("flowerPanel");
  const routeButton = document.getElementById("routeButton");
  const flowerButton = document.getElementById("flowerButton");

  activePanel = type;

  panel.classList.remove("panel-closed");
  panel.classList.add("panel-open");

  routePanel.classList.remove("active");
  flowerPanel.classList.remove("active");
  routeButton.classList.remove("active");
  flowerButton.classList.remove("active");

  if (type === "route") {
    title.innerText = "路線";
    routePanel.classList.add("active");
    routeButton.classList.add("active");
  }

  if (type === "flowers") {
    title.innerText = "花朵";
    flowerPanel.classList.add("active");
    flowerButton.classList.add("active");
  }

  updatePanelStats();
}

window.openPanel = openPanel;
window.closePanel = closePanel;

// =======================
// 時間處理
// =======================

function parseRemainingTime(input) {
  let text = input.trim();

  if (!text) {
    alert("請輸入剩餘時間，例如 2200 或 22:00");
    return null;
  }

  let hours = 0;
  let minutes = 0;

  if (text.includes(":")) {
    const parts = text.split(":");

    if (parts.length !== 2) {
      alert("時間格式錯誤，請輸入例如 22:00 或 2200");
      return null;
    }

    hours = Number(parts[0]);
    minutes = Number(parts[1]);
  } else {
    text = text.replace(/\D/g, "");

    if (!text) {
      alert("時間格式錯誤，請輸入例如 2200 或 22:00");
      return null;
    }

    if (text.length === 4) {
      hours = Number(text.slice(0, 2));
      minutes = Number(text.slice(2, 4));
    } else if (text.length === 3) {
      hours = Number(text.slice(0, 1));
      minutes = Number(text.slice(1, 3));
    } else if (text.length <= 2) {
      const totalMinutes = Number(text);
      hours = Math.floor(totalMinutes / 60);
      minutes = totalMinutes % 60;
    } else {
      alert("時間格式錯誤，請輸入例如 2200、0130、130 或 22:00");
      return null;
    }
  }

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    minutes < 0 ||
    minutes >= 60
  ) {
    alert("時間格式錯誤，分鐘必須是 00 到 59");
    return null;
  }

  const now = new Date();
  const endTime = new Date(now.getTime() + (hours * 60 + minutes) * 60 * 1000);

  return endTime;
}

function getRemainingMs(endTime) {
  const now = new Date();
  return new Date(endTime).getTime() - now.getTime();
}

function getRemainingText(endTime) {
  const diffMs = getRemainingMs(endTime);

  if (diffMs <= 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getRemainingMinutes(endTime) {
  return Math.floor(getRemainingMs(endTime) / 1000 / 60);
}

// 時間到之後，自動進入下一輪 23 小時，並改為未人工確認
function applyAutoCycle() {
  const now = new Date();
  let changed = false;

  flowers.forEach((flower) => {
    let end = new Date(flower.endTime);

    while (end.getTime() <= now.getTime()) {
      end = new Date(end.getTime() + 23 * 60 * 60 * 1000);
      flower.confirmed = false;
      flower.fruitTaken = false;
      changed = true;
    }

    flower.endTime = end.toISOString();
  });

  if (changed) {
    saveFlowers();
  }
}

function getFlowerStatus(flower) {
  const diffMinutes = getRemainingMinutes(flower.endTime);

  if (flower.fruitTaken) {
    return "已拿果";
  }

  if (!flower.confirmed) {
    return "未人工確認";
  }

  if (diffMinutes <= 60) {
    return "快結束";
  }

  if (diffMinutes <= 23 * 60 && diffMinutes >= 22 * 60) {
    return "剛開花，可採果";
  }

  return "一般";
}

function getFlowerClass(flower) {
  const diffMinutes = getRemainingMinutes(flower.endTime);

  if (flower.fruitTaken) {
    return "flower-taken";
  }

  if (!flower.confirmed) {
    return "flower-unconfirmed";
  }

  if (diffMinutes <= 60) {
    return "flower-ending";
  }

  if (diffMinutes <= 23 * 60 && diffMinutes >= 22 * 60) {
    return "flower-bloom";
  }

  return "flower-normal";
}

function getListStatusClass(flower) {
  const diffMinutes = getRemainingMinutes(flower.endTime);

  if (flower.fruitTaken) {
    return "list-taken";
  }

  if (!flower.confirmed) {
    return "list-unconfirmed";
  }

  if (diffMinutes <= 60) {
    return "list-ending";
  }

  if (diffMinutes <= 23 * 60 && diffMinutes >= 22 * 60) {
    return "list-bloom";
  }

  return "";
}

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;
  const toRad = (value) => value * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function getReferencePosition() {
  if (lastGpsPosition) {
    return {
      lat: lastGpsPosition.lat,
      lng: lastGpsPosition.lng,
      source: "gps"
    };
  }

  const center = map.getCenter();

  return {
    lat: center.lat,
    lng: center.lng,
    source: "map"
  };
}

function getFlowerDistanceMeters(flower) {
  const reference = getReferencePosition();

  return getDistanceMeters(
    reference.lat,
    reference.lng,
    flower.lat,
    flower.lng
  );
}

function getFlowerDistanceText(flower) {
  const reference = getReferencePosition();
  const meters = getFlowerDistanceMeters(flower);

  const prefix = reference.source === "gps"
    ? "距離：約 "
    : "距離：依地圖中心約 ";

  if (meters < 1000) {
    return `${prefix}${Math.round(meters)} m`;
  }

  return `${prefix}${(meters / 1000).toFixed(1)} km`;
}

function handleFlowerSearchInput() {
  const input = document.getElementById("flowerSearchInput");
  flowerSearchText = input ? input.value.trim().toLowerCase() : "";
  renderAll();
}

function handleFlowerSortChange() {
  const select = document.getElementById("flowerSortSelect");
  flowerSortMode = select ? select.value : "time";
  renderAll();
}

window.handleFlowerSearchInput = handleFlowerSearchInput;
window.handleFlowerSortChange = handleFlowerSortChange;


// =======================
// 花點操作
// =======================

function addFlower(lat, lng) {
  const name = prompt("請輸入花名，例如：南門市場旁");

  if (name === null) {
    return;
  }

  const timeInput = prompt("請輸入剩餘時間，例如 2200 或 22:00");

  if (timeInput === null) {
    return;
  }

  const endTime = parseRemainingTime(timeInput);

  if (!endTime) {
    return;
  }

  const typeInput = prompt("請輸入花朵類型，可留空，例如：紅花、藍花、白花、特殊花");

if (typeInput === null) {
  return;
}

const flower = {
  id: Date.now(),
  name: name.trim() || "未命名花朵",
  type: typeInput.trim(),
  lat,
  lng,
  endTime: endTime.toISOString(),
  confirmed: true,
  fruitTaken: false,
  note: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

  flowers.push(flower);

  trackEvent("add_flower", {
  has_type: Boolean(flower.type)
});

  selectedFlowerId = flower.id;

  saveFlowers();
  renderAll();
  focusFlower(flower.id);
}

function findFlower(id) {
  return flowers.find((flower) => flower.id === id);
}

function updateFlowerTime(id) {
  const flower = findFlower(id);

  if (!flower) {
    return;
  }

  const timeInput = prompt(
    `請輸入「${flower.name}」新的剩餘時間，例如 2200 或 22:00`
  );

  if (timeInput === null) {
    return;
  }

  const endTime = parseRemainingTime(timeInput);

  if (!endTime) {
    return;
  }

  flower.endTime = endTime.toISOString();
  flower.confirmed = true;
  flower.updatedAt = new Date().toISOString();

  trackEvent("update_flower_time");

  saveFlowers();
  renderAll();
  focusFlower(id);
}

function editFlowerInfo(id) {
  const flower = findFlower(id);

  if (!flower) {
    return;
  }

  const newName = prompt("請輸入花朵名稱", flower.name || "");

  if (newName === null) {
    return;
  }

  const newType = prompt("請輸入花朵類型，可留空", flower.type || "");

  if (newType === null) {
    return;
  }

  flower.name = newName.trim() || "未命名花朵";
  flower.type = newType.trim();
  flower.updatedAt = new Date().toISOString();

  saveFlowers();
  keepFlowerPanelOpen(id);
}

function toggleFruitTaken(id) {
  const flower = findFlower(id);

  if (!flower) {
    return;
  }

  flower.fruitTaken = !flower.fruitTaken;
  flower.updatedAt = new Date().toISOString();

  saveFlowers();

  // 按「標記已拿果」或「改未拿果」後，保持花朵清單開啟
  keepFlowerPanelOpen(id);
}

function deleteFlower(id) {
  const flower = findFlower(id);

  if (!flower) {
    return;
  }

  const ok = confirm(`確定要刪除「${flower.name}」嗎？`);

  if (!ok) {
    return;
  }

  flowers = flowers.filter((flower) => flower.id !== id);
  routeIds = routeIds.filter((routeId) => routeId !== id);

  if (selectedFlowerId === id) {
    selectedFlowerId = null;
  }

  saveFlowers();
  saveRoute();
  renderAll();
}

function focusFlower(id) {
  const flower = findFlower(id);

  if (!flower) {
    return;
  }

  selectedFlowerId = id;

  map.setView([flower.lat, flower.lng], Math.max(map.getZoom(), 16), {
    animate: true
  });

  openPanel("flowers");
  renderAll();

  setTimeout(() => {
    const item = document.getElementById(`flower-item-${id}`);
    if (item) {
      item.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, 100);
}

function keepFlowerPanelOpen(id) {
  selectedFlowerId = id;
  renderAll();
 forceOpenPanel("flowers");

  setTimeout(() => {
    const item = document.getElementById(`flower-item-${id}`);
    if (item) {
      item.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, 100);
}

// =======================
// 今日路線功能
// =======================

function isInRoute(id) {
  return routeIds.includes(id);
}

function toggleRoute(id) {
  if (!findFlower(id)) {
    return;
  }

  if (routeIds.includes(id)) {
    routeIds = routeIds.filter((routeId) => routeId !== id);

    trackEvent("remove_route", {
      route_count: routeIds.length
    });
  } else {
    routeIds.push(id);

    trackEvent("add_route", {
      route_count: routeIds.length
    });
  }

  saveRoute();

  // 按「加入路線」或「已在路線」後，保持花朵清單開啟
  keepFlowerPanelOpen(id);
}

// 保留舊名稱，避免地圖 popup 或其他地方還有呼叫 addToRoute
function addToRoute(id) {
  toggleRoute(id);
}

function removeFromRoute(id) {
  routeIds = routeIds.filter((routeId) => routeId !== id);
  saveRoute();
  renderAll();
}

function moveRouteUp(id) {
  const index = routeIds.indexOf(id);

  if (index <= 0) {
    return;
  }

  const temp = routeIds[index - 1];
  routeIds[index - 1] = routeIds[index];
  routeIds[index] = temp;

  saveRoute();
  renderAll();
}

function moveRouteDown(id) {
  const index = routeIds.indexOf(id);

  if (index === -1 || index >= routeIds.length - 1) {
    return;
  }

  const temp = routeIds[index + 1];
  routeIds[index + 1] = routeIds[index];
  routeIds[index] = temp;

  saveRoute();
  renderAll();
}

function moveRouteTop(id) {
  const index = routeIds.indexOf(id);

  if (index <= 0) {
    return;
  }

  routeIds.splice(index, 1);
  routeIds.unshift(id);

  saveRoute();
  renderAll();
}

function moveRouteBottom(id) {
  const index = routeIds.indexOf(id);

  if (index === -1 || index >= routeIds.length - 1) {
    return;
  }

  routeIds.splice(index, 1);
  routeIds.push(id);

  saveRoute();
  renderAll();
}

function openGoogleMapsSingleFlower(id) {
  const flower = findFlower(id);

  if (!flower) {
    alert("找不到這個花點。");
    return;
  }

  const destination = `${flower.lat},${flower.lng}`;

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "walking"
  });

  const url = `https://www.google.com/maps/dir/?${params.toString()}`;

trackEvent("open_google_maps", {
  mode: "route",
  route_count: routeIds.length
});

trackEvent("open_google_maps", {
  mode: "single"
});

  window.open(url, "_blank");
}

function openGoogleMapsRoute() {
  const routeFlowers = routeIds
    .map((id) => findFlower(id))
    .filter(Boolean);

  if (routeFlowers.length < 2) {
    alert("今日路線至少需要 2 個點，才能開啟 Google Maps 導航。");
    return;
  }

  let usedFlowers = routeFlowers;

  if (routeFlowers.length > 10) {
    alert("Google Maps 一次導航點位較多，將以前 10 點建立導航。");
    usedFlowers = routeFlowers.slice(0, 10);
  }

  let origin = "";
  let destination = "";
  let waypoints = [];

  const lastFlower = usedFlowers[usedFlowers.length - 1];

  destination = `${lastFlower.lat},${lastFlower.lng}`;

  if (lastGpsPosition) {
    // 有 GPS：
    // 目前位置 → 第1點 → 中間點 → 最後點
    origin = `${lastGpsPosition.lat},${lastGpsPosition.lng}`;

    waypoints = usedFlowers
      .slice(0, usedFlowers.length - 1)
      .map((flower) => `${flower.lat},${flower.lng}`);
  } else {
    // 沒有 GPS：
    // 第1點 → 中間點 → 最後點
    const firstFlower = usedFlowers[0];

    origin = `${firstFlower.lat},${firstFlower.lng}`;

    waypoints = usedFlowers
      .slice(1, usedFlowers.length - 1)
      .map((flower) => `${flower.lat},${flower.lng}`);
  }

  const params = new URLSearchParams();

  params.set("api", "1");
  params.set("origin", origin);
  params.set("destination", destination);

  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }

  const url = `https://www.google.com/maps/dir/?${params.toString()}`;

  window.open(url, "_blank");
}

function clearRoute() {
  const ok = confirm("確定要清空今日路線嗎？");

  if (!ok) {
    return;
  }

  routeIds = [];
  saveRoute();
  renderAll();
}

window.addToRoute = addToRoute;
window.toggleRoute = toggleRoute;
window.removeFromRoute = removeFromRoute;
window.moveRouteUp = moveRouteUp;
window.moveRouteDown = moveRouteDown;
window.moveRouteTop = moveRouteTop;
window.moveRouteBottom = moveRouteBottom;
window.clearRoute = clearRoute;
window.openGoogleMapsRoute = openGoogleMapsRoute;
window.openGoogleMapsSingleFlower = openGoogleMapsSingleFlower;

// =======================
// 畫面更新
// =======================

function updatePanelStats(visibleFlowerCount = null) {
  const stats = document.getElementById("panelStats");

  if (!stats) {
    return;
  }

  const totalFlowerCount = flowers.length;
  const routeCount = routeIds.filter((id) => findFlower(id)).length;

  if (activePanel === "flowers") {
    if (visibleFlowerCount === null) {
      stats.innerText = `共 ${totalFlowerCount} 點｜路線 ${routeCount} 點`;
    } else {
      stats.innerText = `共 ${totalFlowerCount} 點｜顯示 ${visibleFlowerCount} 點｜路線 ${routeCount} 點`;
    }
    return;
  }

  if (activePanel === "route") {
    stats.innerText = `路線 ${routeCount} 點｜花朵 ${totalFlowerCount} 點`;
    return;
  }

  stats.innerText = `花朵 ${totalFlowerCount} 點｜路線 ${routeCount} 點`;
}

function renderAll() {
  renderFlowers();
  renderRoute();
  drawRouteLine();
  updatePanelStats();
}

function renderFlowers() {
  applyAutoCycle();

  map.eachLayer((layer) => {
    if (layer.isFlowerMarker) {
      map.removeLayer(layer);
    }
  });

  const flowerList = document.getElementById("flowerList");
  flowerList.innerHTML = "";

let visibleFlowers = [...flowers];

// 搜尋花名或花朵類型
if (flowerSearchText) {
  visibleFlowers = visibleFlowers.filter((flower) => {
    const name = (flower.name || "").toLowerCase();
    const type = (flower.type || "").toLowerCase();

    return name.includes(flowerSearchText) || type.includes(flowerSearchText);
  });
}

// 排序
const sortedFlowers = visibleFlowers.sort((a, b) => {
  if (flowerSortMode === "distance") {
  const distanceA = getFlowerDistanceMeters(a);
  const distanceB = getFlowerDistanceMeters(b);

  return distanceA - distanceB;
}

  if (flowerSortMode === "confirmed") {
    if (a.confirmed === b.confirmed) {
      return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
    }

    // 未人工確認排上面
    return a.confirmed ? 1 : -1;
  }

  // 預設：依結束時間
  return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
});

    updatePanelStats(sortedFlowers.length);  
    sortedFlowers.forEach((flower) => {
    const remainingText = getRemainingText(flower.endTime);
    const status = getFlowerStatus(flower);
    const flowerClass = getFlowerClass(flower);
    const listStatusClass = getListStatusClass(flower);
    const routeText = isInRoute(flower.id) ? "已在路線" : "加入路線";
    const routeButtonClass = isInRoute(flower.id) ? "in-route-button" : "add-route-button";

    const icon = L.divIcon({
      className: "",
      html: `
        <div class="flower-label ${flowerClass}">
        <div class="flower-name">${flower.name}</div>
${flower.type ? `<div class="flower-type">${flower.type}</div>` : ""}
<div class="flower-time">${remainingText}</div>
        </div>
      `,
      iconSize: [90, 42],
      iconAnchor: [45, 21]
    });

    const marker = L.marker([flower.lat, flower.lng], { icon }).addTo(map);
    marker.isFlowerMarker = true;

    marker.on("click", function () {
      selectedFlowerId = flower.id;
      openPanel("flowers");
      renderAll();

      setTimeout(() => {
        const item = document.getElementById(`flower-item-${flower.id}`);
        if (item) {
          item.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      }, 100);
    });

marker.bindPopup(`
  <div class="popup-content">
    <strong>${flower.name}</strong><br>
    ${flower.type ? `類型：${flower.type}<br>` : ""}
    剩餘時間：${remainingText}<br>
    狀態：${status}<br>
    ${flower.confirmed ? "人工確認" : "未人工確認"}<br>
    ${flower.fruitTaken ? "已拿果" : "未拿果"}

    <div class="popup-actions">
      <button onclick="updateFlowerTime(${flower.id})">更新時間</button>
      <button onclick="editFlowerInfo(${flower.id})">編輯</button>
      <button onclick="toggleFruitTaken(${flower.id})">
        ${flower.fruitTaken ? "改未拿果" : "已拿果"}
      </button>
      <button class="${routeButtonClass}" onclick="toggleRoute(${flower.id})">${routeText}</button>
      <button onclick="openGoogleMapsSingleFlower(${flower.id})">Google導航</button>
      <button onclick="deleteFlower(${flower.id})">刪除</button>
    </div>
  </div>
`);

    const item = document.createElement("div");
    item.id = `flower-item-${flower.id}`;
    item.className = `flower-item ${listStatusClass} ${selectedFlowerId === flower.id ? "selected" : ""}`;

    item.innerHTML = `
    <div class="flower-item-title">
  ${flower.name}
  ${flower.type ? `<span class="flower-type-label">${flower.type}</span>` : ""}
</div>
      <div class="flower-item-meta">
剩餘時間：${remainingText}<br>
狀態：${status}<br>
${flower.confirmed ? "人工確認" : "未人工確認"}｜${flower.fruitTaken ? "已拿果" : "未拿果"}<br>
<span class="flower-distance">${getFlowerDistanceText(flower)}</span>
      </div>

      <div class="flower-actions">
      <button class="edit-flower-button" onclick="event.stopPropagation(); editFlowerInfo(${flower.id})">編輯</button>  
      <button onclick="event.stopPropagation(); updateFlowerTime(${flower.id})">更新時間</button>
        <button onclick="event.stopPropagation(); toggleFruitTaken(${flower.id})">
          ${flower.fruitTaken ? "改未拿果" : "標記已拿果"}
        </button>
        <button class="${routeButtonClass}" onclick="event.stopPropagation(); toggleRoute(${flower.id})">${routeText}</button>
        <button onclick="event.stopPropagation(); deleteFlower(${flower.id})">刪除</button>
      </div>
    `;

    item.addEventListener("click", function () {
      focusFlower(flower.id);
    });

    flowerList.appendChild(item);
  });
}

function renderRoute() {
  const routeList = document.getElementById("routeList");

  if (!routeList) {
    return;
  }

  routeList.innerHTML = "";

  const validRouteIds = routeIds.filter((id) => findFlower(id));

  if (validRouteIds.length !== routeIds.length) {
    routeIds = validRouteIds;
    saveRoute();
  }

  if (routeIds.length === 0) {
    routeList.innerHTML = `<div class="route-empty">尚未加入路線</div>`;
    return;
  }

  routeIds.forEach((id, index) => {
    const flower = findFlower(id);

    if (!flower) {
      return;
    }

    const remainingText = getRemainingText(flower.endTime);
    const status = getFlowerStatus(flower);

    const item = document.createElement("div");
    item.className = "route-item";

    item.innerHTML = `
      <div class="route-item-title">${index + 1}. ${flower.name}</div>
      <div>
        剩餘時間：${remainingText}<br>
        狀態：${status}
      </div>
      <div class="route-actions">
<button onclick="focusFlower(${flower.id})">定位</button>
<button onclick="moveRouteTop(${flower.id})">置頂</button>
<button onclick="moveRouteUp(${flower.id})">上移</button>
<button onclick="moveRouteDown(${flower.id})">下移</button>
<button onclick="moveRouteBottom(${flower.id})">置底</button>
<button onclick="removeFromRoute(${flower.id})">移除</button>
      </div>
    `;

    routeList.appendChild(item);
  });
}

function drawRouteLine() {
  map.eachLayer((layer) => {
    if (layer.isRouteLine) {
      map.removeLayer(layer);
    }
  });

  const routeFlowers = routeIds
    .map((id) => findFlower(id))
    .filter(Boolean);

  if (routeFlowers.length < 2) {
    return;
  }

  const latlngs = routeFlowers.map((flower) => [flower.lat, flower.lng]);

  const line = L.polyline(latlngs, {
    weight: 4,
    opacity: 0.8
  }).addTo(map);

  line.isRouteLine = true;
}

// =======================
// HTML 按鈕可呼叫的功能
// =======================

window.updateFlowerTime = updateFlowerTime;
window.editFlowerInfo = editFlowerInfo;
window.toggleFruitTaken = toggleFruitTaken;
window.deleteFlower = deleteFlower;
window.focusFlower = focusFlower;

// 點地圖新增花點
map.on("click", function (event) {
  addFlower(event.latlng.lat, event.latlng.lng);
});

// 每秒更新倒數
setInterval(renderAll, 1000);

// 頁面載入時畫出已儲存花點與路線
renderAll();

// 頁面載入時嘗試用 GPS 作為地圖中心
centerToGpsOnLoad();

const importBackupInput = document.getElementById("importBackupInput");

if (importBackupInput) {
  importBackupInput.addEventListener("change", function (event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    importBackupFromFile(file);
  });
}