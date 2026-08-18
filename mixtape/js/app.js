(() => {
  const DEFAULT_MANIFEST = window.MIXTAPE_DEMO || {};
  const ENDPOINT = window.MIXTAPE_ENDPOINT || "";
  const MIXTAPE_ROUTE_PREFIX = "/mixtape/";
  const ASSET_BASE = ensureTrailingSlash(window.MIXTAPE_ASSET_BASE || "/mixtape/");
  const APP_STORE_URL = window.LOLLIPOP_APP_STORE_URL || "https://apps.apple.com/us/charts/iphone";
  const ANDROID_STORE_URL = window.LOLLIPOP_ANDROID_STORE_URL || "https://play.google.com/store/apps";
  const MIXTAPE_CLAIM_BAR_KEY = "lollipop_mixtape_claim_bar";
  const MIXTAPE_CLAIM_BAR_MAX_AGE_MS = 30 * 1000;
  const MIXTAPE_CLAIM_BAR_REAPPEAR_MS = 120 * 1000;
  const DEFAULT_LABEL_COLOR = "#6fcdde";
  const NEON_LABEL_PALETTE = ["39FF14", "FF1493", "00F0FF", "FFF200", "FF6E00", "BC13FE", "FF3131"];
  const SUPPORTED_SKINS = new Set(["default", "cassette", "popamp"]);
  const TEMPLATE_PATHS = {
    popamp: assetPath("skins/popamp.html"),
    popampTrackCard: assetPath("skins/popamp-track-card.html"),
    cassetteShell: assetPath("skins/cassette-shell.html"),
    cassetteControls: assetPath("skins/cassette-controls.html"),
    cassetteDoor: assetPath("skins/cassette-door.html"),
    cassetteTrackCard: assetPath("skins/cassette-track-card.html"),
    missingMixtape: assetPath("skins/missing-mixtape.html")
  };
  const templateCache = new Map();
  const defaultTrackCardNodes = Array.from(document.querySelector(".track-card")?.childNodes || []).map(node => node.cloneNode(true));
  const defaultControlsNodes = Array.from(document.querySelector(".controls")?.childNodes || []).map(node => node.cloneNode(true));

  const els = {
    app:             document.getElementById("app"),
    cassetteVisual:  document.getElementById("cassetteVisual"),
    cassetteDoorLayer: document.getElementById("cassetteDoorLayer"),
    elapsedTime:     document.getElementById("elapsedTime"),
    durationTime:    document.getElementById("durationTime"),
    currentArtwork:  document.getElementById("currentArtwork"),
    currentTitle:    document.getElementById("currentTitle"),
    currentMeta:     document.getElementById("currentMeta"),
    progressInput:   document.getElementById("progressInput"),
    cassetteMuteButton: document.getElementById("cassetteMuteButton"),
    cassetteVolumeRange: document.getElementById("cassetteVolumeRange"),
    playButton:      document.getElementById("playButton"),
    prevButton:      document.getElementById("prevButton"),
    nextButton:      document.getElementById("nextButton"),
    viewToggle:      document.getElementById("viewToggle"),
    viewToggleIcon:  document.getElementById("viewToggleIcon"),
    viewToggleLabel: document.getElementById("viewToggleLabel"),
    sourceBadge:     document.getElementById("mixtapeSourceBadge"),
    makeCardLink:    document.getElementById("makeMixtapeCardLink")
  };

  const state = {
    manifest:      normalizeManifest(DEFAULT_MANIFEST),
    manifestReady: false,
    player:        null,
    ytApiReady:    false,
    playerReady:   false,
    currentIndex:  0,
    playing:       false,
    buffering:     false,
    stopRequested: false,
    transportMode: "idle",
    position:      0,
    duration:      1,
    loadedVideoId: "",
    revealed:      new Set(),
    view:          "playlist",
    timer:         null,
    audioContext:  null,
    audioUnlocked: false,
    cassetteDoorOpen: false,
    cassetteDoorReadyTimer: null,
    playlistPanelVisible: true,
    popampEqPanelVisible: true,
    popampVolume: 72,
    popampPreamp: 70,
    popampBalance: 50,
    popampShuffleEnabled: false,
    popampRepeatEnabled: false,
    shuffleRemaining: [],
    popampVizMode: "matrix",
    popampVideoLocation: "top",
    popampPlaylistGridHidden: false,
    labelColor: resolveLabelColorFromUrl()
  };

  /* Popamp "fake" chrome that toggles the viz between the YouTube video and the
     spectrum matrix when tapped (discrete buttons only — NOT the preamp, which
     fades the video, and NOT the EQ band sliders, which force the spectrum). */
  const POPAMP_FAKE_SWAP_OUT =
    ".popamp-wide-button, .popamp-toggle, .popamp-presets";

  const POPAMP_PLAYLIST_VIDEO_BUTTONS =
    ".popamp-playlist-panel .popamp-footer-buttons button";

  const POPAMP_PLAYLIST_GRID_BUTTON =
    ".popamp-playlist-panel .popamp-footer-listopts";

  window.onYouTubeIframeAPIReady = () => {
    state.ytApiReady = true;
    createYouTubePlayer();
  };

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("resize", () => requestAnimationFrame(syncPopampVideoFrameRect));
  window.addEventListener("orientationchange", () => requestAnimationFrame(syncPopampVideoFrameRect));

  async function init() {
    try {
      const loadResult = await maybeLoadManifest();
      if (!loadResult.ok) return;
      state.manifestReady = true;
      document.title = state.manifest.sourceType === "claimed"
        ? `${state.manifest.title} · Claimed Mixtape`
        : state.manifest.title;
      applySkin();
      bindEvents();
      await renderPlayerVisual();
      renderTrackList();
      setView("playlist");
      updateUI();
      syncEqualizerSliderColors();
      syncPopampVideoFrameRect();
      if (window.YT?.Player) {
        state.ytApiReady = true;
        createYouTubePlayer();
      }
      startTimer();

      if (loadResult.source === "config" || loadResult.source === "claimed-config") {
        mixtapeAnalyticsEnabled = true;
        trackMixtapeViewOnce();
        if (shareEntryDetected()) trackMixtapeShareOpenOnce();
        initMixtapeClaimBar();
      }
    } finally {
      els.app.removeAttribute("data-booting");
    }
  }

  async function maybeLoadManifest() {
    const source = resolveManifestSource();
    if (!source) return { ok: true, source: "demo" };

    try {
      // no-store: playlists can be edited at any time, so every load must hit
      // the live config — never serve a cached /configs/<slug>.json.
      const response = await fetch(source.url, { credentials: "same-origin", cache: "no-store" });

      if (!response.ok) {
        if (source.kind === "config") {
          await renderMissingMixtapePage(source.slug, {
            mode: source.mode,
            claimId: source.claimId
          });
          return { ok: false, source: "missing-config" };
        }
        throw new Error(`Manifest fetch failed: ${response.status}`);
      }

      const payload = await response.json();

      if (source.kind === "config") {
        const manifest = manifestFromConfig(payload, source, source.mixtapeUuid);
        if (!manifest) {
          console.debug(source.mode === "claimed"
            ? "[mixtape] claimed claim_id not found"
            : "[mixtape] missing section_mixtape");
          await renderMissingMixtapePage(source.slug, {
            mode: source.mode,
            claimId: source.claimId
          });
          return { ok: false, source: source.mode === "claimed" ? "missing-mixtape-claim" : "missing-mixtape-section" };
        }
        state.manifest = normalizeManifest(manifest);
        return { ok: true, source: source.mode === "claimed" ? "claimed-config" : "config" };
      }

      state.manifest = normalizeManifest(payload);
      return { ok: true, source: "endpoint" };
    } catch (err) {
      if (source.kind === "config") {
        console.warn("Unable to load mixtape config.", err);
        await renderMissingMixtapePage(source.slug, {
          mode: source.mode,
          claimId: source.claimId
        });
        return { ok: false, source: "config-error" };
      }
      console.warn("Using demo manifest fallback.", err);
      return { ok: true, source: "demo-fallback" };
    }
  }

  function resolveManifestSource() {
    if (ENDPOINT) {
      return { kind: "endpoint", url: ENDPOINT };
    }

    const route = parseMixtapeRoute(window.location.pathname);
    if (route.mode === "demo") return null;

    const params = new URLSearchParams(window.location.search);
    const mixtapeUuid = params.get("mixtape_uuid") || params.get("mid") || "";

    return {
      kind: "config",
      mode: route.mode,
      slug: route.slug,
      claimId: route.claimId,
      mixtapeUuid,
      url: new URL(`/configs/${route.slug}.json`, window.location.origin).toString()
    };
  }

  function parseMixtapeRoute(pathname) {
    const value = String(pathname || "");
    if (!value.startsWith(MIXTAPE_ROUTE_PREFIX)) {
      return { mode: "demo", slug: "", claimId: "" };
    }

    const raw = value.slice(MIXTAPE_ROUTE_PREFIX.length);
    const parts = raw.split("/").filter(Boolean);
    const slug = sanitizeSlug(parts[0] || "");
    const action = String(parts[1] || "").toLowerCase();
    const claimId = sanitizeClaimId(parts[2] || "");

    if (slug && (action === "claimed" || action === "claim") && claimId) {
      return { mode: "claimed", slug, claimId };
    }

    if (slug) return { mode: "live", slug, claimId: "" };

    return { mode: "demo", slug: "", claimId: "" };
  }

  function sanitizeSlug(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-z0-9_-]/gi, "");
  }

  function sanitizeClaimId(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-z0-9_-]/gi, "");
  }

  function manifestFromConfig(config, source, mixtapeUuid) {
    if (typeof source === "string") {
      source = { mode: "live", slug: source, claimId: "" };
    }

    if (source?.mode === "claimed") {
      return manifestFromClaimedConfig(config, source.slug, source.claimId);
    }

    return manifestFromLiveConfig(config, source?.slug || "", mixtapeUuid);
  }

  function manifestFromLiveConfig(config, slug, mixtapeUuid) {
    const sections = Array.isArray(config?.section) ? config.section : [];
    const allMixtape = sections.filter(s => s?.id === "section_mixtape" && !s.hidden);
    if (!allMixtape.length) return null;

    let mixtapeSection;
    if (mixtapeUuid) {
      mixtapeSection = allMixtape.find(s => s.uuid === mixtapeUuid);
      if (!mixtapeSection) return null;
    } else {
      mixtapeSection = allMixtape.find(s => {
        const fields = Array.isArray(s.fields) ? s.fields : [];
        return fields[4]?.value === true;
      }) || allMixtape[0];
    }
    if (!mixtapeSection) return null;

    const fields = Array.isArray(mixtapeSection.fields) ? mixtapeSection.fields : [];
    const title = String(fields[0]?.value || "").trim() || humanizeSlug(slug) || "Untitled MixTape";
    const rawTracks = Array.isArray(fields[1]?.value) ? fields[1].value : [];

    return {
      id: slug || "mixtape",
      uuid: String(mixtapeSection.uuid || "").trim(),
      title,
      skin: resolveManifestSkin(fields[5]?.value),
      mysteryMode: fields[6]?.value !== false,
      sourceType: "live",
      sourceSlug: slug,
      theme: {
        backgroundColor: normalizeThemeColor(fields[2]?.value),
        textColor: normalizeThemeColor(fields[3]?.value)
      },
      tracks: rawTracks
    };
  }

  function manifestFromClaimedConfig(config, slug, claimId) {
    const sections = Array.isArray(config?.section) ? config.section : [];
    const claimsSection = sections.find(section => section?.id === "section_mixtape_claims");
    if (!claimsSection) return null;

    const fields = Array.isArray(claimsSection.fields) ? claimsSection.fields : [];
    const claims = Array.isArray(fields[0]?.value) ? fields[0].value : [];

    let claim = claims.find(item => {
      const id = String(item?.claim_id || item?.claimId || "").trim();
      return id === claimId;
    });

    if (!claim && claims.length === 1) {
      claim = claims[0];
      console.warn(`Claim ${claimId} was not found. Rendering the only saved mixtape claim instead.`);
    }

    if (!claim) return null;

    const mixtape = claim.mixtape || {};
    const colors = mixtape.colors || mixtape.theme || {};
    const tracks = Array.isArray(mixtape.tracks)
      ? mixtape.tracks
      : Array.isArray(claim.tracks)
        ? claim.tracks
        : [];
    const title = String(mixtape.title || claim.title || "").trim() || "Claimed MixTape";

    return {
      id: String(claim.claim_id || claim.claimId || claimId || "claimed-mixtape"),
      claimId: String(claim.claim_id || claim.claimId || claimId || ""),
      uuid: String(mixtape.mixtape_uuid || claim.mixtape_uuid || "").trim(),
      title,
      skin: resolveManifestSkin(mixtape.skin || claim.skin),
      mysteryMode: mixtape.mysteryMode !== false,
      sourceType: "claimed",
      ownerSlug: slug,
      sourceSlug: claim.source_slug || claim.sourceSlug || "",
      creatorWallet: claim.creator_wallet || claim.creatorWallet || "",
      snapshotHash: claim.snapshot_hash || claim.snapshotHash || "",
      claimedAt: claim.claimed_at || claim.claimedAt || "",
      theme: {
        backgroundColor: normalizeThemeColor(colors.background || colors.backgroundColor),
        textColor: normalizeThemeColor(colors.text || colors.textColor)
      },
      tracks
    };
  }

  function humanizeSlug(value) {
    return String(value || "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase())
      .trim();
  }

  async function instantiateTemplate(path) {
    const markup = await loadTemplateMarkup(path);
    if (!markup) return null;
    const documentFragment = new DOMParser().parseFromString(markup, "text/html");
    return documentFragment.body.firstElementChild?.cloneNode(true) || null;
  }

  async function instantiateNodes(path) {
    const markup = await loadTemplateMarkup(path);
    if (!markup) return [];
    const documentFragment = new DOMParser().parseFromString(markup, "text/html");
    return Array.from(documentFragment.body.childNodes).map(node => node.cloneNode(true));
  }

  async function loadTemplateMarkup(path) {
    if (templateCache.has(path)) return templateCache.get(path);

    try {
      const response = await fetch(path, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Template fetch failed: ${response.status}`);
      const markup = (await response.text()).trim();
      templateCache.set(path, markup);
      return markup;
    } catch (err) {
      console.warn(`Unable to load template: ${path}`, err);
      templateCache.set(path, "");
      return "";
    }
  }

  async function renderMissingMixtapePage(slug, options = {}) {
    const mode = options.mode || "live";
    const displaySlug = humanizeSlug(slug) || "This Mixtape";
    const isClaimed = mode === "claimed";
    const copy = missingMixtapeCopy(displaySlug, isClaimed);
    document.title = copy.documentTitle;

    els.app.dataset.skin = "missing";
    els.app.dataset.view = "playlist";
    els.app.dataset.sourceType = isClaimed ? "claimed" : "live";
    const view = await instantiateTemplate(TEMPLATE_PATHS.missingMixtape);
    if (!view) {
      els.app.replaceChildren(buildMissingMixtapeFallback(copy));
      return;
    }

    const kicker = view.querySelector(".missing-mixtape-kicker");
    const title = view.querySelector("#missingMixtapeTitle");
    const bodyCopy = view.querySelector(".missing-mixtape-copy");
    const appStoreLink = view.querySelector('[data-role="app-store-link"]');
    const secondaryLink = view.querySelector(".missing-mixtape-button.secondary");

    if (kicker) kicker.textContent = copy.kicker;
    if (title) title.textContent = copy.title;
    if (bodyCopy) bodyCopy.textContent = copy.body;
    if (appStoreLink instanceof HTMLAnchorElement) {
      appStoreLink.href = copy.primaryHref;
      appStoreLink.textContent = copy.primaryLabel;
    }
    if (secondaryLink instanceof HTMLAnchorElement) {
      secondaryLink.href = copy.secondaryHref;
      secondaryLink.textContent = copy.secondaryLabel;
    }
    els.app.replaceChildren(view);
  }

  function missingMixtapeCopy(displaySlug, isClaimed) {
    if (isClaimed) {
      return {
        documentTitle: "Cassette Not Found",
        kicker: "Cassette Not Found",
        title: "This saved mixtape could not be found.",
        body: "This cassette copy may not exist in this profile config yet, or the link may be wrong.",
        primaryHref: "https://lollipop.gg/",
        primaryLabel: "Make Your Own Mixtape",
        secondaryHref: "https://lollipop.gg/",
        secondaryLabel: "Go to Lollipop"
      };
    }

    return {
      documentTitle: `${displaySlug} Not Found`,
      kicker: "Mixtape Not Found",
      title: `${displaySlug} is not live yet.`,
      body: "Build your own mixtape in Lollipop, publish it to your link, and share a page that feels like a real collectible.",
      primaryHref: APP_STORE_URL,
      primaryLabel: "Download The App",
      secondaryHref: "https://lollipop.gg/",
      secondaryLabel: "Make Your Own Mixtape"
    };
  }

  function buildMissingMixtapeFallback(copy) {
    const main = document.createElement("main");
    main.className = "app-content missing-mixtape-shell";

    const card = document.createElement("section");
    card.className = "missing-mixtape-card";
    card.setAttribute("aria-labelledby", "missingMixtapeTitle");

    const kicker = document.createElement("p");
    kicker.className = "missing-mixtape-kicker";
    kicker.textContent = copy.kicker;

    const title = document.createElement("h1");
    title.id = "missingMixtapeTitle";
    title.textContent = copy.title;

    const body = document.createElement("p");
    body.className = "missing-mixtape-copy";
    body.textContent = copy.body;

    const actions = document.createElement("div");
    actions.className = "missing-mixtape-actions";

    const appStoreLink = document.createElement("a");
    appStoreLink.className = "missing-mixtape-button primary";
    appStoreLink.href = copy.primaryHref;
    appStoreLink.textContent = copy.primaryLabel;

    const mixtapeLink = document.createElement("a");
    mixtapeLink.className = "missing-mixtape-button secondary";
    mixtapeLink.href = copy.secondaryHref;
    mixtapeLink.textContent = copy.secondaryLabel;

    actions.append(appStoreLink, mixtapeLink);
    card.append(kicker, title, body, actions);
    main.appendChild(card);
    return main;
  }

  function normalizeManifest(input) {
    const manifest = input || {};
    const tracks = Array.isArray(manifest.tracks) ? manifest.tracks : [];
    return {
      id:          manifest.id || "mixtape",
      title:       manifest.title || "Untitled MixTape",
      skin:        normalizeSkin(manifest.skin),
      sideLabel:   manifest.sideLabel || "Side A",
      mysteryMode: manifest.mysteryMode !== false,
      sourceType:  manifest.sourceType || "live",
      claimId:     manifest.claimId || "",
      ownerSlug:   manifest.ownerSlug || "",
      sourceSlug:  manifest.sourceSlug || "",
      creatorWallet: manifest.creatorWallet || "",
      snapshotHash: manifest.snapshotHash || "",
      claimedAt:   manifest.claimedAt || "",
      viewLink:    manifest.viewLink || tracks[0]?.externalUrl || "#",
      theme: {
        backgroundColor: normalizeThemeColor(manifest?.theme?.backgroundColor || manifest.backgroundColor),
        textColor: normalizeThemeColor(manifest?.theme?.textColor || manifest.textColor)
      },
      tracks:      tracks.filter(t => t && t.youtubeVideoId).map((track, index) => {
        const durationSeconds = normalizeSeconds(track.durationSeconds ?? track.seconds ?? 0);
        return {
          index:        index + 1,
          artist:       track.artist || "Unknown Artist",
          title:        track.title  || `Track ${String(index + 1).padStart(2, "0")}`,
          displayTitle: track.displayTitle || `${track.artist || "Unknown Artist"} - ${track.title || `Track ${index + 1}`}`,
          youtubeVideoId: track.youtubeVideoId,
          seconds:      durationSeconds || 1,
          duration:     formatTime(durationSeconds || 0),
          externalUrl:  track.externalUrl || `https://www.youtube.com/watch?v=${track.youtubeVideoId}`,
          thumbnail:    track.thumbnail  || `https://img.youtube.com/vi/${track.youtubeVideoId}/hqdefault.jpg`
        };
      })
    };
  }

  /* ── Analytics ── */
  const ANALYTICS_PATH = "/lollipop/analytics/event";
  let mixtapeAnalyticsEnabled = false;
  let mixtapeViewTracked = false;
  let mixtapeShareOpenTracked = false;
  const trackedMixtapeReveals = new Set();

  function analyticsDebugEnabled() {
    return Boolean(window.LOLLIPOP_DEBUG || window.__LOLLIPOP_DEBUG__);
  }

  function analyticsEndpointUrl() {
    // Same convention as frontend/js/lollipop_analytics.js: an explicit
    // apiurl override wins, otherwise pick the analytics host by environment.
    const override = window.LOLLIPOP_ANALYTICS_URL
      || window.lollipop?.analytics?.apiurl
      || window.lollipop?.analyticsurl;
    if (override) return String(override).replace(/\/$/, "") + ANALYTICS_PATH;

    const hostname = String(window.location.hostname || "").toLowerCase();
    const isLocal = hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname.startsWith("local.")
      || hostname.includes("local.lollipop.gg");

    return (isLocal
      ? "https://analyticslocal.lollipop.gg"
      : "https://analytics.lollipop.gg") + ANALYTICS_PATH;
  }

  function cleanMixtapeAnalyticsObject(value) {
    if (Array.isArray(value)) {
      return value
        .map(cleanMixtapeAnalyticsObject)
        .filter(item => item !== null && item !== undefined);
    }

    if (value && typeof value === "object") {
      const out = {};

      Object.entries(value).forEach(([key, child]) => {
        const cleaned = cleanMixtapeAnalyticsObject(child);

        if (cleaned === null || cleaned === undefined || cleaned === "") return;
        if (
          typeof cleaned === "object" &&
          !Array.isArray(cleaned) &&
          Object.keys(cleaned).length === 0
        ) return;
        if (Array.isArray(cleaned) && cleaned.length === 0) return;

        out[key] = cleaned;
      });

      return out;
    }

    return value;
  }

  function getMixtapeAnalyticsPayload() {
    const manifest = state.manifest || {};
    const isClaimed = manifest.sourceType === "claimed";

    return cleanMixtapeAnalyticsObject({
      claim_id: isClaimed ? manifest.claimId : undefined,
      slug: isClaimed ? manifest.ownerSlug : undefined,
      source_slug: manifest.sourceSlug,
      snapshot_hash: isClaimed ? manifest.snapshotHash : undefined,
      claimed_at: isClaimed ? manifest.claimedAt : undefined,
      title: manifest.title,
      skin: manifest.skin,
      track_count: Array.isArray(manifest.tracks) ? manifest.tracks.length : 0,
      route_kind: isClaimed ? "claimed" : "live",
      // LP-031: lets the backend attribute per-mixtape stats precisely when a
      // creator has more than one mixtape on the same profile - activity
      // events previously only carried source_slug, which lumps every
      // mixtape on a profile together. Already present on state.manifest for
      // both live and claimed routes (see manifestFromLiveConfig).
      uuid: manifest.uuid
    });
  }

  function getTrackAnalyticsPayload(track, index) {
    track = track || {};

    return cleanMixtapeAnalyticsObject({
      youtube_video_id: track.youtubeVideoId,
      track_index: typeof index === "number" && index >= 0 ? index : undefined,
      title: track.title,
      artist: track.artist,
      duration_seconds: track.seconds,
      external_url: track.externalUrl
    });
  }

  function sendMixtapeAnalytics(eventType, options = {}) {
    if (!mixtapeAnalyticsEnabled) {
      if (analyticsDebugEnabled()) console.debug("[mixtape] analytics skipped", eventType);
      return;
    }

    const payload = cleanMixtapeAnalyticsObject({
      event_type: eventType,
      source: "mixtape",
      client: "mixtape-display",
      platform: "web",
      mixtape: options.mixtape || getMixtapeAnalyticsPayload(),
      track: options.track,
      action: options.action,
      commerce: options.commerce
    });

    try {
      if (analyticsDebugEnabled()) {
        console.debug("[mixtape] analytics queued", eventType, payload);
      }

      const url = analyticsEndpointUrl();
      const json = JSON.stringify(payload);

      // Match frontend/js/lollipop_analytics.js: send as a "simple" CORS
      // request (text/plain, no credentials, no custom headers) so the
      // analytics service never needs to answer a preflight.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([json], { type: "text/plain;charset=UTF-8" }));
        return;
      }

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: json,
        keepalive: true,
        mode: "cors",
        credentials: "include"
      }).then(response => {
        if (analyticsDebugEnabled()) {
          console.debug("[mixtape] analytics response", eventType, response.status);
        }
      }).catch(error => {
        if (analyticsDebugEnabled()) {
          console.debug("[mixtape] analytics failed", eventType, error);
        }
      });
    } catch (error) {
      if (analyticsDebugEnabled()) {
        console.debug("[mixtape] analytics exception", eventType, error);
      }
    }
  }

  function trackMixtapeViewOnce() {
    if (mixtapeViewTracked) return;
    mixtapeViewTracked = true;

    sendMixtapeAnalytics("mixtape_view", {
      action: {
        location: "player",
        route: window.location.pathname
      }
    });
  }

  function shareEntryDetected() {
    const params = new URLSearchParams(window.location.search || "");
    return params.get("share") === "1"
      || params.get("source") === "share"
      || params.get("entry") === "share";
  }

  function trackMixtapeShareOpenOnce() {
    if (mixtapeShareOpenTracked) return;
    mixtapeShareOpenTracked = true;

    sendMixtapeAnalytics("mixtape_share_open", {
      action: {
        location: "player",
        entry: "share"
      }
    });
  }

  function trackMixtapePlayStart(track, index) {
    sendMixtapeAnalytics("mixtape_play_start", {
      track: getTrackAnalyticsPayload(track, index),
      action: {
        location: "player",
        label: "Play"
      }
    });
  }

  function trackMixtapeOpenYouTube(track, index) {
    sendMixtapeAnalytics("mixtape_open_youtube", {
      track: getTrackAnalyticsPayload(track, index),
      action: {
        location: "player",
        target: "youtube",
        label: "Open YouTube"
      }
    });
  }

  function trackMixtapeRevealOnce(track, index) {
    const payload = getTrackAnalyticsPayload(track, index);
    const key = payload.youtube_video_id || `track:${index}`;
    if (trackedMixtapeReveals.has(key)) return;
    trackedMixtapeReveals.add(key);

    sendMixtapeAnalytics("mixtape_track_reveal", {
      track: payload,
      action: {
        location: "player",
        label: "Track revealed"
      }
    });
  }

  function trackMixtapeOrderTapCardTap() {
    sendMixtapeAnalytics("mixtape_order_tap_card_tap", {
      action: {
        location: "player",
        label: "Make your own mixtape card",
        target: "mixtape_card_cta"
      }
    });
  }

  /* ── Claim bar (tap handoff from /validate/tape) ──
     Mirrors the App Clip's inline player + "CLAIM THIS MIXTAPE" gradient
     bar (see AppClipClaimView.playerClaimBar): the validate page redirects
     straight here instead of showing its own "found a mixtape" drawer, and
     stashes the deep link + copy in sessionStorage for us to pick up. */
  let mixtapeClaimBar = null;
  let mixtapeClaimBarState = null;
  let mixtapeClaimBarDismissed = false;
  let mixtapeClaimBarReappearTimer = null;

  function initMixtapeClaimBar() {
    let payload = null;
    try {
      const raw = sessionStorage.getItem(MIXTAPE_CLAIM_BAR_KEY);
      if (raw) {
        sessionStorage.removeItem(MIXTAPE_CLAIM_BAR_KEY);
        payload = JSON.parse(raw);
      }
    } catch (err) {
      payload = null;
    }

    if (!payload || !payload.deepLink) return;
    if (Date.now() - Number(payload.savedAt || 0) > MIXTAPE_CLAIM_BAR_MAX_AGE_MS) return;

    mixtapeClaimBarState = payload;
    showMixtapeClaimBar();
  }

  function showMixtapeClaimBar() {
    if (!mixtapeClaimBarState || mixtapeClaimBarDismissed) return;
    if (!mixtapeClaimBar) mixtapeClaimBar = buildMixtapeClaimBar();
    if (!mixtapeClaimBar.isConnected) els.app.appendChild(mixtapeClaimBar);
    requestAnimationFrame(() => mixtapeClaimBar.classList.add("visible"));
  }

  function buildMixtapeClaimBar() {
    const bar = document.createElement("div");
    bar.className = "mixtape-claim-bar";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mixtape-claim-bar-button";
    button.setAttribute(
      "aria-label",
      String(mixtapeClaimBarState.title || "Claim this mixtape").replace(/MIXTAPE/gi, "mixtape")
    );
    button.addEventListener("click", openMixtapeClaimBar);

    const icon = document.createElement("span");
    icon.className = "mixtape-claim-bar-icon";
    icon.innerHTML = '<i class="fa-solid fa-compact-disc" aria-hidden="true"></i>';

    const copy = document.createElement("span");
    copy.className = "mixtape-claim-bar-copy";

    const title = document.createElement("span");
    title.className = "mixtape-claim-bar-title";
    title.textContent = mixtapeClaimBarState.title || "Claim This Mixtape";

    const message = document.createElement("span");
    message.className = "mixtape-claim-bar-message";
    message.textContent = mixtapeClaimBarState.message || "Save this drop to your Lollipop collection.";

    copy.append(title, message);

    const chevron = document.createElement("i");
    chevron.className = "fa-solid fa-chevron-right mixtape-claim-bar-chevron";
    chevron.setAttribute("aria-hidden", "true");

    button.append(icon, copy, chevron);

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "mixtape-claim-bar-dismiss";
    dismiss.setAttribute("aria-label", "Dismiss");
    dismiss.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    dismiss.addEventListener("click", event => {
      event.stopPropagation();
      dismissMixtapeClaimBar();
    });

    bar.append(button, dismiss);
    return bar;
  }

  function dismissMixtapeClaimBar() {
    mixtapeClaimBarDismissed = true;
    mixtapeClaimBar?.classList.remove("visible");

    clearTimeout(mixtapeClaimBarReappearTimer);
    mixtapeClaimBarReappearTimer = setTimeout(() => {
      mixtapeClaimBarDismissed = false;
      showMixtapeClaimBar();
    }, MIXTAPE_CLAIM_BAR_REAPPEAR_MS);
  }

  // Same "try the deep link, fall back to app-store links if the tab never
  // hides" pattern as the web claim drawer's openDeepLinkWithInstallFallback
  // in lollipop_authenticate.js — kept local here since the player is a
  // standalone page with no shared JS with that script.
  function openMixtapeClaimBar() {
    if (!mixtapeClaimBarState?.deepLink) return;

    let didHide = false;
    const onVisibilityChange = () => {
      if (document.hidden) didHide = true;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const link = document.createElement("a");
    link.href = mixtapeClaimBarState.deepLink;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (!didHide) showMixtapeInstallOverlay();
    }, 1400);
  }

  function showMixtapeInstallOverlay() {
    let overlay = document.getElementById("mixtapeInstallOverlay");
    if (overlay) {
      overlay.classList.remove("hidden");
      return;
    }

    overlay = document.createElement("div");
    overlay.id = "mixtapeInstallOverlay";
    overlay.className = "mixtape-install-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const card = document.createElement("div");
    card.className = "mixtape-install-card";

    const title = document.createElement("h2");
    title.className = "mixtape-install-title";
    title.textContent = "Get the Lollipop app";

    const body = document.createElement("p");
    body.className = "mixtape-install-body";
    body.textContent = "Claiming a mixtape happens inside the Lollipop app. Open the app, or install it and tap again.";

    const actions = document.createElement("div");
    actions.className = "mixtape-install-actions";

    const iosLink = document.createElement("a");
    iosLink.className = "mixtape-install-button primary";
    iosLink.href = APP_STORE_URL;
    iosLink.target = "_blank";
    iosLink.rel = "noopener";
    iosLink.textContent = "Download for iOS";

    const androidLink = document.createElement("a");
    androidLink.className = "mixtape-install-button secondary";
    androidLink.href = ANDROID_STORE_URL;
    androidLink.target = "_blank";
    androidLink.rel = "noopener";
    androidLink.textContent = "Download for Android";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "mixtape-install-close";
    closeBtn.textContent = "Not now";
    closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));

    actions.append(iosLink, androidLink, closeBtn);
    card.append(title, body, actions);
    overlay.appendChild(card);
    els.app.appendChild(overlay);
  }

  /* ── Events ── */
  function bindEvents() {
    els.cassetteVisual.closest(".visual-stage")?.addEventListener("click", handleCassetteVisualClick);
    bindPrimaryControls();

    if (els.makeCardLink && els.makeCardLink.dataset.analyticsBound !== "true") {
      els.makeCardLink.addEventListener("click", trackMixtapeOrderTapCardTap);
      els.makeCardLink.dataset.analyticsBound = "true";
    }

    document.addEventListener("click", (event) => {
      const sticker = event.target instanceof Element
        ? event.target.closest(".door-sticker-youtube")
        : null;
      if (!sticker || state.manifest.skin !== "cassette") return;

      event.preventDefault();
      event.stopPropagation();
      unlockAudio();
      playButtonClickSound("light");
      toggleView();
    }, true);

    document.addEventListener("click", (event) => {
      if (state.manifest.skin !== "popamp") return;
      const el = event.target instanceof Element ? event.target : null;
      if (!el || el.closest("#popampPreampRange")) return;

      const playlistGridButton = el.closest(POPAMP_PLAYLIST_GRID_BUTTON);
      if (playlistGridButton) {
        event.preventDefault();
        event.stopPropagation();
        if (state.popampVideoLocation === "playlist") {
          togglePopampPlaylistVideoGrid();
        } else {
          togglePopampVideoLocation();
        }
        return;
      }

      const playlistVideoButton = el.closest(POPAMP_PLAYLIST_VIDEO_BUTTONS);
      if (playlistVideoButton) {
        event.preventDefault();
        event.stopPropagation();
        togglePopampVideoLocation();
        return;
      }

      if (el.closest(POPAMP_FAKE_SWAP_OUT)) togglePopampViz();
    });

    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.classList.contains("popamp-fake-range-vertical")) {
        if (target.id === "popampPreampRange") {
          state.popampPreamp = Math.max(0, Math.min(100, Number(target.value) || 0));
          applyEffectivePlayerVolume();
        } else {
          // Fake EQ band slider: swap the viz video back out to the matrix.
          setPopampViz("matrix");
        }
        syncEqualizerSliderColor(target);
        return;
      }

      if (target.id === "popampSpectrumRange") {
        const duration = Math.max(1, Number(state.duration || currentTrack().seconds || 1));
        state.position = (Number(target.value) / 1000) * duration;
        updateUI();
        return;
      }

      if (target.id === "popampVolumeRange") {
        state.popampVolume = Math.max(0, Math.min(100, Number(target.value) || 0));
        syncCassetteVolumeSlider();
        applyEffectivePlayerVolume();
        return;
      }

      if (target.id === "cassetteVolumeRange") {
        state.popampVolume = Math.max(0, Math.min(100, Number(target.value) || 0));
        syncCassetteVolumeSlider();
        applyEffectivePlayerVolume();
        return;
      }

      if (target.id === "popampBalanceRange") {
        state.popampBalance = Math.max(0, Math.min(100, Number(target.value) || 0));
      }
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.id === "popampSpectrumRange") {
        const duration = Math.max(1, Number(state.duration || currentTrack().seconds || 1));
        const targetSeconds = (Number(target.value) / 1000) * duration;
        state.position = targetSeconds;
        if (state.playerReady && state.player?.seekTo) {
          try { state.player.seekTo(targetSeconds, true); } catch (err) { console.warn(err); }
        }
        updateUI();
        return;
      }

      if (target.id === "popampVolumeRange") {
        state.popampVolume = Math.max(0, Math.min(100, Number(target.value) || 0));
        syncCassetteVolumeSlider();
        applyEffectivePlayerVolume();
        return;
      }

      if (target.id === "cassetteVolumeRange") {
        state.popampVolume = Math.max(0, Math.min(100, Number(target.value) || 0));
        syncCassetteVolumeSlider();
        applyEffectivePlayerVolume();
        return;
      }

      if (target.id === "popampBalanceRange") {
        state.popampBalance = Math.max(0, Math.min(100, Number(target.value) || 0));
      }
    });

    els.viewToggle?.addEventListener("click", () => {
      playButtonClickSound("light");
      if (state.manifest.skin === "popamp") {
        togglePopampVideoLocation();
        syncViewToggleChrome();
        return;
      }
      toggleView();
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      // Viz toggling for these chips is handled by the delegated click
      // listener above; the change handler only does each chip's real work.
      if (target.id === "popampChipPl") {
        // PL only toggles the playlist stack. Do not move/swap the video.
        state.playlistPanelVisible = target.checked;
        updateUI();
        return;
      }

      if (target.id === "popampChipEq") {
        // EQ only toggles the equalizer stack. Do not move/swap the video.
        state.popampEqPanelVisible = target.checked;
        updateUI();
        return;
      }

      if (target.id === "popampShuffle") {
        state.popampShuffleEnabled = target.checked;
        rebuildShuffleRemaining();
        updateUI();
        return;
      }

      if (target.id === "popampRepeat") {
        state.popampRepeatEnabled = target.checked;
        updateUI();
      }
    });

    const reportBtn    = document.getElementById("reportMixtapeBtn");
    const reportModal  = document.getElementById("reportModal");
    const reportCancel = document.getElementById("reportCancelBtn");
    const reportSubmit = document.getElementById("reportSubmitBtn");
    const reportReason = document.getElementById("reportReason");
    const reportDetails = document.getElementById("reportDetails");
    const reportStatus = document.getElementById("reportStatus");

    if (reportBtn && reportModal) {
      reportBtn.addEventListener("click", () => {
        reportModal.classList.remove("hidden");
        if (reportStatus) { reportStatus.textContent = ""; reportStatus.classList.add("hidden"); }
        if (reportDetails) reportDetails.value = "";
      });
    }

    if (reportCancel && reportModal) {
      reportCancel.addEventListener("click", () => reportModal.classList.add("hidden"));
    }

    if (reportSubmit && reportModal) {
      reportSubmit.addEventListener("click", async () => {
        const slug = state.manifest?.sourceSlug || state.manifest?.ownerSlug || "";
        const reason = reportReason?.value || "other";
        const details = reportDetails?.value?.trim() || "";

        reportSubmit.disabled = true;
        if (reportStatus) { reportStatus.textContent = "Sending…"; reportStatus.classList.remove("hidden"); }

        try {
          const res = await fetch("/lollipop/mixtape/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, reason, details })
          });
          if (res.ok) {
            if (reportStatus) { reportStatus.textContent = "Report submitted. Thank you."; reportStatus.classList.remove("hidden"); }
            setTimeout(() => reportModal.classList.add("hidden"), 2000);
          } else {
            if (reportStatus) { reportStatus.textContent = "Something went wrong. Please try again."; reportStatus.classList.remove("hidden"); }
          }
        } catch (_) {
          if (reportStatus) { reportStatus.textContent = "Could not send report. Check your connection."; reportStatus.classList.remove("hidden"); }
        } finally {
          reportSubmit.disabled = false;
        }
      });
    }
  }

  function bindPrimaryControls() {
    if (els.playButton && els.playButton.dataset.bound !== "true") {
      els.playButton.addEventListener("click", press(els.playButton, togglePlayback));
      els.playButton.dataset.bound = "true";
    }

    if (els.nextButton && els.nextButton.dataset.bound !== "true") {
      els.nextButton.addEventListener("click", press(els.nextButton, () => nextTrack(true, true)));
      els.nextButton.dataset.bound = "true";
    }

    if (els.prevButton && els.prevButton.dataset.bound !== "true") {
      els.prevButton.addEventListener("click", press(els.prevButton, () => prevTrack(true, true)));
      els.prevButton.dataset.bound = "true";
    }

    if (els.cassetteMuteButton && els.cassetteMuteButton.dataset.bound !== "true") {
      els.cassetteMuteButton.addEventListener("click", () => {
        state.popampVolume = 0;
        syncCassetteVolumeSlider();
        applyEffectivePlayerVolume();
      });
      els.cassetteMuteButton.dataset.bound = "true";
    }

    if (els.progressInput && els.progressInput.dataset.bound !== "true") {
      els.progressInput.addEventListener("input", () => {
        state.position = Number(els.progressInput.value) || 0;
        updateUI();
      });

      els.progressInput.addEventListener("change", () => {
        const targetSeconds = Number(els.progressInput.value) || 0;
        state.position = targetSeconds;
        if (state.playerReady && state.player?.seekTo) {
          try { state.player.seekTo(targetSeconds, true); } catch (err) { console.warn(err); }
        }
        updateUI();
      });

      els.progressInput.dataset.bound = "true";
    }
  }

  function resolveManifestSkin(value) {
    const skin = String(value || "").trim().toLowerCase();
    if (SUPPORTED_SKINS.has(skin)) return skin;

    // Production profile configs may contain the profile/page skin here
    // (for example "minimal"). That is not a mixtape display skin, so do not
    // let it downgrade popamp/cassette into the generic default renderer.
    return normalizeSkin(DEFAULT_MANIFEST?.skin, "cassette");
  }

  function normalizeSkin(value, fallback = "cassette") {
    const skin = String(value || "").trim().toLowerCase();
    if (SUPPORTED_SKINS.has(skin)) return skin;
    return SUPPORTED_SKINS.has(fallback) ? fallback : "cassette";
  }

  function applySkin() {
    els.app.dataset.skin = state.manifest.skin;
    els.app.dataset.sourceType = state.manifest.sourceType || "live";
    const labelColor = state.labelColor
      || resolveNeonHexFromUuid(state.manifest.uuid || state.manifest.sourceSlug || state.manifest.id)
      || DEFAULT_LABEL_COLOR;
    els.app.style.setProperty("--mixtape-label-color", labelColor);
    applyDefaultTheme();
    updateSourceExtras();
  }

  function applyDefaultTheme() {
    const backgroundColor = state.manifest?.theme?.backgroundColor || "#4b4b4b";
    const textColor = state.manifest?.theme?.textColor || "#f2f2f2";
    els.app.style.setProperty("--default-player-bg", backgroundColor);
    els.app.style.setProperty("--default-player-text", textColor);
    els.app.style.setProperty("--default-player-muted", colorWithAlpha(textColor, 0.58));
    els.app.style.setProperty("--default-player-soft", colorWithAlpha(textColor, 0.42));
  }

  function resolveLabelColorFromUrl() {
    let raw = "";
    try {
      raw = new URLSearchParams(window.location.search || "").get("label") || "";
    } catch (_) {
      return null;
    }

    const value = String(raw).trim().replace(/^#/, "");
    return /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : null;
  }

  function resolveNeonHexFromUuid(identifier) {
    const value = String(identifier || "").trim() || "mixtape";
    let total = 0;
    for (const ch of value) total += ch.codePointAt(0);
    return `#${NEON_LABEL_PALETTE[total % NEON_LABEL_PALETTE.length]}`;
  }

  function isHexColor(value) {
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim());
  }

  function normalizeThemeColor(value) {
    const color = String(value || "").trim();
    return isHexColor(color) ? color : "";
  }

  function colorWithAlpha(hexColor, alpha) {
    const normalized = normalizeThemeColor(hexColor);
    if (!normalized) return `rgba(255,255,255,${alpha})`;
    const expanded = normalized.length === 4
      ? `#${normalized.slice(1).split("").map(char => `${char}${char}`).join("")}`
      : normalized;
    const r = Number.parseInt(expanded.slice(1, 3), 16);
    const g = Number.parseInt(expanded.slice(3, 5), 16);
    const b = Number.parseInt(expanded.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function press(button, callback) {
    return () => {
      unlockAudio();
      button.classList.add("is-pressed");
      setTimeout(() => button.classList.remove("is-pressed"), 120);
      playButtonClickSound(button === els.playButton ? "main" : "transport");
      callback();
    };
  }

  /* ── YouTube player ── */
  function createYouTubePlayer() {
    /* Wait for the manifest: the YT API can finish loading before the config
       fetch resolves, and creating the player then would cue the demo track. */
    if (!state.manifestReady || !state.ytApiReady || state.player || !window.YT?.Player) return;
    const track = currentTrack();
    state.duration = track.seconds || 1;

    state.player = new YT.Player("youtubePlayer", {
      videoId: track.youtubeVideoId,
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          state.playerReady = true;
          state.loadedVideoId = track.youtubeVideoId;
          applyEffectivePlayerVolume();
          setStatus("YOUTUBE READY");
          updateUI();
        },
        onStateChange: handlePlayerState,
        onError: (event) => {
          console.warn("YouTube error", event?.data);
          setStatus("SOURCE ERROR");
        }
      }
    });
  }

  function handlePlayerState(event) {
    const YTPS = window.YT?.PlayerState || {};
    if (event.data === YTPS.PLAYING) {
      state.stopRequested = false;
      state.playing = true;
      state.buffering = false;
      state.transportMode = "playing";
      reveal(state.currentIndex);
    } else if (event.data === YTPS.PAUSED) {
      state.playing = false;
      state.buffering = false;
      state.transportMode = state.position > 0.01 ? "paused" : "idle";
    } else if (event.data === YTPS.CUED || event.data === YTPS.UNSTARTED) {
      state.playing = false;
      state.buffering = false;
      state.transportMode = "idle";
    } else if (event.data === YTPS.BUFFERING) {
      state.buffering = true;
    } else if (event.data === YTPS.ENDED) {
      state.playing = false;
      state.buffering = false;
      if (state.stopRequested) {
        state.stopRequested = false;
        syncFromPlayer();
        renderTrackList();
        updateUI();
        return;
      }
      handleTrackEnded();
      return;
    }
    syncFromPlayer();
    renderTrackList();
    updateUI();
  }

  /* ── Cassette visual ── */
  async function renderPlayerVisual() {
    applySkin();
    if (state.manifest.skin === "popamp") {
      await renderPopamp();
      els.cassetteDoorLayer.replaceChildren();
      return;
    }

    if (state.manifest.skin === "cassette") {
      await renderCassette();
      return;
    }

    renderDefaultPlayer();
  }

  function renderDefaultPlayer() {
    restoreDefaultControls();
    mountDefaultViewToggle();
    restoreDefaultTrackCard();
    restoreSourceFrame();
    els.cassetteVisual.replaceChildren();
    els.cassetteDoorLayer.replaceChildren();
  }

  async function renderCassette() {
    const controlsContent = await instantiateNodes(TEMPLATE_PATHS.cassetteControls);
    const shell = await instantiateTemplate(TEMPLATE_PATHS.cassetteShell);
    const trackCardContent = await instantiateNodes(TEMPLATE_PATHS.cassetteTrackCard);
    const door = await instantiateTemplate(TEMPLATE_PATHS.cassetteDoor);
    const existingFrame = document.querySelector(".youtube-frame");
    if (!shell || !trackCardContent.length || !door || !controlsContent.length) return;
    const controls = document.querySelector(".controls");
    controls?.replaceChildren(...controlsContent);
    bindCoreControlRefs();
    bindPrimaryControls();
    restoreTransportControls();
    restoreStandaloneViewToggle();
    restoreSourceFrame();
    const { title, sideLabel } = state.manifest;
    const side = escapeHTML(sideLabel || "A").replace(/^side\s*/i, "").charAt(0).toUpperCase();
    const titleStyle = cassetteTitleStyle();
    shell.setAttribute("aria-label", title);
    const titleTarget = shell.querySelector(".cassette-title-target");
    const sideTarget = shell.querySelector(".cassette-side-target");
    if (titleTarget instanceof HTMLElement) {
      titleTarget.textContent = title;
      titleTarget.style.cssText = titleStyle;
    }
    if (sideTarget) sideTarget.textContent = side;

    els.cassetteVisual.replaceChildren(shell);
    const trackCard = document.querySelector(".track-card");
    trackCard?.replaceChildren(...trackCardContent);
    if (trackCard && existingFrame) trackCard.appendChild(existingFrame);
    els.cassetteDoorLayer.replaceChildren(door);
    syncCassetteDoorState({ resetReady: true });
  }

  async function renderPopamp() {
    const shell = await instantiateTemplate(TEMPLATE_PATHS.popamp);
    const trackCardContent = await instantiateNodes(TEMPLATE_PATHS.popampTrackCard);
    if (!shell || !trackCardContent.length) return;
    const existingFrame = document.querySelector(".youtube-frame");

    shell.setAttribute("aria-label", state.manifest.title);
    const trackTitle = shell.querySelector("#popampTrackTitle");
    const volumeRange = shell.querySelector("#popampVolumeRange");
    const balanceRange = shell.querySelector("#popampBalanceRange");
    const playlistToggle = shell.querySelector("#popampChipPl");
    const equalizerToggle = shell.querySelector("#popampChipEq");
    const shuffleToggle = shell.querySelector("#popampShuffle");
    const repeatToggle = shell.querySelector("#popampRepeat");

    if (trackTitle) trackTitle.textContent = state.manifest.title;
    if (volumeRange instanceof HTMLInputElement) volumeRange.value = String(state.popampVolume);
    if (balanceRange instanceof HTMLInputElement) balanceRange.value = String(state.popampBalance);
    if (playlistToggle instanceof HTMLInputElement) playlistToggle.checked = state.playlistPanelVisible;
    if (equalizerToggle instanceof HTMLInputElement) equalizerToggle.checked = state.popampEqPanelVisible;
    if (shuffleToggle instanceof HTMLInputElement) shuffleToggle.checked = state.popampShuffleEnabled;
    if (repeatToggle instanceof HTMLInputElement) repeatToggle.checked = state.popampRepeatEnabled;

    els.cassetteVisual.replaceChildren(shell);
    const trackCard = document.querySelector(".track-card");
    trackCard?.replaceChildren(...trackCardContent);
    if (trackCard && existingFrame) {
      trackCard.appendChild(existingFrame);
    }

    mountPopampSourceFrame();
    restoreStandaloneViewToggle();
    bindPopampTransportControls();

    // Start on the matrix visualizer; the video swaps into this original
    // top display on play, and can also be moved into the playlist panel.
    state.popampVizMode = "matrix";
    state.popampVideoLocation = "top";
    els.app.dataset.popampViz = "matrix";
    els.app.dataset.popampPlaylistVideo = "false";
    els.app.dataset.popampPlaylistGridHidden = state.popampPlaylistGridHidden ? "true" : "false";
    els.app.dataset.popampEqVisible = state.popampEqPanelVisible ? "true" : "false";
  }

  function bindPopampTransportControls() {
    const prev = document.getElementById("popampPrevButton");
    const play = document.getElementById("popampPlayButton");
    const pause = document.getElementById("popampPauseButton");
    const stop = document.getElementById("popampStopButton");
    const next = document.getElementById("popampNextButton");
    const eject = document.getElementById("popampEjectButton");

    prev?.addEventListener("click", press(prev, () => prevTrack(true, true)));
    play?.addEventListener("click", press(play, () => playCurrent(true)));
    pause?.addEventListener("click", press(pause, pausePlayback));
    stop?.addEventListener("click", press(stop, stopPlayback));
    next?.addEventListener("click", press(next, () => nextTrack(true, true)));
    eject?.addEventListener("click", press(eject, toggleView));
  }

  function restoreTransportControls() {
    const controls = document.querySelector(".controls");
    const deck = els.playButton?.closest(".deck-buttons.controllers");
    if (controls && deck && deck.parentElement !== controls) {
      controls.appendChild(deck);
    }
  }

  function mountDefaultViewToggle() {
    const controls = document.querySelector(".controls .deck-buttons.controllers");
    if (controls && els.viewToggle && els.viewToggle.parentElement !== controls) {
      controls.appendChild(els.viewToggle);
    }
  }

  function restoreStandaloneViewToggle() {
    const panel = document.querySelector(".player-panel");
    const frame = document.querySelector(".youtube-frame");
    if (!panel || !els.viewToggle) return;
    if (els.viewToggle.parentElement === panel) return;
    if (frame?.nextSibling) {
      panel.insertBefore(els.viewToggle, frame.nextSibling);
      return;
    }
    panel.appendChild(els.viewToggle);
  }

  function restoreDefaultControls() {
    const controls = document.querySelector(".controls");
    if (!controls || !defaultControlsNodes.length) return;
    controls.replaceChildren(...defaultControlsNodes.map(node => node.cloneNode(true)));
    bindCoreControlRefs();
    bindPrimaryControls();
  }

  function bindCoreControlRefs() {
    els.elapsedTime = document.getElementById("elapsedTime");
    els.durationTime = document.getElementById("durationTime");
    els.currentArtwork = document.getElementById("currentArtwork");
    els.currentTitle = document.getElementById("currentTitle");
    els.currentMeta = document.getElementById("currentMeta");
    els.progressInput = document.getElementById("progressInput");
    els.cassetteMuteButton = document.getElementById("cassetteMuteButton");
    els.cassetteVolumeRange = document.getElementById("cassetteVolumeRange");
    els.playButton = document.getElementById("playButton");
    els.prevButton = document.getElementById("prevButton");
    els.nextButton = document.getElementById("nextButton");
    els.viewToggle = document.getElementById("viewToggle");
    els.viewToggleIcon = document.getElementById("viewToggleIcon");
    els.viewToggleLabel = document.getElementById("viewToggleLabel");
  }

  function restoreDefaultTrackCard() {
    const trackCard = document.querySelector(".track-card");
    if (!trackCard || !defaultTrackCardNodes.length) return;
    trackCard.replaceChildren(...defaultTrackCardNodes.map(node => node.cloneNode(true)));
  }

  function mountPopampSourceFrame() {
    ensurePopampFloatingVideoFrame();
    syncPopampVideoFrameRect();
  }

  function mountPopampPlaylistVideoFrame() {
    ensurePopampFloatingVideoFrame();
    syncPopampVideoFrameRect();
  }

  function ensurePopampFloatingVideoFrame() {
    if (state.manifest.skin !== "popamp") return null;
    const frame = document.querySelector(".youtube-frame");
    const panel = document.querySelector(".player-panel");
    if (!frame || !panel) return null;

    frame.classList.add("popamp-floating-video");
    if (frame.parentElement !== panel) {
      panel.appendChild(frame);
    }
    return frame;
  }

  function syncPopampVideoFrameRect() {
    if (state.manifest.skin !== "popamp") return;
    const frame = ensurePopampFloatingVideoFrame();
    const panel = document.querySelector(".player-panel");
    const target = state.popampVideoLocation === "playlist"
      ? document.getElementById("popampPlaylistVideoMount")
      : document.querySelector(".popamp-viz-panel");

    if (!frame || !panel || !target) return;

    const panelRect = panel.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const edgeInset = target.id === "popampPlaylistVideoMount" ? 0 : 2;
    const left = (targetRect.left - panelRect.left) + edgeInset;
    const top = (targetRect.top - panelRect.top) + edgeInset;
    const width = Math.max(0, targetRect.width - (edgeInset * 2));
    const height = Math.max(0, targetRect.height - (edgeInset * 2));

    panel.style.setProperty("--popamp-video-x", `${left}px`);
    panel.style.setProperty("--popamp-video-y", `${top}px`);
    panel.style.setProperty("--popamp-video-w", `${width}px`);
    panel.style.setProperty("--popamp-video-h", `${height}px`);

    panel.classList.add("is-popamp-video-animating");
    clearTimeout(state.popampVideoAnimationTimer);
    state.popampVideoAnimationTimer = setTimeout(() => {
      panel.classList.remove("is-popamp-video-animating");
    }, 420);
  }

  function hidePopampPlaylistVideo() {
    state.popampVideoLocation = "top";
    els.app.dataset.popampPlaylistVideo = "false";
    const mount = document.getElementById("popampPlaylistVideoMount");
    if (mount) mount.setAttribute("aria-hidden", "true");
    mountPopampSourceFrame();
    syncViewToggleChrome();
  }

  function restoreSourceFrame() {
    const frame = document.querySelector(".youtube-frame");
    const trackCard = document.querySelector(".track-card");
    const jcard = trackCard?.querySelector(".jcard");
    if (frame && trackCard && jcard && frame.parentElement !== trackCard) {
      trackCard.appendChild(frame);
    }
  }

  function cassetteTitleStyle() {
    const rotate = randomBetween(-4.2, 2.6).toFixed(2);
    const shiftX = randomBetween(-30, 24).toFixed(1);
    const shiftY = randomBetween(-2, 4).toFixed(1);
    const width = randomBetween(68, 88).toFixed(1);
    const letterSpacing = randomBetween(-0.01, 0.025).toFixed(3);
    return [
      `transform: translate(${shiftX}px, ${shiftY}px) rotate(${rotate}deg)`,
      `width: ${width}%`,
      `letter-spacing: ${letterSpacing}em`
    ].join("; ");
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function handleCassetteVisualClick(event) {
    if (state.manifest.skin !== "cassette") return;
    const doorStage = els.cassetteDoorLayer.querySelector(".cassette-door-stage");
    if (!doorStage?.classList.contains("is-door-ready")) return;
    unlockAudio();
    playButtonClickSound("light");
    toggleCassetteDoor();
  }

  function toggleCassetteDoor() {
    state.cassetteDoorOpen = !state.cassetteDoorOpen;
    syncCassetteDoorState();
  }

  function syncCassetteDoorState(options = {}) {
    const { resetReady = false } = options;
    const doorStage = els.cassetteDoorLayer.querySelector(".cassette-door-stage");
    if (!doorStage) return;

    doorStage.dataset.doorOpen = state.cassetteDoorOpen ? "true" : "false";

    if (!resetReady) return;

    doorStage.classList.remove("is-door-ready");
    clearTimeout(state.cassetteDoorReadyTimer);
    state.cassetteDoorReadyTimer = window.setTimeout(() => {
      const currentDoorStage = els.cassetteDoorLayer.querySelector(".cassette-door-stage");
      if (!currentDoorStage) return;
      currentDoorStage.classList.add("is-door-ready");
      currentDoorStage.dataset.doorOpen = state.cassetteDoorOpen ? "true" : "false";
    }, 2140);
  }

  /* ── Track list ── */
  function renderTrackList() {
    const trackList = document.getElementById("trackList");
    if (!trackList) return;

    if (state.manifest.skin === "default") {
      renderDefaultTrackList(trackList);
      return;
    }

    const rows = state.manifest.tracks.map((track, index) => {
      const isActive = index === state.currentIndex;
      const shown = trackDisplay(track, index);
      const row = document.createElement("button");
      row.className = `track-row${isActive ? " active" : ""}`;
      row.type = "button";
      row.dataset.index = String(index);

      const trackNum = document.createElement("span");
      trackNum.className = "track-num";

      const playMark = document.createElement("span");
      playMark.className = "play-mark";
      playMark.textContent = "▶";

      trackNum.appendChild(playMark);
      if (!isActive) {
        trackNum.append(String(index + 1));
      }

      const trackText = document.createElement("span");
      trackText.className = "track-text";

      const trackTitle = document.createElement("span");
      trackTitle.className = "track-title";
      trackTitle.textContent = shown.title;

      const trackArtist = document.createElement("span");
      trackArtist.className = "track-artist";
      trackArtist.textContent = shown.artist;

      trackText.append(trackTitle, trackArtist);

      const trackDuration = document.createElement("span");
      trackDuration.className = "track-duration";
      trackDuration.textContent = shown.duration;

      row.append(trackNum, trackText, trackDuration);
      return row;
    });

    trackList.replaceChildren(...rows);

    trackList.querySelectorAll(".track-row").forEach(row => {
      row.addEventListener("click", () => {
        unlockAudio();
        playButtonClickSound("light");
        selectTrack(Number(row.dataset.index), true, true);
      });
    });
  }

  function renderDefaultTrackList(trackList) {
    const rows = state.manifest.tracks.map((track, index) => {
      const row = document.createElement("button");
      row.className = `default-track-row${index === state.currentIndex ? " active" : ""}`;
      row.type = "button";
      row.dataset.index = String(index);

      const cover = document.createElement("img");
      cover.className = "default-track-cover";
      cover.src = track.thumbnail;
      cover.alt = "";

      const copy = document.createElement("span");
      copy.className = "default-track-copy";

      const title = document.createElement("span");
      title.className = "default-track-title";
      title.textContent = visibleTrackTitle(track, index);

      const meta = document.createElement("span");
      meta.className = "default-track-meta";
      meta.textContent = `${isTrackVisible(index) ? track.artist : "Hidden"} · ${isTrackVisible(index) ? (track.duration || formatTime(track.seconds)) : "--:--"}`;

      const action = document.createElement("span");
      action.className = "default-track-action";
      action.textContent = "▶";

      copy.append(title, meta);
      row.append(cover, copy, action);
      return row;
    });

    trackList.replaceChildren(...rows);
    trackList.querySelectorAll(".default-track-row").forEach(row => {
      row.addEventListener("click", () => {
        unlockAudio();
        playButtonClickSound("light");
        selectTrack(Number(row.dataset.index), true, true);
      });
    });
  }

  /* ── Playback ── */
  function currentTrack() {
    return state.manifest.tracks[state.currentIndex] || state.manifest.tracks[0] || {
      title: "No tracks", artist: "", displayTitle: "No tracks loaded",
      youtubeVideoId: "", seconds: 1, duration: "0:00", externalUrl: "#"
    };
  }

  function playCurrent(userInitiated = false) {
    const track = currentTrack();
    reveal(state.currentIndex);

    if (!state.playerReady || !state.player) {
      setStatus("SOURCE LOADING");
      updateUI();
      return;
    }

    try {
      if (state.loadedVideoId !== track.youtubeVideoId) {
        state.loadedVideoId = track.youtubeVideoId;
        state.position = 0;
        state.duration = track.seconds || 1;
        state.player.loadVideoById({ videoId: track.youtubeVideoId, startSeconds: 0 });
      } else {
        state.player.playVideo();
      }
      state.playing = true;
      state.transportMode = "playing";
      setStatus("PLAYING");
      if (userInitiated) {
        trackMixtapePlayStart(track, state.currentIndex);
        // Swap the YouTube video into the popamp viz panel on a real play tap.
        if (state.manifest.skin === "popamp") setPopampViz("video");
        // Swap the tape's J-card for the YouTube video on a real play tap.
        if (state.manifest.skin === "cassette" && state.view !== "source") {
          setView("source");
          trackMixtapeOpenYouTube(track, state.currentIndex);
        }
      }
    } catch (err) {
      console.warn("Play failed", err);
      setStatus("TAP SOURCE");
    }

    renderTrackList();
    updateUI();
  }

  function pausePlayback() {
    if (state.playerReady && state.player?.pauseVideo) {
      try { state.player.pauseVideo(); } catch (err) { console.warn(err); }
    }
    state.playing = false;
    state.buffering = false;
    state.transportMode = "paused";
    // Pausing hands the tape back its J-card.
    if (state.manifest.skin === "cassette") setView("playlist");
    updateUI();
  }

  function stopPlayback() {
    state.stopRequested = true;
    const track = currentTrack();
    if (state.playerReady && state.player?.cueVideoById) {
      try {
        state.player.cueVideoById({ videoId: track.youtubeVideoId, startSeconds: 0 });
      } catch (err) {
        console.warn(err);
      }
    } else if (state.playerReady && state.player?.pauseVideo) {
      try { state.player.pauseVideo(); } catch (err) { console.warn(err); }
      if (state.player?.seekTo) {
        try { state.player.seekTo(0, true); } catch (err) { console.warn(err); }
      }
    }
    state.playing = false;
    state.buffering = false;
    state.transportMode = "idle";
    state.position = 0;
    state.loadedVideoId = track.youtubeVideoId;
    setStatus("STOP");
    renderTrackList();
    updateUI();
  }

  function togglePlayback() {
    if (state.playing) pausePlayback();
    else playCurrent(true);
  }

  function handleTrackEnded() {
    // The repeat toggle only exists in the popamp skin's chrome; other skins
    // have no way to switch it off, so only popamp may honor it.
    if (state.manifest.skin === "popamp" && state.popampRepeatEnabled) {
      replayCurrentTrack();
      return;
    }
    nextTrack(true);
  }

  function replayCurrentTrack() {
    state.position = 0;
    state.duration = currentTrack().seconds || 1;
    if (state.playerReady && state.player?.seekTo) {
      try { state.player.seekTo(0, true); } catch (err) { console.warn(err); }
    }
    playCurrent();
  }

  function nextTrack(shouldPlay = true, userInitiated = false) {
    if (state.popampShuffleEnabled) {
      selectTrack(nextShuffleIndex(), shouldPlay, userInitiated);
      return;
    }
    selectTrack(state.currentIndex + 1, shouldPlay, userInitiated);
  }

  function prevTrack(shouldPlay = true, userInitiated = false) {
    /* Restart current track if more than 4 seconds in; otherwise go back */
    selectTrack(state.position > 4 ? state.currentIndex : state.currentIndex - 1, shouldPlay, userInitiated);
  }

  function selectTrack(index, shouldPlay = true, userInitiated = false) {
    const length = state.manifest.tracks.length;
    if (!length) return;
    state.currentIndex = (index + length) % length;
    state.position = 0;
    state.duration = currentTrack().seconds || 1;
    state.loadedVideoId = "";
    state.transportMode = shouldPlay ? "playing" : "idle";
    markCurrentTrackAsShuffled();
    renderTrackList();
    updateUI();
    if (shouldPlay) playCurrent(userInitiated);
    else cueCurrent();
    // Changing tracks by hand always lands back on the tape's J-card, even
    // though playCurrent() above may have just swapped in the video.
    if (userInitiated && state.manifest.skin === "cassette") setView("playlist");
  }

  function cueCurrent() {
    if (!state.playerReady || !state.player?.cueVideoById) return;
    const track = currentTrack();
    try {
      state.player.cueVideoById({ videoId: track.youtubeVideoId, startSeconds: 0 });
      state.loadedVideoId = track.youtubeVideoId;
      state.transportMode = "idle";
    } catch (err) {
      console.warn("Cue failed", err);
    }
  }

  function reveal(index) {
    const isNewReveal = state.manifest.mysteryMode && !state.revealed.has(index);
    state.revealed.add(index);
    if (isNewReveal) trackMixtapeRevealOnce(state.manifest.tracks[index], index);
  }

  /* ── Sync & UI ── */
  function syncFromPlayer() {
    if (!state.playerReady || !state.player) return;
    try {
      const current  = Number(state.player.getCurrentTime?.() || 0);
      const duration = Number(state.player.getDuration?.()   || 0);
      if (Number.isFinite(current)) state.position = current;
      if (Number.isFinite(duration) && duration > 0) {
        state.duration = duration;
        const track = currentTrack();
        track.seconds  = Math.round(duration);
        track.duration = formatTime(duration);
      }
    } catch (err) {
      console.warn("Sync failed", err);
    }
  }

  function startTimer() {
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      syncFromPlayer();
      updateUI();
    }, 500);
  }

  function updateUI() {
    updateSourceExtras();
    const track         = currentTrack();
    const duration      = Math.max(1, Number(state.duration || track.seconds || 1));
    const progressPct   = Math.max(0, Math.min(100, (state.position / duration) * 100));
    const tapeProgress  = mixtapeProgress();

    els.app.dataset.playerState = state.playing ? "playing" : (state.buffering ? "buffering" : "idle");
    els.app.style.setProperty("--progress", `${progressPct}%`);
    els.app.style.setProperty("--track-progress", String(tapeProgress));

    /* Play / pause icon toggle — swap the CSS-drawn glyph class */
    els.playButton.classList.toggle("pause", state.playing);
    els.playButton.classList.toggle("play", !state.playing);
    const defaultPlayIcon = document.getElementById("playButtonIcon");
    if (defaultPlayIcon) {
      defaultPlayIcon.className = state.playing ? "fa-solid fa-pause" : "fa-solid fa-play";
    }

    els.elapsedTime.textContent = formatTime(state.position);
    els.durationTime.textContent = track.duration || formatTime(duration);
    if (els.currentArtwork instanceof HTMLImageElement) {
      els.currentArtwork.src = track.thumbnail;
      els.currentArtwork.alt = `${track.artist} artwork`;
    }
    if (els.currentTitle) {
      els.currentTitle.textContent = visibleTrackTitle(track, state.currentIndex);
    }
    if (els.currentMeta) {
      els.currentMeta.textContent = isTrackVisible(state.currentIndex)
        ? `${track.artist} · ${track.duration || formatTime(duration)}`
        : "Hidden until the tape plays · --:--";
    }
    els.progressInput.max   = String(Math.round(duration));
    els.progressInput.value = String(Math.min(duration, state.position));
    els.app.dataset.playlistVisible = state.playlistPanelVisible ? "true" : "false";
    els.app.dataset.popampPlaylistGridHidden = state.popampPlaylistGridHidden ? "true" : "false";
    els.app.dataset.popampEqVisible = state.popampEqPanelVisible ? "true" : "false";
    syncPopampTransportState();
    updatePopampDisplay();
    syncPopampToggles();
    syncPopampVideoFrameRect();
  }

  function updateSourceExtras() {
    const isClaimed = state.manifest?.sourceType === "claimed";

    if (els.sourceBadge) {
      els.sourceBadge.classList.toggle("hidden", !isClaimed);
      els.sourceBadge.textContent = "Claimed Copy";
      if (isClaimed && state.manifest.sourceSlug) {
        els.sourceBadge.title = `Saved from ${state.manifest.sourceSlug}`;
      } else {
        els.sourceBadge.removeAttribute("title");
      }
    }

    if (els.makeCardLink) {
      els.makeCardLink.classList.toggle("hidden", !isClaimed);
    }
  }

  function updatePopampDisplay() {
    if (state.manifest.skin !== "popamp") return;

    const titleEl = document.getElementById("popampTrackTitle");
    const modeEl = document.getElementById("popampMode");
    const spectrum = document.getElementById("popampSpectrum");
    const spectrumRange = document.getElementById("popampSpectrumRange");
    const matrix = document.getElementById("popampMatrix");
    const footerStatus = document.getElementById("popampFooterStatus");
    const preampRange = document.getElementById("popampPreampRange");

    // The Popamp2K layout was refactored so some older text-only nodes
    // (popampMode / popampFooterStatus) may not exist anymore. Do not let
    // those optional nodes block the canvas matrix from drawing.
    if (!titleEl) return;

    const track = currentTrack();
    const shown = trackDisplay(track, state.currentIndex);
    const visible = isTrackVisible(state.currentIndex);
    const isBuffering = state.buffering;
    const mode = isBuffering ? "LOAD" : state.playing ? "PLAY" : "STOP";
    const marquee = visible
      ? `${String(state.currentIndex + 1).padStart(2, "0")}. ${track.artist.toUpperCase()} - ${shown.title.toUpperCase()} (${track.duration || formatTime(state.duration)}) ***`
      : `${String(state.currentIndex + 1).padStart(2, "0")}. MYSTERY TRACK LOCKED ***`;

    titleEl.textContent = marquee;
    if (modeEl) modeEl.textContent = mode;
    if (footerStatus) footerStatus.textContent = `${formatTime(state.position)} / ${track.duration || formatTime(state.duration)}`;
    if (spectrum) spectrum.dataset.state = state.playing ? "playing" : isBuffering ? "buffering" : "idle";
    if (spectrumRange instanceof HTMLInputElement) {
      spectrumRange.value = String(Math.round(Math.max(0, Math.min(1, Number(state.position || 0) / Math.max(1, Number(state.duration || 1)))) * 1000));
    }
    const volumeRange = document.getElementById("popampVolumeRange");
    const balanceRange = document.getElementById("popampBalanceRange");
    if (volumeRange instanceof HTMLInputElement) volumeRange.value = String(state.popampVolume);
    if (balanceRange instanceof HTMLInputElement) balanceRange.value = String(state.popampBalance);
    if (preampRange instanceof HTMLInputElement) preampRange.value = String(state.popampPreamp);
    syncCassetteVolumeSlider();
    if (matrix instanceof HTMLCanvasElement) {
      syncPopampMatrixSize(matrix);
      drawPopampMatrix(matrix, {
        mode,
        position: Math.max(0, Number(state.position || 0)),
        playing: state.playing,
        buffering: isBuffering,
        // Over the video, draw only the dim dot grid — no lit pixels.
        dotsOnly: state.popampVizMode === "video"
      });
    }
  }

  function drawPopampMatrix(canvas, { mode, position, playing, buffering, dotsOnly }) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const width = canvas.width;
    const height = canvas.height;
    const gridStep = 4;
    const on = "#3df318";
    const dim = "rgba(61,243,24,0.12)";
    const amber = "#e5b947";
    const status = String(mode || "STOP").toUpperCase();
    const seconds = Math.max(0, Math.floor(position || 0));
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeText = `${minutes}:${String(secs).padStart(2, "0")}`;

    ctx.clearRect(0, 0, width, height);

    for (let y = 0; y < height; y += gridStep) {
      for (let x = 0; x < width; x += gridStep) {
        drawMatrixDot(ctx, x, y, dim, "rgba(61,243,24,0.035)");
      }
    }

    // Over the video we keep only the unlit dot grid for texture.
    if (dotsOnly) return;

    drawGlyph(ctx, status === "STOP" ? MATRIX_GLYPHS.stop : MATRIX_GLYPHS.play, 1, 1, on, gridStep, 1);
    const timeWidth = measureTextWidth(timeText, 1);
    const timeX = Math.max(5, Math.floor((width / gridStep) - timeWidth - 1));
    drawText(ctx, timeText, timeX, 1, on, gridStep, 1);
    // Status text (PLAY/STOP/LOAD) intentionally removed to keep the matrix shorter.

    if (playing) {
      const bars = buildMatrixBars(position || 0, false);
      const horizontalInset = 0;
      const availableWidth = Math.max(1, width - (horizontalInset * 2));
      const barGap = 1;
      const barWidth = Math.max(1, Math.floor((availableWidth - ((bars.length - 1) * barGap)) / bars.length));
      const startX = horizontalInset;
      const baseY = height - 4;

      bars.forEach((level, index) => {
        const x = startX + (index * (barWidth + barGap));
        for (let i = 0; i < level; i += 1) {
          const y = baseY - (i * 3);
          ctx.fillStyle = i === level - 1 ? amber : on;
          ctx.fillRect(x, y, barWidth, 2);
        }
      });
    }
  }

  function syncPopampMatrixSize(canvas) {
    const parent = canvas.parentElement;
    if (!parent) return;
    const width = Math.max(1, Math.floor(parent.clientWidth - 4));
    const height = Math.max(1, Math.floor(parent.clientHeight - 4));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  const MATRIX_GLYPHS = {
    play: [
      "1000",
      "1100",
      "1110",
      "1111",
      "1110",
      "1100",
      "1000"
    ],
    stop: [
      "1111",
      "1111",
      "1111",
      "1111",
      "1111",
      "1111",
      "1111"
    ],
    "0": ["111","101","101","101","111"],
    "1": ["010","110","010","010","111"],
    "2": ["111","001","111","100","111"],
    "3": ["111","001","111","001","111"],
    "4": ["101","101","111","001","001"],
    "5": ["111","100","111","001","111"],
    "6": ["111","100","111","101","111"],
    "7": ["111","001","001","001","001"],
    "8": ["111","101","111","101","111"],
    "9": ["111","101","111","001","111"],
    ":": ["0","1","0","1","0"],
    A: ["010","101","111","101","101"],
    D: ["110","101","101","101","110"],
    L: ["100","100","100","100","111"],
    O: ["111","101","101","101","111"],
    P: ["110","101","110","100","100"],
    S: ["111","100","111","001","111"],
    T: ["111","010","010","010","010"],
    Y: ["101","101","010","010","010"]
  };

  function buildMatrixBars(position, buffering) {
    const bars = [];
    const t = position * (buffering ? 8 : 4.2);
    for (let i = 0; i < 16; i += 1) {
      const waveA = Math.sin(t + (i * 0.52));
      const waveB = Math.sin((t * 1.7) - (i * 0.31));
      const waveC = Math.cos((t * 0.9) + (i * 0.77));
      const normalized = ((waveA * 0.45) + (waveB * 0.35) + (waveC * 0.2) + 1) / 2;
      const level = 2 + Math.round(normalized * 5);
      bars.push(Math.max(1, Math.min(7, level)));
    }
    return bars;
  }

  function drawText(ctx, text, x, y, color, gridStep = 4, scale = 1) {
    let cursor = x;
    for (const char of text) {
      const glyph = MATRIX_GLYPHS[char];
      if (glyph) {
        drawGlyph(ctx, glyph, cursor, y, color, gridStep, scale);
        cursor += (glyph[0].length * scale) + 1;
      } else {
        cursor += 2;
      }
    }
  }

  function measureTextWidth(text, scale = 1) {
    let width = 0;
    for (const char of text) {
      const glyph = MATRIX_GLYPHS[char];
      width += glyph ? (glyph[0].length * scale) + 1 : 2;
    }
    return Math.max(0, width - 1);
  }

  function drawGlyph(ctx, glyph, x, y, color, gridStep = 4, scale = 1) {
    ctx.fillStyle = color;
    glyph.forEach((row, rowIndex) => {
      Array.from(row).forEach((pixel, colIndex) => {
        if (pixel === "1") {
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) {
              drawMatrixDot(
                ctx,
                (x + (colIndex * scale) + sx) * gridStep,
                (y + (rowIndex * scale) + sy) * gridStep,
                color,
                color === "#e5b947" ? "rgba(229,185,71,0.08)" : "rgba(61,243,24,0.06)"
              );
            }
          }
        }
      });
    });
  }

  function drawMatrixDot(ctx, x, y, color, haloColor) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 2, 2);
  }

  function syncPopampToggles() {
    if (state.manifest.skin !== "popamp") return;
    const pl = document.getElementById("popampChipPl");
    const eq = document.getElementById("popampChipEq");
    const shuffle = document.getElementById("popampShuffle");
    const repeat = document.getElementById("popampRepeat");
    if (pl instanceof HTMLInputElement) {
      pl.checked = state.playlistPanelVisible;
    }
    if (eq instanceof HTMLInputElement) {
      eq.checked = state.popampEqPanelVisible;
    }
    if (shuffle instanceof HTMLInputElement) {
      shuffle.checked = state.popampShuffleEnabled;
    }
    if (repeat instanceof HTMLInputElement) {
      repeat.checked = state.popampRepeatEnabled;
    }
  }

  function syncPopampTransportState() {
    if (state.manifest.skin !== "popamp") return;
    const play = document.getElementById("popampPlayButton");
    const pause = document.getElementById("popampPauseButton");
    const stop = document.getElementById("popampStopButton");
    play?.classList.toggle("is-active", state.transportMode === "playing");
    pause?.classList.toggle("is-active", state.transportMode === "paused");
    stop?.classList.remove("is-active");
  }

  function applyEffectivePlayerVolume() {
    if (!state.playerReady || !state.player?.setVolume) return;
    try {
      state.player.setVolume(effectivePlayerVolume());
    } catch (err) {
      console.warn(err);
    }
  }

  function effectivePlayerVolume() {
    const base = Math.max(0, Math.min(100, Number(state.popampVolume) || 0));
    const preamp = Math.max(0, Math.min(100, Number(state.popampPreamp) || 0));
    const multiplier = preamp <= 50
      ? 0.35 + ((preamp / 50) * 0.65)
      : 1 + (((preamp - 50) / 50) * 0.6);
    return Math.max(0, Math.min(100, Math.round(base * multiplier)));
  }

  function syncCassetteVolumeSlider() {
    if (!(els.cassetteVolumeRange instanceof HTMLInputElement)) return;
    els.cassetteVolumeRange.value = String(state.popampVolume);
    els.cassetteVolumeRange.style.setProperty("--volume-progress", `${state.popampVolume}%`);
  }

  function rebuildShuffleRemaining() {
    const trackCount = state.manifest.tracks.length;
    if (trackCount <= 1) {
      state.shuffleRemaining = [];
      return;
    }
    state.shuffleRemaining = [];
    for (let index = 0; index < trackCount; index += 1) {
      if (index !== state.currentIndex) state.shuffleRemaining.push(index);
    }
  }

  function markCurrentTrackAsShuffled() {
    state.shuffleRemaining = state.shuffleRemaining.filter(index => index !== state.currentIndex);
    if (state.popampShuffleEnabled && !state.shuffleRemaining.length) {
      rebuildShuffleRemaining();
    }
  }

  function nextShuffleIndex() {
    const trackCount = state.manifest.tracks.length;
    if (trackCount <= 1) return state.currentIndex;
    if (!state.shuffleRemaining.length) rebuildShuffleRemaining();
    if (!state.shuffleRemaining.length) return state.currentIndex;
    const pick = Math.floor(Math.random() * state.shuffleRemaining.length);
    const [nextIndex] = state.shuffleRemaining.splice(pick, 1);
    return typeof nextIndex === "number" ? nextIndex : state.currentIndex;
  }

  function syncEqualizerSliderColors() {
    document.querySelectorAll(".popamp-fake-range-vertical").forEach(slider => {
      if (slider instanceof HTMLInputElement) syncEqualizerSliderColor(slider);
    });
  }

  function syncEqualizerSliderColor(slider) {
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 100);
    const value = Number(slider.value || 0);
    const range = Math.max(1, max - min);
    const ratio = Math.max(0, Math.min(1, (value - min) / range));

    slider.style.setProperty("--eq-fill-progress", String(ratio));
    const shell = slider.parentElement;
    if (shell instanceof HTMLElement) {
      shell.style.setProperty("--eq-fill-progress", String(ratio));
      const color = eqColorAt(ratio);
      shell.style.setProperty("--eq-fill-color-bottom", color.bottom);
      shell.style.setProperty("--eq-fill-color-mid", color.mid);
      shell.style.setProperty("--eq-fill-color-top", color.top);
    }
  }

  function eqColorAt(ratio) {
    const green = { r: 57, g: 196, b: 37 };
    const yellow = { r: 240, g: 229, b: 72 };
    const red = { r: 255, g: 73, b: 60 };

    let base;
    if (ratio <= 0.5) {
      base = mixColor(green, yellow, ratio / 0.5);
    } else {
      base = mixColor(yellow, red, (ratio - 0.5) / 0.5);
    }

    return {
      bottom: rgbString(base),
      mid: rgbString(mixColor(base, { r: 255, g: 255, b: 255 }, 0.18)),
      top: rgbString(mixColor(base, { r: 0, g: 0, b: 0 }, 0.22))
    };
  }

  function mixColor(from, to, amount) {
    const t = Math.max(0, Math.min(1, amount));
    return {
      r: Math.round(from.r + ((to.r - from.r) * t)),
      g: Math.round(from.g + ((to.g - from.g) * t)),
      b: Math.round(from.b + ((to.b - from.b) * t))
    };
  }

  function rgbString(color) {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }

  /* ── View toggle: playlist ⇄ YouTube video ── */
  function setView(view) {
    state.view = view === "source" ? "source" : "playlist";
    els.app.dataset.view = state.view;
    syncViewToggleChrome();
  }

  function syncViewToggleChrome() {
    if (!els.viewToggle) return;

    if (state.manifest.skin === "popamp") {
      const showingPlaylistVideo = state.popampVideoLocation === "playlist";
      const label = showingPlaylistVideo ? "View Playlist" : "Music Video";
      const iconClass = showingPlaylistVideo ? "fa-list" : "fa-video";

      if (els.viewToggleLabel) els.viewToggleLabel.textContent = label;
      if (els.viewToggleIcon) els.viewToggleIcon.className = `fa-solid ${iconClass}`;
      els.viewToggle.dataset.popampTarget = showingPlaylistVideo ? "playlist" : "video";
      els.viewToggle.setAttribute("aria-label", label);
      return;
    }

    if (state.manifest.skin === "default") {
      if (els.viewToggleLabel) els.viewToggleLabel.textContent = state.view === "source" ? "Tracks" : "Music Video";
      if (els.viewToggleIcon) els.viewToggleIcon.className = `fa-solid ${state.view === "source" ? "fa-list" : "fa-video"}`;
      els.viewToggle.setAttribute("aria-label", state.view === "source" ? "Show tracks" : "Show video");
      return;
    }

    if (els.viewToggleLabel) els.viewToggleLabel.textContent = state.view === "source" ? "Tape Tracks" : "Music Video";
    if (els.viewToggleIcon) els.viewToggleIcon.className = `fa-solid ${state.view === "source" ? "fa-list" : "fa-video"}`;
    els.viewToggle.setAttribute("aria-label", state.view === "source" ? "Show tracks" : "Show music video");
  }

  function toggleView() {
    const nextView = state.view === "source" ? "playlist" : "source";
    if (nextView === "source") trackMixtapeOpenYouTube(currentTrack(), state.currentIndex);
    setView(nextView);
  }

  /* ── Popamp video routing: original top display ⇄ playlist panel ── */
  function setPopampViz(mode) {
    if (state.manifest.skin !== "popamp") return;
    const next = mode === "video" ? "video" : "matrix";
    const changed = state.popampVizMode !== next || state.popampVideoLocation !== "top";

    hidePopampPlaylistVideo();
    state.popampVizMode = next;
    els.app.dataset.popampViz = next;

    syncPopampVideoFrameRect();
    requestAnimationFrame(syncPopampVideoFrameRect);

    if (next === "video" && changed) {
      trackMixtapeOpenYouTube(currentTrack(), state.currentIndex);
    }

    syncViewToggleChrome();
  }

  function showPopampPlaylistVideo(options = {}) {
    if (state.manifest.skin !== "popamp") return;
    const { trackOpen = false } = options;
    const track = currentTrack();

    state.playlistPanelVisible = true;
    state.popampVideoLocation = "playlist";
    state.popampVizMode = "matrix";
    setView("playlist");
    els.app.dataset.playlistVisible = "true";
    els.app.dataset.popampViz = "matrix";
    els.app.dataset.popampPlaylistVideo = "true";

    const mount = document.getElementById("popampPlaylistVideoMount");
    if (mount) mount.setAttribute("aria-hidden", "false");
    mountPopampPlaylistVideoFrame();
    requestAnimationFrame(syncPopampVideoFrameRect);
    syncViewToggleChrome();

    if (state.playerReady && state.player && track.youtubeVideoId) {
      try {
        if (state.loadedVideoId !== track.youtubeVideoId) {
          state.loadedVideoId = track.youtubeVideoId;
          state.position = 0;
          state.duration = track.seconds || 1;
          if (state.player.cueVideoById) {
            state.player.cueVideoById({ videoId: track.youtubeVideoId, startSeconds: 0 });
          }
        }
      } catch (err) {
        console.warn("Popamp playlist video load failed", err);
      }
    }

    if (trackOpen) trackMixtapeOpenYouTube(track, state.currentIndex);
    syncPopampToggles();
    updateUI();
  }

  function togglePopampPlaylistVideoGrid() {
    if (state.manifest.skin !== "popamp") return;
    if (state.popampVideoLocation !== "playlist") return;

    state.popampPlaylistGridHidden = !state.popampPlaylistGridHidden;
    els.app.dataset.popampPlaylistGridHidden = state.popampPlaylistGridHidden ? "true" : "false";
  }

  function togglePopampVideoLocation() {
    if (state.popampVideoLocation === "playlist") {
      setPopampViz("video");
      return;
    }

    if (state.popampVizMode === "video") {
      showPopampPlaylistVideo({ trackOpen: true });
      return;
    }

    setPopampViz("video");
  }

  function togglePopampViz() {
    setPopampViz(state.popampVizMode === "video" ? "matrix" : "video");
  }

  /* ── Helpers ── */
  function ensureTrailingSlash(value) {
    const text = String(value || "").trim() || "/";
    return text.endsWith("/") ? text : `${text}/`;
  }

  function assetPath(path) {
    return new URL(String(path || "").replace(/^\/+/, ""), window.location.origin + ASSET_BASE).toString();
  }

  function visibleTrackTitle(track, index) {
    const visible = isTrackVisible(index);
    if (!visible) return `Track ${String(index + 1).padStart(2, "0")}`;
    return track.displayTitle || `${track.artist} - ${track.title}`;
  }

  function trackDisplay(track, index) {
    const visible = isTrackVisible(index);
    if (!visible) return { title: "?????", artist: "Hidden until the tape plays", duration: "--:--" };
    return { title: track.title, artist: track.artist, duration: track.duration || formatTime(track.seconds) };
  }

  function isTrackVisible(index) {
    return !state.manifest.mysteryMode || state.revealed.has(index);
  }

  function mixtapeProgress() {
    const tracks = state.manifest.tracks || [];
    if (!tracks.length) return 0;

    const elapsedBeforeCurrent = tracks
      .slice(0, state.currentIndex)
      .reduce((sum, track) => sum + Math.max(0, Number(track.seconds) || 0), 0);

    const currentElapsed = Math.max(0, Math.min(Number(state.position) || 0, Math.max(1, Number(state.duration || currentTrack().seconds || 1))));
    const totalDuration = tracks.reduce((sum, track) => sum + Math.max(0, Number(track.seconds) || 0), 0);

    if (totalDuration <= 0) return 0;
    return Math.max(0, Math.min(1, (elapsedBeforeCurrent + currentElapsed) / totalDuration));
  }

  function normalizeSeconds(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return n > 1000 ? Math.round(n / 1000) : Math.round(n);
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  /* Status text UI was removed with the header; kept as a no-op so the
     YouTube callbacks don't need to special-case it. */
  function setStatus() {}

  function getAudioContext() {
    if (state.audioContext) return state.audioContext;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    state.audioContext = new AudioContextCtor();
    return state.audioContext;
  }

  function unlockAudio() {
    const context = getAudioContext();
    if (!context) return;

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    state.audioUnlocked = context.state === "running" || context.state === "interrupted";
  }

  function playButtonClickSound(kind = "transport") {
    const context = getAudioContext();
    if (!context || context.state !== "running") return;
    const start = context.currentTime + 0.002;

    if (kind === "main") {
      playNoiseBurst(context, start, 0.028, 0.05, 1800);
      playTone(context, start, 220, 0.035, "square", 0.018);
      playTone(context, start + 0.018, 140, 0.05, "triangle", 0.02);
      return;
    }

    if (kind === "light") {
      playNoiseBurst(context, start, 0.018, 0.022, 2200);
      playTone(context, start, 260, 0.022, "triangle", 0.01);
      return;
    }

    playNoiseBurst(context, start, 0.022, 0.03, 2000);
    playTone(context, start, 190, 0.028, "square", 0.012);
    playTone(context, start + 0.014, 124, 0.04, "triangle", 0.014);
  }

  function playTone(context, start, frequency, duration, type, volume) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.7), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  function playNoiseBurst(context, start, duration, volume, lowpassFrequency) {
    const noise = context.createBufferSource();
    noise.buffer = createNoiseBuffer(context);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lowpassFrequency, start);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    noise.start(start);
    noise.stop(start + duration + 0.01);
  }

  function createNoiseBuffer(context) {
    const length = Math.max(1, Math.floor(context.sampleRate * 0.08));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    return buffer;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
})();
