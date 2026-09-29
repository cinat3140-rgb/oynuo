(function () {
  "use strict";

  var state = { catalog: null, categoryId: null, platform: "all", homePlatform: "all", error: null, search: "", sort: "default", metricsUrl: null };

  var APP_VERSION = "1.4.5";

  var PLATFORM_TITLES = {
    all: "Oyun Kataloğu",
    pc: "PC Oyunları",
    torrent: "Torrent Oyunları",
    apk: "Android / APK Oyunları"
  };

  var PLATFORM_COUNTS = {
    all: "Tüm platformdaki oyunlar listeleniyor",
    pc: "PC platformundaki oyunlar listeleniyor",
    torrent: "Torrent ile indirilebilen oyunlar listeleniyor",
    apk: "Android cihazlarda kurulabilen oyunlar listeleniyor"
  };

  var TAB_LABELS = {
    all: "Oynuo (Ana)",
    pc: "PC",
    torrent: "Torrent",
    apk: "Android / APK"
  };

  var NEEDED_APPS = {
    all: null,
    pc: [
      { id: "oynuo-pc", platform: "pc", icon: "🖥️", name: "Oynuo PC", desc: "Windows için Oynuo uygulaması. Oyun kataloğuna tek tıkla eriş, indir ve oyna.", file: "downloads/Oynuo_1.4.4_x64-setup.exe", btn: "EXE İndir", size: "1.2 MB", tag: "Önerilen", featured: true },
      { id: "oynuo-pc-msi", platform: "pc", icon: "🏢", name: "Oynuo PC (MSI)", desc: "Kurumsal dağıtım için Windows Installer paketi.", file: "downloads/Oynuo_1.4.4_x64_en-US.msi", btn: "MSI İndir", size: "1.7 MB", featured: false },
      { id: "oynuo-pc-portable", platform: "pc", icon: "💾", name: "Oynuo PC (Taşınabilir)", desc: "Kurulum gerektirmez; çift tıkla çalıştır.", file: "downloads/Oynuo_1.4.4_portable.exe", btn: "EXE İndir", size: "3.2 MB", featured: false }
    ],
    torrent: [
      { id: "utorrent", platform: "torrent", icon: "🧲", name: "uTorrent", desc: "Popüler torrent istemcisi. .torrent ve magnet linklerini açar.", href: "https://www.utorrent.com/", btn: "İndir", tag: "Önerilen", featured: true },
      { id: "qbittorrent", platform: "torrent", icon: "🐇", name: "qBittorrent", desc: "Açık kaynak, reklamsız torrent istemcisi.", href: "https://www.qbittorrent.org/", btn: "İndir", featured: false },
      { id: "fdm", platform: "torrent", icon: "📥", name: "Free Download Manager", desc: "İndirme yöneticisi; torrent destekli.", href: "https://www.freedownloadmanager.org/", btn: "İndir", featured: false }
    ],
    apk: [
      { id: "oynuo-android", platform: "apk", icon: "🤖", name: "Oynuo Android", desc: "Android için Oynuo uygulaması. Katalogdan oyunları kur ve oyna.", file: "downloads/OynuoAndroid-arm64.apk", btn: "APK İndir (ARM64)", size: "6.8 MB", tag: "Önerilen", featured: true },
      { id: "oynuo-android-x64", platform: "apk", icon: "📱", name: "Oynuo Android (x86_64)", desc: "Emülatörler ve x86_64 cihazlar için APK.", file: "downloads/OynuoAndroid-x86_64.apk", btn: "APK İndir (x86_64)", size: "7.7 MB", featured: false }
    ]
  };

  var PLATFORM_BADGES = {
    pc: { label: "PC", icon: "🖥" },
    torrent: { label: "TORRENT", icon: "🧲" },
    apk: { label: "APK / ANDROID", icon: "🤖" }
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function metric(type, gameId) {
    if (!state.metricsUrl || !gameId || isNaN(Number(gameId))) return;
    fetch(state.metricsUrl.replace(/\/$/, "") + "/" + type, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: Number(gameId) })
    }).catch(function () {});
  }

  function refreshStats() {
    if (!state.metricsUrl || !state.catalog) return Promise.resolve();
    var games = state.catalog.games || [];
    var ids = games.map(function (g) { return g.id; }).filter(function (id) { return /^\d+$/.test(String(id)); });
    if (!ids.length) return Promise.resolve();
    return fetch(state.metricsUrl.replace(/\/$/, "") + "?ids=" + ids.join(","), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (map) {
        if (!map) return;
        games.forEach(function (g) {
          var s = map[String(g.id)];
          if (s) g.stats = { views: s.views, downloads: s.downloads };
        });
      })
      .catch(function () {});
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtBytes(n) {
    if (!n || n <= 0) return "-";
    var units = ["B", "KB", "MB", "GB", "TB"];
    var i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return n.toFixed(n >= 100 ? 0 : 1) + " " + units[i];
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    var d = new Date(iso);
    if (isNaN(d)) return "-";
    return d.toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
  }

  function isNewGame(game) {
    var base = (game && (game.createdAt || game.releaseDate)) || (game && game.latestVersion && game.latestVersion.releasedAt) || null;
    if (!base) return false;
    var t = new Date(base).getTime();
    if (isNaN(t)) return false;
    return Date.now() - t < 30 * 24 * 60 * 60 * 1000;
  }

  function img(url, cls, alt) {
    if (!url) return '<div class="placeholder">🎮</div>';
    return '<img class="' + (cls || "") + '" src="' + esc(url) + '" alt="' + esc(alt || "") + '" loading="lazy" />';
  }

  /* ---------- Catalog data ---------- */

  function fetchCatalog() {
    return fetch("catalog.json?v=" + Date.now(), { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("Katalog alınamadı (HTTP " + r.status + ")");
        return r.json();
      })
      .then(function (data) {
        state.catalog = data;
        state.metricsUrl = data.metricsUrl || null;
        fillCategoryFilter(data.categories || []);
        return refreshStats().then(function () { return data; });
      });
  }

  function fillCategoryFilter(categories) {
    var sel = $("#catFilter");
    if (!sel) return;
    var opts = '<option value="">Tüm Kategoriler</option>';
    (categories || []).forEach(function (c) { opts += '<option value="' + esc(c.id) + '">' + esc(c.name) + "</option>"; });
    sel.innerHTML = opts;
  }

  /* ---------- Home (Sekme Sekme + Son Eklenenler) ---------- */

  function renderHomePlatformGrid() {
    var grid = $("#homePlatformGrid");
    if (!grid) return;
    if (!state.catalog) return;
    var p = state.homePlatform || "all";
    var games = ((state.catalog && state.catalog.games) || [])
      .filter(function (g) { return p === "all" ? true : ((g.platform || "pc") === p); })
      .slice()
      .sort(function (a, b) {
        var da = a.releaseDate || (a.latestVersion && a.latestVersion.releasedAt) || "";
        var db = b.releaseDate || (b.latestVersion && b.latestVersion.releasedAt) || "";
        return db.localeCompare(da);
      });
    if (!games.length) {
      grid.innerHTML = p === "all"
        ? '<div class="empty">Henüz oyun eklenmedi. İlk oyun çok yakında!</div>'
        : '<div class="empty">Bu platformda henüz gerçek oyun eklenmedi. Sitemize gelen oyunlar burada görünecek.</div>';
      return;
    }
    grid.innerHTML = games.slice(0, 12).map(card).join("");
    grid.querySelectorAll(".gcard").forEach(function (el, i) {
      el.classList.add("gcard-in");
      if (i < 24) el.style.animationDelay = (i * 40) + "ms";
    });
  }

  function bindHomePlatformTabs() {
    var host = $("#homePlatformTabs");
    if (!host) return;
    $$(".ptab", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.getAttribute("data-platform") || "all";
        state.homePlatform = p;
        $$(".ptab", host).forEach(function (x) {
          var on = (x.getAttribute("data-platform") || "all") === p;
          x.classList.toggle("active", on);
          x.setAttribute("aria-selected", on ? "true" : "false");
        });
        renderHomePlatformGrid();
      });
    });
  }

  function renderHomeExtras() {
    renderHomePlatformGrid();
    var recent = $("#homeRecentGrid");
    if (recent) {
      var games = ((state.catalog && state.catalog.games) || []).slice().sort(function (a, b) {
        var da = a.releaseDate || (a.latestVersion && a.latestVersion.releasedAt) || "";
        var db = b.releaseDate || (b.latestVersion && b.latestVersion.releasedAt) || "";
        return db.localeCompare(da);
      });
      recent.innerHTML = games.slice(0, 8).map(card).join("") ||
        '<div class="empty">Henüz oyun eklenmedi. İlk oyun çok yakında!<br/><a href="#/sss">İndirme nasıl çalışır?</a></div>';
      recent.querySelectorAll(".gcard").forEach(function (el, i) {
        el.classList.add("gcard-in");
        if (i < 24) el.style.animationDelay = (i * 40) + "ms";
      });
    }
    var cats = $("#homeCats");
    if (cats && state.catalog) {
      var cgames = state.catalog.games || [];
      var catCounts = {};
      cgames.forEach(function (g) { var c = g.categoryId; if (c != null) catCounts[c] = (catCounts[c] || 0) + 1; });
      var rows = [{ id: null, name: "Tümü", count: cgames.length }];
      (state.catalog.categories || []).forEach(function (c) {
        rows.push({ id: c.id, name: c.name, count: catCounts[c.id] || 0 });
      });
      cats.innerHTML = rows.map(function (r) {
        return '<a class="cat-chip" href="#/katalog" data-cat="' + (r.id == null ? "" : r.id) + '">' +
          esc(r.name) + ' <span class="cat-chip-count">' + r.count + "</span></a>";
      }).join("");
    }
    var popular = $("#homePopularGrid");
    if (popular && state.catalog) {
      var popGames = ((state.catalog && state.catalog.games) || []).slice()
        .sort(function (a, b) { return (b.popularity || 0) - (a.popularity || 0); })
        .slice(0, 8);
      popular.innerHTML = popGames.map(card).join("") ||
        '<div class="empty">Henüz oyun yok.</div>';
      popular.querySelectorAll(".gcard").forEach(function (el, i) {
        el.classList.add("gcard-in");
        if (i < 24) el.style.animationDelay = (i * 40) + "ms";
      });
    }
    var sections = $("#homeSections");
    if (sections && state.catalog) {
      var allGames = (state.catalog && state.catalog.games) || [];
      var catCounts2 = {};
      allGames.forEach(function (g) { if (g.categoryId != null) catCounts2[g.categoryId] = (catCounts2[g.categoryId] || 0) + 1; });
      var catsWith = (state.catalog.categories || [])
        .filter(function (c) { return catCounts2[c.id]; })
        .sort(function (a, b) { return (catCounts2[b.id] || 0) - (catCounts2[a.id] || 0); })
        .slice(0, 4);
      if (catsWith.length) {
        sections.innerHTML = catsWith.map(function (c) {
          var list = allGames.filter(function (g) { return g.categoryId === c.id; }).slice(0, 8);
          if (!list.length) return "";
          return '<section class="section home-cat-section">' +
            '<div class="wrap">' +
              '<div class="section-head"><h2 class="section-title">' + esc(c.name) + "</h2>" +
                '<a class="btn btn-ghost btn-sm" href="#/katalog" data-cat-link="' + c.id + '">Tümünü Gör →</a>' +
              "</div>" +
              '<div class="grid home-cat-grid">' + list.map(card).join("") + "</div>" +
            "</div>" +
          "</section>";
        }).join("");
        sections.querySelectorAll(".gcard").forEach(function (el, i) {
          el.classList.add("gcard-in");
          if (i < 24) el.style.animationDelay = (i * 40) + "ms";
        });
      }
    }
  }

  function bindHomeSearch() {
    var form = $("#homeSearchForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = $("#homeSearchInput");
      state.search = q ? q.value.trim() : "";
      var catalogSearch = $("#searchInput");
      if (catalogSearch) catalogSearch.value = state.search;
      location.hash = "#/katalog";
      if (state.catalog) renderCatalog();
    });
  }

  /* Category chips / section links navigate to filtered catalog */
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? (e.target.closest(".cat-chip") || e.target.closest("[data-cat-link]")) : null;
    if (!el) return;
    e.preventDefault();
    var v = el.getAttribute("data-cat") != null ? el.getAttribute("data-cat") : el.getAttribute("data-cat-link");
    state.categoryId = v != null && v !== "" ? Number(v) : null;
    var catSel = $("#catFilter");
    if (catSel) catSel.value = state.categoryId != null ? String(state.categoryId) : "";
    location.hash = "#/katalog";
    if (state.catalog) renderCatalog();
  });

  /* Nav search: once? Enter navigates to filtered catalog */
  function bindNavSearch() {
    var input = $("#navSearch");
    if (!input) return;
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      state.search = input.value.trim();
      var catalogSearch = $("#searchInput");
      if (catalogSearch) catalogSearch.value = state.search;
      location.hash = "#/katalog";
      if (state.catalog) renderCatalog();
    });
  }

  function currentCategoryId() {
    return (state.catalog && state.catalog.categories || []).length ? state.categoryId : null;
  }

  function filteredGames() {
    var games = (state.catalog && state.catalog.games) || [];
    if (state.categoryId) games = games.filter(function (g) { return g.categoryId === state.categoryId; });
    if (state.platform !== "all") games = games.filter(function (g) { return (g.platform || "pc") === state.platform; });
    if (state.search) {
      var q = state.search.toLowerCase();
      games = games.filter(function (g) {
        return (g.title || "").toLowerCase().indexOf(q) !== -1 ||
          (g.description || "").toLowerCase().indexOf(q) !== -1 ||
          (g.genre || "").toLowerCase().indexOf(q) !== -1;
      });
    }
    if (state.sort === "popular") {
      games = games.slice().sort(function (a, b) { return (b.popularity || 0) - (a.popularity || 0); });
    } else if (state.sort === "new") {
      games = games.slice().sort(function (a, b) {
        var da = a.releaseDate || (a.latestVersion && a.latestVersion.releasedAt) || "";
        var db = b.releaseDate || (b.latestVersion && b.latestVersion.releasedAt) || "";
        return db.localeCompare(da);
      });
    } else if (state.sort === "az") {
      games = games.slice().sort(function (a, b) { return (a.title || "").localeCompare(b.title || "", "tr"); });
    }
    return games;
  }

  /* ---------- App update banner ---------- */

  function renderUpdateBanner(latest) {
    var el = $("#updateBanner");
    if (!el) return;
    if (!latest || !latest.version) { el.hidden = true; el.innerHTML = ""; return; }
    var notes = latest.notes ? "<span>" + esc(latest.notes) + "</span>" : "";
    var btn = latest.downloadUrl
      ? '<a class="btn btn-primary btn-sm" href="' + esc(latest.downloadUrl) + '" target="_blank" rel="noopener">Güncelle</a>'
      : '<span class="dim" style="font-size:.82rem">Launcherda yeni sürüm bildirilecek.</span>';
    el.innerHTML =
      '<div class="update-banner-inner">' +
        '<span style="font-size:1.1rem">🆕</span>' +
        '<div class="update-text"><strong>Oynuo v' + esc(latest.version) + " yayınlandı.</strong>" + notes + "</div>" +
        '<div class="update-actions">' + btn + "</div>" +
      "</div>";
    el.hidden = false;
  }

  function fetchAppUpdate() {
    fetch("app-update.json", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.updateAvailable && d.latest && d.latest.version !== APP_VERSION) renderUpdateBanner(d.latest);
      })
      .catch(function () {});
  }

  /* ---------- Actions ---------- */

  function platformTag(g) {
  var p = (g.platform || "pc");
  if (p === "torrent") return { badge: "TORRENT", cls: "badge-torrent" };
  if (p === "apk") return { badge: "APK", cls: "badge-apk" };
  return { badge: "PC", cls: "badge-pc" };
}

function platformInfo(g) {
  var p = (g.platform || "pc");
  if (p === "torrent") {
    var t = g.torrent || {};
    if (t.magnetUrl) return { label: "Torrent", badge: "TORRENT", url: t.magnetUrl, external: true, icon: "🧲", cta: "Magnet'i Aç", cls: "badge-torrent" };
    if (t.torrentUrl) return { label: "Torrent", badge: "TORRENT", url: t.torrentUrl, external: true, icon: "⬇", cta: ".torrent İndir", cls: "badge-torrent" };
  }
  if (p === "apk") {
    var a = g.apk || {};
    if (a.url) return { label: "APK", badge: "APK", url: a.url, external: true, icon: "📦", cta: "APK İndir", cls: "badge-apk" };
  }
  return null;
}

function primaryAction(g) {
  var pi = platformInfo(g);
  if (pi) return { isExternal: true, url: pi.url, platformExtra: pi };
  var file = Array.isArray(g.latestFiles) && g.latestFiles.length ? g.latestFiles[0] : null;
  var isExternal = file ? file.source === "external" : !!(g.externalUrl && !g.downloadUrl);
  var isInternal = file && (file.source === "uploaded" || !isExternal);
  var url = isExternal
    ? ((file && file.downloadUrl) || g.externalUrl)
    : ((file && file.downloadUrl) || g.downloadUrl);
  return { isExternal: isExternal, isInternal: isInternal, url: url || "", platformExtra: pi };
}

function isLinkBroken(file) {
  return !!(file && file.source === "external" && file.linkStatus === "broken");
}

function brokenBadge(file) {
  return isLinkBroken(file) ? '<span class="gcard-broken">⚠ Link Koptu</span>' : "";
}

function actionButtons(g, sizeClass) {
  var a = primaryAction(g);
  var cls = sizeClass || "";
  var detail = '<a class="btn btn-ghost ' + cls + '" href="#/oyun/' + g.id + '">İncele</a>';
  if (!a.url) return detail;
  var pi = a.platformExtra;
  if (pi) {
    return '<a class="btn btn-primary ' + cls + '" href="' + esc(a.url) + '" target="_blank" rel="noopener nofollow" data-metric="download:' + g.id + '">' + pi.icon + " " + pi.cta + "</a>" + detail;
  }
  if (a.isExternal) {
    return '<a class="btn btn-primary ' + cls + '" href="' + esc(a.url) + '" target="_blank" rel="noopener nofollow" data-metric="download:' + g.id + '">🌐 Sayfaya Git</a>' + detail;
  }
  return '<a class="btn btn-primary ' + cls + '" href="' + esc(a.url) + '" download data-metric="download:' + g.id + '">⬇ İndir</a>' + detail;
}

  /* ---------- Rendering ---------- */

  function categoryName(id) {
    var cats = (state.catalog && state.catalog.categories) || [];
    for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i].name;
    return null;
  }

  function coverWithFallback(g) {
    if (g.coverUrl) return '<img class="gcard-cover-img" src="' + esc(g.coverUrl) + '" alt="' + esc(g.title) + '" loading="lazy" />';
    return '<div class="placeholder">🎮</div>';
  }

  function statsHtml(g) {
    var st = g.stats || {};
    var views = st.views || g.popularity || 0;
    var dl = st.downloads || 0;
    var parts = [];
    if (views > 0) parts.push('<span class="stat-views">' + views.toLocaleString("tr-TR") + " görüntülenme</span>");
    if (dl > 0) parts.push('<span class="stat-downloads">' + dl.toLocaleString("tr-TR") + " indirme</span>");
    if (g.isFeatured) parts.push('<span class="stat-views stat-popular">Popüler</span>');
    return parts.length ? '<div class="gcard-stats">' + parts.join("") + "</div>" : "";
  }

  function card(g) {
    var a = primaryAction(g);
    var cat = categoryName(g.categoryId);
    var file = Array.isArray(g.latestFiles) && g.latestFiles.length ? g.latestFiles[0] : null;
    var sizeFile = (Array.isArray(g.latestFiles) ? g.latestFiles : []).filter(function (f) { return f && f.fileSize > 0; })[0] || null;
    var size = sizeFile ? fmtBytes(sizeFile.fileSize) : "-";
var version = g.latestVersion ? g.latestVersion.version : (g.version || null);
    var featuredBadge = g.isFeatured ? '<span class="gcard-featured">★ Öne Çıkan</span>' : "";
    var newBadge = isNewGame(g) ? '<span class="gcard-new">✨ YENİ</span>' : "";
    var popularBadge = g.popularityLabel && !g.isFeatured
      ? '<span class="gcard-pop ' + (g.popularityLabel === "Çok Popüler" ? "hot" : "warm") + '">' + esc(g.popularityLabel) + "</span>"
      : "";
    var pi = platformTag(g);
    var platformBadge = pi
      ? '<span class="gcard-platform ' + pi.cls + '">' + pi.badge + "</span>"
      : "";
    var developer = g.developer ? g.developer : (g.publisher || "");
    var fileBadge = "";
    var labelPi = a.platformExtra || null;
    var urlLabel = a.isExternal ? (labelPi && labelPi.cta ? labelPi.cta : "İndir") : "İndir";
    var urlIcon = a.isExternal ? (labelPi && labelPi.icon ? labelPi.icon : "⬇") : "⬇";
    if (!pi && a.isExternal && isLinkBroken(file)) {
      urlLabel = "Link Koptu";
      urlIcon = "⚠";
    }
    var urlTarget = a.url;
    var dateTxt = fmtDate(g.releaseDate || (g.latestVersion && g.latestVersion.releasedAt));
    var metaTop = [
      (dateTxt ? '<span class="gcard-date">📅 ' + dateTxt + "</span>" : ""),
      (size !== "-" ? '<span class="gcard-size2">💾 ' + size + "</span>" : ""),
      (version ? '<span class="gcard-ver2">v' + esc(version) + "</span>" : "")
    ].join("");
    var badges = [platformBadge, featuredBadge, newBadge, popularBadge].filter(function (x) { return !!x; }).join("");
    return (
      '<article class="gcard">' +
        '<a class="gcard-cover" href="#/oyun/' + g.id + '" aria-label="' + esc(g.title) + '">' +
          coverWithFallback(g) +
        "</a>" +
        '<div class="gcard-body">' +
          (badges ? '<div class="gcard-meta gcard-badges">' + badges + "</div>" : "") +
          '<a class="gcard-title" href="#/oyun/' + g.id + '">' + esc(g.title) + "</a>" +
          (metaTop ? '<div class="gcard-meta-top">' + metaTop + "</div>" : "") +
          (developer ? '<div class="gcard-dev">' + esc(developer) + "</div>" : "") +
          (fileBadge || brokenBadge(file) ? '<div class="gcard-meta">' + (fileBadge ? '<span class="gcard-ext">' + fileBadge + "</span>" : "") + brokenBadge(file) + "</div>" : "") +
          '<div class="gcard-actions">' +
            (a.url
              ? '<a class="btn btn-primary btn-sm" href="' + esc(urlTarget) + '" target="_blank" rel="noopener nofollow" data-metric="download:' + g.id + '">' + urlIcon + " " + urlLabel + "</a>"
              : '<span class="btn btn-ghost btn-sm" style="cursor:default">Yakında</span>') +
            '<a class="btn btn-ghost btn-sm" href="#/oyun/' + g.id + '">İncele</a>' +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function renderCatalog() {
    var grid = $("#catalogGrid");
    var count = $("#catalogCount");
    var game = $("#catalogTitle");
    var selected = state.platform || "all";
    var games = filteredGames();
    if (game) game.textContent = PLATFORM_TITLES[selected] || PLATFORM_TITLES.all;
    count.textContent = (state.catalog ? state.catalog.games.length : 0) + " oyun kayıtlı · " + games.length + " gösteriliyor · " + (PLATFORM_COUNTS[selected] || PLATFORM_COUNTS.all);
    renderAppsStrip(selected);
    if (!games.length) {
      grid.innerHTML = '<div class="empty">Bu platformda henüz oyun eklenmedi. Gerekli uygulamaları yukarıdan indirebilirsin.<br/><a href="#/katalog" data-tab-default="all" style="color:var(--accent)">Tüm oyunlara dön →</a></div>';
      return;
    }
    grid.innerHTML = games.map(card).join("");
    grid.querySelectorAll(".gcard").forEach(function (el, i) {
      el.classList.add("gcard-in");
      if (i < 24) el.style.animationDelay = (i * 40) + "ms";
    });
  }

  function appCardHtml(a) {
    var tag = a.featured ? '<div class="card-tag">' + esc(a.tag || "Önerilen") + "</div>" : "";
    var badge = PLATFORM_BADGES[a.platform]
      ? '<div class="card-plat card-plat-' + esc(a.platform) + '">' + PLATFORM_BADGES[a.platform].icon + " " + esc(PLATFORM_BADGES[a.platform].label) + "</div>"
      : "";
    var size = a.size ? '<div class="card-size">' + esc(a.size) + "</div>" : "";
    var ext = a.href ? ' target="_blank" rel="noopener nofollow" href="' + esc(a.href) + '"' : ' href="' + esc(a.file) + '" download';
    var cls = a.featured ? "card card-featured" : "card";
    return '<a class="' + cls + '"' + ext + ">" +
      tag +
      badge +
      '<div class="card-icon">' + a.icon + "</div>" +
      "<h3>" + esc(a.name) + "</h3>" +
      "<p>" + esc(a.desc) + "</p>" +
      size +
      '<span class="btn ' + (a.featured ? "btn-primary" : "btn-ghost") + '">' + esc(a.btn) + "</span>" +
    "</a>";
  }

  function renderAppsStrip(platform) {
    var host = $("#appsStrip");
    if (!host) return;
    var body = "";
    if (platform === "all") {
      var order = ["pc", "torrent", "apk"];
      var groups = order.map(function (p) {
        var list = NEEDED_APPS[p] || [];
        if (!list.length) return "";
        return '<div class="apps-group">' +
          '<h3 class="apps-group-title">' + (PLATFORM_BADGES[p] ? PLATFORM_BADGES[p].icon + " " : "") + TAB_LABELS[p] + "</h3>" +
          '<div class="downloads apps-grid">' + list.map(appCardHtml).join("") + "</div>" +
        "</div>";
      }).join("");
      body = groups;
    } else {
      var apps = NEEDED_APPS[platform] || [];
      if (!apps.length) { host.hidden = true; host.innerHTML = ""; return; }
      body = '<div class="downloads apps-grid">' + apps.map(appCardHtml).join("") + "</div>";
    }
    host.hidden = false;
    host.innerHTML =
      '<div class="apps-head">' +
        '<h2 class="apps-title">' + (platform === "all" ? "Gerekli Uygulamalar" : TAB_LABELS[platform] + " — Gerekli Uygulamalar") + "</h2>" +
        '<p class="apps-sub">' + (platform === "all" ? "PC, Torrent ve Android için önerilen uygulamalar." : "Bu platformda oyunları kurmak ve oynamak için önerilen uygulamalar.") + "</p>" +
      "</div>" +
      body;
  }

  function renderRequirements(requirements) {
    if (!requirements) return "";
    var min = requirements.minimum;
    var rec = requirements.recommended;
    function reqTable(title, obj) {
      if (!obj) return "";
      var keys = Object.keys(obj);
      if (!keys.length) return "";
      var rows = keys.map(function (k) {
        return '<div class="req-row"><span class="k">' + esc(k) + "</span><span class='v'>" + esc(obj[k]) + "</span></div>";
      }).join("");
      return '<div class="req-col"><div class="req-title">' + esc(title) + "</div>" + rows + "</div>";
    }
    var cols = reqTable("Minimum", min) + reqTable("Önerilen", rec);
    if (!cols) return "";
    return '<div class="require"><h4>Sistem Gereksinimleri</h4><div class="req-grid">' + cols + "</div></div>";
  }

  function renderGame(id) {
    var el = $("#gameDetail");
    metric("view", id);
    var g = state.catalog && state.catalog.games.find(function (x) { return Number(x.id) === Number(id); });
    if (!g) {
      el.innerHTML = '<div class="empty">Oyun bulunamadı. <a href="#/katalog" style="color:var(--accent)">Kataloğa dön</a></div>';
      return;
    }
    var a = primaryAction(g);
    var pi = platformInfo(g);
    var file = Array.isArray(g.latestFiles) && g.latestFiles.length ? g.latestFiles[0] : null;
    var cat = categoryName(g.categoryId);
    var version = g.latestVersion ? g.latestVersion.version : (g.version || null);
    var releaseDate = g.releaseDate || (g.latestVersion && g.latestVersion.releasedAt);
    var tags = [];
    if (pi) tags.push(pi.badge);
    if (cat) tags.push(cat);
    if (g.genre) tags.push(g.genre);
    if (version) tags.push("v" + version);
    if (g.membersOnly) tags.push("Üyelere Özel");
    if (isNewGame(g)) tags.push("✨ YENİ");
    if (g.popularityLabel && !g.isFeatured) tags.push(g.popularityLabel);

    var extraInfo = "";
    if (pi && pi.badge === "TORRENT") {
      var t = g.torrent || {};
      if (t.seeds != null) extraInfo += infoRow("Seeder", "▲ " + t.seeds);
      if (t.leeches != null) extraInfo += infoRow("Leecher", "▼ " + t.leeches);
      if (t.uploader) extraInfo += infoRow("Yükleyen", t.uploader);
      if (t.sha256) extraInfo += '<div class="info-row"><span class="k">SHA-256</span><span class="v mono">' + esc(String(t.sha256).slice(0, 24)) + "…</span></div>";
    }
    if (pi && pi.badge === "APK") {
      var ap = g.apk || {};
      if (ap.androidVersion) extraInfo += infoRow("Android", ap.androidVersion);
      if (ap.arch) extraInfo += infoRow("Mimari", ap.arch);
      if (ap.packageName) extraInfo += infoRow("Paket", ap.packageName);
      if (ap.permissions && ap.permissions.length) extraInfo += infoRow("İzinler", ap.permissions.join(", "));
      if (ap.sha256) extraInfo += '<div class="info-row"><span class="k">SHA-256</span><span class="v mono">' + esc(String(ap.sha256).slice(0, 24)) + "…</span></div>";
    }

    var actionHtml = "";
    if (!a.url) {
      actionHtml = '<span class="dim" style="font-size:.9rem;text-align:center">Henüz indirme bağlantısı eklenmedi. Yönetici linke "Oyun Ekle" ekranından bağlantı ekleyince indirme butonu burada görünecek.</span>';
    } else if (pi) {
      var pNote = pi.badge === "TORRENT"
        ? "Magnet linki torrent istemcinle aç; hız topluluğa bağlıdır."
        : "APK'yı indir, Android cihazında kur ve oyna.";
      actionHtml = '<a class="btn btn-primary btn-lg btn-block" href="' + esc(a.url) + '" target="_blank" rel="noopener nofollow" data-metric="download:' + g.id + '">' + pi.icon + " " + pi.cta + "</a>" +
        '<span class="dim" style="font-size:.82rem;text-align:center">' + pNote + "</span>";
    } else if (a.isExternal) {
      var brokenNote = isLinkBroken(file) ? '<div class="broken-note">⚠ Bu indirme bağlantısı şu an yanıt vermiyor. Yöneticiye bildirildi, kısa süre içinde düzeltilecek. Yine de sayfayı deneyebilirsin.</div>' : "";
      actionHtml = brokenNote +
        '<a class="btn btn-primary btn-lg btn-block" href="' + esc(a.url) + '" target="_blank" rel="noopener nofollow" data-metric="download:' + g.id + '">🌐 Sayfaya Git</a>' +
        '<span class="dim" style="font-size:.82rem;text-align:center">Oyun tarayıcıda açılır; dosyayı oradan indirebilirsin.</span>';
    } else if (a.isInternal) {
      actionHtml = '<a class="btn btn-primary btn-lg btn-block" href="' + esc(a.url) + '" download data-metric="download:' + g.id + '">⬇ İndir</a>' +
        '<span class="dim" style="font-size:.82rem;text-align:center">Dosyayı indir ve oyunu kur.</span>';
    } else {
      actionHtml = '<a class="btn btn-primary btn-lg btn-block" href="' + esc(a.url) + '" download data-metric="download:' + g.id + '">⬇ İndir</a>' +
        '<span class="dim" style="font-size:.82rem;text-align:center">Dosyayı indir; uygulamada "Oyun Ekle" bölümünden kur.</span>';
    }
    var copyBtn = '<button class="btn btn-ghost btn-sm" id="copyLink" type="button" style="margin-top:6px">🔗 Linki Kopyala</button>';
    actionHtml = '<div style="display:flex;flex-direction:column;gap:6px;align-items:stretch">' + actionHtml + copyBtn + "</div>";
    var screens = Array.isArray(g.screenshots) && g.screenshots.length
      ? '<div class="screens"><div class="screens-title">Ekran Görüntüleri</div><div class="screens-grid">' +
        g.screenshots.map(function (s) { return '<img class="shot" src="' + esc(s) + '" alt="' + esc(g.title) + ' görüntüsü" loading="lazy" />'; }).join("") + "</div></div>"
      : "";

    var gStats = g.stats || {};
    var infoRows =
      (g.developer ? infoRow("Geliştirici", g.developer) : "") +
      (g.publisher ? infoRow("Yayıncı", g.publisher) : "") +
      infoRow("Platform", (g.platform || "pc").toUpperCase()) +
      infoRow("Kategori", cat || "—") +
      infoRow("Sürüm", version || "—") +
      infoRow("Boyut", fmtBytes((g.torrent && g.torrent.fileSize) || (g.apk && g.apk.fileSize) || (file && file.fileSize))) +
      infoRow("Yayın Tarihi", fmtDate(releaseDate)) +
      (file && file.fileName ? infoRow("Dosya", file.fileName) : "") +
      (gStats.downloads ? infoRow("İndirme", gStats.downloads.toLocaleString("tr-TR")) : "") +
      (gStats.views || g.popularity ? infoRow("Görüntülenme", (gStats.views || g.popularity).toLocaleString("tr-TR")) : "") +
      extraInfo;

    var sizeTxt = fmtBytes((g.torrent && g.torrent.fileSize) || (g.apk && g.apk.fileSize) || (file && file.fileSize));
    var detailMeta = [
      (sizeTxt !== "-" ? '<span class="dm">💾 ' + sizeTxt + "</span>" : ""),
      (version ? '<span class="dm">🕹 v' + esc(version) + "</span>" : ""),
      (releaseDate ? '<span class="dm">📅 ' + fmtDate(releaseDate) + "</span>" : ""),
      (g.platform ? '<span class="dm">🖥 ' + esc(String(g.platform).toUpperCase()) + "</span>" : ""),
      '<span class="dm dm-online">🟢 Durum: Çevrimiçi</span>'
    ].join("");

    el.innerHTML =
      '<div class="crumb">' +
        '<a href="#/">Ana Sayfa</a>' +
        (cat ? " » <a href='#/katalog'>" + esc(cat) + "</a>" : "") +
        " » " + esc(g.title).split("").slice(0, 40).join("") + (esc(g.title).length > 40 ? "…" : "") +
      "</div>" +
      '<div class="detail-head">' +
          (g.bannerUrl && !g.coverUrl ? '<div class="detail-hero-bg"><img src="' + esc(g.bannerUrl) + '" alt="" /></div>' : "") +
          '<div class="detail-cover-wrap">' + coverWithFallback(g) + "</div>" +
          '<div class="detail-titleblock">' +
            '<h1>' + esc(g.title) + "</h1>" +
            (g.developer ? '<div class="detail-dev">' + esc(g.developer) + "</div>" : "") +
            '<div class="detail-tags">' + tags.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("") + "</div>" +
            (detailMeta ? '<div class="detail-meta">' + detailMeta + "</div>" : "") +
            '<div class="detail-cta">' + actionHtml + "</div>" +
          "</div>" +
      "</div>" +
      '<div class="wrap detail-body">' +
        "<div class='detail-main'>" +
          (g.shortDescription ? '<p class="detail-short">' + esc(g.shortDescription) + "</p>" : "") +
          '<div class="detail-desc-title">Hakkında</div>' +
          '<p class="detail-desc">' + esc(g.description || "Açıklama eklenmemiş.") + "</p>" +
          screens +
        "</div>" +
        '<aside class="detail-panel">' +
          '<div class="detail-panel-title">Oyun Bilgileri</div>' +
          '<div class="info-list">' + infoRows + "</div>" +
          renderRequirements(g.requirements) +
          "</aside>" +
        "</div>" +
      '<div class="detail-social" id="detailSocial" data-gid="' + (g.id) + '"></div>';
    el.querySelectorAll("[data-screenshot]").forEach(function (btn) { bindLightbox(btn); });
    var copyBtn = document.getElementById("copyLink");
    if (copyBtn) copyBtn.addEventListener("click", function () {
      var url = location.href.split("#")[0] + "#/oyun/" + g.id;
      function done(ok) {
        var t = document.getElementById("copyLink");
        if (!t) return;
        var old = t.innerHTML;
        t.innerHTML = ok ? "✅ Kopyalandı" : "Kopyalanamadı";
        t.disabled = true;
        setTimeout(function () { t.innerHTML = old; t.disabled = false; }, 1500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done(true); }).catch(function () { done(false); });
      } else if (window.copyText) {
        window.copyText(url); done(true);
      } else {
        done(false);
      }
    });
    setTimeout(function () { initComments(g.id); }, 0);
  }

  function infoRow(k, v) {
    return '<div class="info-row"><span class="k">' + esc(k) + "</span><span class='v'>" + esc(v) + "</span></div>";
  }

  /* ---------- Router ---------- */

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, "");
    if (!h) return { view: "home" };
    var parts = h.split("/");
    if (parts[0] === "oyun") return { view: "game", id: Number(parts[1]) };
    return { view: parts[0] };
  }

  var VIEWS = ["home", "katalog", "game", "indir", "kurulum", "sss"];

  function route() {
    var r = parseHash();
    if (VIEWS.indexOf(r.view) === -1) { location.hash = "#/"; return; }
    var activeView = r.view;
    $$("[data-view]").forEach(function (el) {
      var show = el.getAttribute("data-view") === activeView;
      if (show) {
        el.classList.remove("fade-up");
        void el.offsetWidth;
        el.classList.add("fade-up");
      }
      el.hidden = !show;
    });
    if (r.view === "katalog" || r.view === "game") {
      if (state.catalog) {
        render(r);
      } else if (!state.loading) {
        state.loading = true;
        fetchCatalog()
          .then(function () { render(r); })
          .catch(function (err) {
            state.error = err.message;
            $("#catalogGrid").innerHTML = '<div class="empty">Katalog yüklenemedi: ' + esc(err.message) + '.<br/>Sunucunun çalıştığından emin ol.</div>';
            $("#catalogCount").textContent = "";
          })
          .finally(function () { state.loading = false; });
      }
    } else {
      window.scrollTo(0, 0);
    }
  }

  function render(r) {
    if (r.view === "game") renderGame(r.id);
    else renderCatalog();
    window.scrollTo(0, 0);
  }

/* ---------- Theme ---------- */
  var ICON_SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var ICON_MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  function setThemeIcon(btn, t) {
    if (!btn) return;
    btn.innerHTML = t === "dark" ? ICON_SUN : ICON_MOON;
    btn.title = t === "dark" ? "Aydınlık temaya geç" : "Koyu temaya geç";
  }
  function initTheme() {
    var saved = localStorage.getItem("html.theme");
    var theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(theme);
    setThemeIcon($("#themeToggle"), theme);
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("html.theme", t);
    setThemeIcon($("#themeToggle"), t);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "dark" ? "light" : "dark");
  }

  /* ---------- News banner ---------- */
  function fetchNews() {
    fetch("news.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
      if (!data || !data.title) return;
      var dismissed = {};
      try { dismissed = JSON.parse(localStorage.getItem("gl.newsDismiss") || "{}"); } catch (e) {}
      if (dismissed[data.title]) return;
      var el = $("#newsBanner");
      var txt = $("#newsText");
      if (!el || !txt) return;
      txt.innerHTML = "<strong>" + esc(data.title) + "</strong>" + (data.body ? " — " + data.body : "");
      el.hidden = false;
    }).catch(function () {});
  }
  function dismissNews() {
    var el = $("#newsBanner");
    if (el) el.hidden = true;
    fetch("news.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
      if (!data || !data.title) return;
      var d = {};
      try { d = JSON.parse(localStorage.getItem("gl.newsDismiss") || "{}"); } catch (e) {}
      d[data.title] = true;
      localStorage.setItem("gl.newsDismiss", JSON.stringify(d));
    }).catch(function () {});
  }

  /* ---------- Feedback ---------- */
  function openFeedback() {
    var subject = encodeURIComponent("Oynuo v" + APP_VERSION + " Geri Bildirim");
    var body = encodeURIComponent("Uygulama/Site: Oynuo\nSürüm: " + APP_VERSION + "\nTarayıcı: " + navigator.userAgent + "\n\nMesajınız:");
    window.open("mailto:cinat3140@gmail.com?subject=" + subject + "&body=" + body, "_blank");
  }

  /* ---------- Public ---------- */

  window.app = {
    applyFilter: function (v) {
      state.categoryId = v ? Number(v) : null;
      renderCatalog();
    },
    applyPlatform: function (v) {
      state.platform = v || "all";
      syncPlatformTabs(state.platform);
      renderCatalog();
    },
    applySearch: function (v) {
      state.search = (v || "").trim();
      renderCatalog();
    },
    applySort: function (v) {
      state.sort = v || "default";
      renderCatalog();
    }
  };

  function syncPlatformTabs(platform) {
    var tabs = document.querySelectorAll("#platformTabs .ptab");
    if (!tabs || !tabs.length) return;
    for (var i = 0; i < tabs.length; i++) {
      var b = tabs[i];
      var on = (b.getAttribute("data-platform") || "all") === (platform || "all");
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    }
  }

  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest
      ? (e.target.closest("[data-tab]") || e.target.closest("[data-tab-link]") || e.target.closest("[data-tab-default]"))
      : null;
    if (!el) return;
    e.preventDefault();
    state.platform = el.hasAttribute("data-tab-default")
      ? "all"
      : (el.getAttribute("data-tab") != null ? el.getAttribute("data-tab") : el.getAttribute("data-tab-link"));
    var sel = $("#platformFilter");
    if (sel) sel.value = state.platform;
    state.categoryId = null;
    var catSel = $("#catFilter");
    if (catSel) catSel.value = "";
    syncPlatformTabs(state.platform);
    location.hash = "#/katalog";
    if (state.catalog) renderCatalog();
  });

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    fetchAppUpdate();
    fetchNews();
    route();
    var themeBtn = $("#themeToggle");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
    var newsClose = $("#newsClose");
    if (newsClose) newsClose.addEventListener("click", dismissNews);
    var feedbackBtn = $("#feedbackBtn");
    if (feedbackBtn) feedbackBtn.addEventListener("click", openFeedback);
    var toTop = $("#toTop");
    if (toTop) {
      window.addEventListener("scroll", function () {
        toTop.classList.toggle("show", (window.pageYOffset || document.documentElement.scrollTop) > 320);
      }, { passive: true });
      toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    }
    try { bindSetupWizard(); } catch (e) {}
    try { bindHomeSearch(); } catch (e) {}
    try { bindNavSearch(); } catch (e) {}
    try { bindHomePlatformTabs(); } catch (e) {}
    if (state.catalog) {
      renderHomeExtras();
    } else {
      fetchCatalog()
        .then(function () { renderHomeExtras(); })
        .catch(function (err) {
          var recent = $("#homeRecentGrid");
          if (recent) recent.innerHTML = '<div class="empty">Katalog yüklenemedi: ' + esc(err.message) + '.<br/>Sunucunun çalıştığından emin ol.</div>';
        });
    }
  });

  if (document.readyState !== "loading") { initTheme(); }

  /* Metric delegation: <a data-metric="view|download:id"> */
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("a[data-metric]") : null;
    if (!el) return;
    var parts = el.getAttribute("data-metric").split(":");
    if (parts[0] === "download") metric("download", parts[1]);
  });

  /* Simple lightbox for screenshots */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.classList.contains("screens-grid") === false) return;
    if (t && t.parentElement && t.parentElement.classList.contains("screens-grid")) {
      var src = t.src;
      var ov = document.createElement("div");
      ov.className = "lb";
      document.body.classList.add("no-scroll");
      var im = new Image();
      im.style.cssText = "max-width:90vw;max-height:90vh;border-radius:10px;";
      im.src = src;
      ov.appendChild(im);
      ov.addEventListener("click", function () { ov.remove(); document.body.classList.remove("no-scroll"); });
      document.body.appendChild(ov);
    }
});
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var lb = document.querySelector(".lb");
      if (lb) { lb.remove(); document.body.classList.remove("no-scroll"); }
    }
  });

  /* ============ KURULUM SIHRBAZI (tek akis, secimsiz) ============ */
  function bindSetupWizard() {
    var next = document.getElementById("setupNext");
    if (!next) return;
    var stepEls = Array.prototype.slice.call(document.querySelectorAll(".sw-step"));
    var status = document.getElementById("setupStatus");
    var bar = document.getElementById("setupBarFill");
    var cur = 0;
    cur = -1;
    function label(i){ return stepEls[i] ? stepEls[i].querySelector(".sw-title").textContent : ""; }
    function setStatus(t){ if (status) status.textContent = t; }
    function showStep() {
      stepEls.forEach(function (st, i) {
        st.classList.remove("sw-done","sw-active");
        if (i === cur) st.classList.add("sw-active");
        if (i < cur) st.classList.add("sw-done");
        var ch = st.querySelector(".sw-check");
        if (ch) ch.textContent = i < cur ? "✓" : (i === cur ? "⋯" : "·");
      });
      if (bar) bar.style.width = Math.round(((cur + 1) / stepEls.length) * 100) + "%";
    }
    next.addEventListener("click", function () {
      cur++;
      if (cur >= stepEls.length) {
        setStatus("Kurulum tamamlandi. Katalogdan oyunu secte ve baslat.");
        next.textContent = "Katalogu Ac  →";
        next.className = next.className.replace(/\bsw-finished\b/,"").trim() + " sw-finished";
        next.onclick = function () { location.hash = "#/katalog"; };
        showStep();
        return;
      }
      setStatus("Adiim " + (cur + 1) + ": " + label(cur));
      showStep();
      if (cur === stepEls.length - 1) {
        next.textContent = "Kurulumu Tamamla  →";
      } else {
        next.textContent = "Siradaki  →";
      }
    });
    showStep();
  }

/* ============ YORUM SISTEMI (Supabase + localStorage yedek) ============ */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
var COMMENTS_CONFIG = {
    supabaseUrl: "https://laavoozgpkrckafyfldy.supabase.co",
    supabaseAnonKey: "sb_publishable_1Mxzm_Mb9FVqX5EsnyLPcQ__Qt06dLw",
    table: "yorumlar"
  };
  function initComments(gameId) {
    var host = document.getElementById("detailSocial");
    if (!host) return;
    var oyun = Number(gameId) || 0;
    var nameKey = "html.user.name";
    var myName = localStorage.getItem(nameKey) || "Misafir";
    var items = [];
    var pollTimer = null;
    function apiGet() {
      var url = COMMENTS_CONFIG.supabaseUrl + "/rest/v1/" + COMMENTS_CONFIG.table +
        "?select=*&oyun=eq." + oyun + "&order=olustu.asc&limit=100";
      return fetch(url, { headers: { apikey: COMMENTS_CONFIG.supabaseAnonKey, Authorization: "Bearer " + COMMENTS_CONFIG.supabaseAnonKey } })
        .then(function (r) { if (!r.ok) throw new Error("supabase " + r.status); return r.json(); });
    }
    function apiPost(item) {
      return fetch(COMMENTS_CONFIG.supabaseUrl + "/rest/v1/" + COMMENTS_CONFIG.table, {
        method: "POST",
        headers: {
          apikey: COMMENTS_CONFIG.supabaseAnonKey,
          Authorization: "Bearer " + COMMENTS_CONFIG.supabaseAnonKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ oyun: oyun, yazar: item.author, email: item.email || null, metin: item.text })
      });
    }
    var cacheKey = "yorum_cache_" + oyun;
    function readLocal() {
      try {
        var raw = localStorage.getItem(cacheKey);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }
    function saveLocal(list) {
      try { localStorage.setItem(cacheKey, JSON.stringify(list.slice(-100))); } catch (e) {}
    }
    function renderList() {
      var log = document.getElementById("cmtLog");
      var info = document.getElementById("cmtInfo");
      var cnt = document.getElementById("cmtCount");
      if (log) log.innerHTML = renderComments(items);
      if (cnt) cnt.textContent = items.length ? items.length + " yorum" : "";
      if (info) info.textContent = items.length ? "" : "İlk yorumu sen yaz — düşüncelerini paylaş.";
    }
    function refresh() {
      apiGet()
        .then(function (rows) {
          items = (rows || []).filter(function (r) { return r.durum === "yorum" || !r.durum; }).map(function (r) {
            return { id: r.id, author: r.yazar || "Misafir", text: r.metin || "", email: r.email || "", at: new Date(r.olustu).getTime() };
          });
          saveLocal(items);
          renderList();
        })
        .catch(function () {
          var local = readLocal();
          if (local && local.length) { items = local; renderList(); }
        });
    }
    function post() {
      var msg = document.getElementById("cmtMsg");
      if (!msg || !msg.value.trim()) return;
      var nm = document.getElementById("cmtName");
      var em = document.getElementById("cmtEmail");
      if (nm && nm.value.trim()) localStorage.setItem(nameKey, nm.value.trim());
      var item = { id: "c" + Date.now(), author: myName, email: em && em.value.trim() ? em.value.trim() : "", text: msg.value.trim(), at: Date.now() };
      apiPost(item)
        .then(function () { msg.value = ""; refresh(); })
        .catch(function () {
          items.push(item);
          if (items.length > 200) items = items.slice(-200);
          saveLocal(items);
          renderList();
          msg.value = "";
        });
    }
    var html =
      '<div class="support-head"><h3>Yorumlar</h3><span class="support-count" id="cmtCount"></span></div>' +
      '<div class="support-log" id="cmtLog"></div>' +
      '<div class="support-form">' +
        '<div class="support-row">' +
          '<input type="text" id="cmtName" placeholder="Takma ad (boş = Misafir)" maxlength="24" value="' + esc(myName) + '" />' +
          '<input type="email" id="cmtEmail" placeholder="Email (isteğe bağlı)" maxlength="80" />' +
        "</div>" +
        '<textarea id="cmtMsg" maxlength="500" placeholder="Bu oyun hakkında yorumunu yaz..."></textarea>' +
        '<button class="btn btn-primary" id="cmtSend" type="button">Yorum Yap</button>' +
      "</div>" +
      '<p class="sw-status dim" id="cmtInfo"></p>';
    host.innerHTML = html;
    var send = document.getElementById("cmtSend");
    var msg = document.getElementById("cmtMsg");
    if (send) send.addEventListener("click", post);
    if (msg) msg.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } });
    refresh();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(refresh, 20000);
  }
function renderComments(items) {
    if (!items || !items.length) return '<div class="support-empty">Henüz yorum yapılmamış. İlk yorumu sen yaz!</div>';
    return items.map(function (it) {
      var when = new Date(it.at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
      return '<div class="chat-item">' +
        '<div class="chat-meta"><span class="chat-author">' + esc(it.author || "Misafir") + "</span>" +
        '<span class="chat-time">' + when + "</span></div>" +
        '<div class="chat-text">' + esc(it.text) + "</div></div>";
    }).join("");
  }
})();

