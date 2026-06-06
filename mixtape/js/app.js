(() => {
  const DEFAULT_MANIFEST = window.MIXTAPE_DEMO || {};
  const ENDPOINT = window.MIXTAPE_ENDPOINT || "";
  const MIXTAPE_ROUTE_PREFIX = "/mixtape/";
  const APP_STORE_URL = window.LOLLIPOP_APP_STORE_URL || "https://apps.apple.com/us/charts/iphone";
  const TEMPLATE_PATHS = {
    popamp: "./skins/popamp.html",
    popampTrackCard: "./skins/popamp-track-card.html",
    cassetteShell: "./skins/cassette-shell.html",
    cassetteControls: "./skins/cassette-controls.html",
    cassetteDoor: "./skins/cassette-door.html",
    cassetteTrackCard: "./skins/cassette-track-card.html",
    missingMixtape: "./skins/missing-mixtape.html"
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
    viewToggleLabel: document.getElementById("viewToggleLabel")
  };

  const state = {
    manifest:      normalizeManifest(DEFAULT_MANIFEST),
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
    popampVolume: 72,
    popampPreamp: 70,
    popampBalance: 50,
    popampShuffleEnabled: false,
    popampRepeatEnabled: true,
    shuffleRemaining: []
  };

  window.onYouTubeIframeAPIReady = () => {
    state.ytApiReady = true;
    createYouTubePlayer();
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const loadResult = await maybeLoadManifest();
    if (!loadResult.ok) return;
    document.title = state.manifest.title;
    applySkin();
    bindEvents();
    await renderPlayerVisual();
    renderTrackList();
    setView("playlist");
    updateUI();
    syncEqualizerSliderColors();
    if (window.YT?.Player) {
      state.ytApiReady = true;
      createYouTubePlayer();
    }
    startTimer();
  }

  async function maybeLoadManifest() {
    const source = resolveManifestSource();
    if (!source) return { ok: true, source: "demo" };

    try {
      const response = await fetch(source.url, { credentials: "same-origin" });

      if (!response.ok) {
        if (source.kind === "config") {
          await renderMissingMixtapePage(source.slug);
          return { ok: false, source: "missing-config" };
        }
        throw new Error(`Manifest fetch failed: ${response.status}`);
      }

      const payload = await response.json();

      if (source.kind === "config") {
        const manifest = manifestFromConfig(payload, source.slug);
        if (!manifest) {
          await renderMissingMixtapePage(source.slug);
          return { ok: false, source: "missing-mixtape-section" };
        }
        state.manifest = normalizeManifest(manifest);
        return { ok: true, source: "config" };
      }

      state.manifest = normalizeManifest(payload);
      return { ok: true, source: "endpoint" };
    } catch (err) {
      if (source.kind === "config") {
        console.warn("Unable to load mixtape config.", err);
        await renderMissingMixtapePage(source.slug);
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

    const slug = slugFromLocation(window.location.pathname);
    if (!slug) return null;

    return {
      kind: "config",
      slug,
      url: new URL(`/configs/${slug}.json`, window.location.origin).toString()
    };
  }

  function slugFromLocation(pathname) {
    const value = String(pathname || "");
    if (!value.startsWith(MIXTAPE_ROUTE_PREFIX)) return "";

    const slug = value.slice(MIXTAPE_ROUTE_PREFIX.length).split("/")[0];
    return sanitizeSlug(slug);
  }

  function sanitizeSlug(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-z0-9_-]/gi, "");
  }

  function manifestFromConfig(config, slug) {
    const sections = Array.isArray(config?.section) ? config.section : [];
    const mixtapeSection = sections.find(section => section?.id === "section_mixtape");
    if (!mixtapeSection) return null;

    const fields = Array.isArray(mixtapeSection.fields) ? mixtapeSection.fields : [];
    const title = String(fields[0]?.value || "").trim() || humanizeSlug(slug) || "Untitled MixTape";
    const rawTracks = Array.isArray(fields[1]?.value) ? fields[1].value : [];

    return {
      id: slug || "mixtape",
      title,
      skin: fields[5]?.value || "cassette",
      mysteryMode: fields[6]?.value !== false,
      theme: {
        backgroundColor: normalizeThemeColor(fields[2]?.value),
        textColor: normalizeThemeColor(fields[3]?.value)
      },
      tracks: rawTracks
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

  async function renderMissingMixtapePage(slug) {
    const displaySlug = humanizeSlug(slug) || "This Mixtape";
    document.title = `${displaySlug} Not Found`;

    els.app.dataset.skin = "missing";
    els.app.dataset.view = "playlist";
    const view = await instantiateTemplate(TEMPLATE_PATHS.missingMixtape);
    if (!view) {
      els.app.replaceChildren(buildMissingMixtapeFallback(displaySlug));
      return;
    }

    const title = view.querySelector("#missingMixtapeTitle");
    const appStoreLink = view.querySelector('[data-role="app-store-link"]');
    if (title) title.textContent = `${displaySlug} is not live yet.`;
    if (appStoreLink instanceof HTMLAnchorElement) appStoreLink.href = APP_STORE_URL;
    els.app.replaceChildren(view);
  }

  function buildMissingMixtapeFallback(displaySlug) {
    const main = document.createElement("main");
    main.className = "app-content missing-mixtape-shell";

    const card = document.createElement("section");
    card.className = "missing-mixtape-card";
    card.setAttribute("aria-labelledby", "missingMixtapeTitle");

    const kicker = document.createElement("p");
    kicker.className = "missing-mixtape-kicker";
    kicker.textContent = "Mixtape Not Found";

    const title = document.createElement("h1");
    title.id = "missingMixtapeTitle";
    title.textContent = `${displaySlug} is not live yet.`;

    const copy = document.createElement("p");
    copy.className = "missing-mixtape-copy";
    copy.textContent = "Build your own mixtape in Lollipop, publish it to your link, and share a page that feels like a real collectible.";

    const actions = document.createElement("div");
    actions.className = "missing-mixtape-actions";

    const appStoreLink = document.createElement("a");
    appStoreLink.className = "missing-mixtape-button primary";
    appStoreLink.href = APP_STORE_URL;
    appStoreLink.textContent = "Download The App";

    const mixtapeLink = document.createElement("a");
    mixtapeLink.className = "missing-mixtape-button secondary";
    mixtapeLink.href = "https://lollipop.gg/";
    mixtapeLink.textContent = "Make Your Own Mixtape";

    actions.append(appStoreLink, mixtapeLink);
    card.append(kicker, title, copy, actions);
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

  /* ── Events ── */
  function bindEvents() {
    els.cassetteVisual.closest(".visual-stage")?.addEventListener("click", handleCassetteVisualClick);
    bindPrimaryControls();

    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.classList.contains("popamp-fake-range-vertical")) {
        if (target.id === "popampPreampRange") {
          state.popampPreamp = Math.max(0, Math.min(100, Number(target.value) || 0));
          applyEffectivePlayerVolume();
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

    els.viewToggle.addEventListener("click", () => {
      playButtonClickSound("light");
      toggleView();
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.id === "popampChipPl") {
        state.playlistPanelVisible = target.checked;
        updateUI();
        return;
      }

      if (target.id === "popampChipEq") {
        state.playlistPanelVisible = true;
        setView(target.checked ? "playlist" : "source");
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
  }

  function bindPrimaryControls() {
    if (els.playButton && els.playButton.dataset.bound !== "true") {
      els.playButton.addEventListener("click", press(els.playButton, togglePlayback));
      els.playButton.dataset.bound = "true";
    }

    if (els.nextButton && els.nextButton.dataset.bound !== "true") {
      els.nextButton.addEventListener("click", press(els.nextButton, () => nextTrack(true)));
      els.nextButton.dataset.bound = "true";
    }

    if (els.prevButton && els.prevButton.dataset.bound !== "true") {
      els.prevButton.addEventListener("click", press(els.prevButton, () => prevTrack(true)));
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

  function normalizeSkin(value) {
    const skin = String(value || "").toLowerCase();
    if (skin === "popamp") return "popamp";
    if (skin === "cassette") return "cassette";
    return "default";
  }

  function applySkin() {
    els.app.dataset.skin = state.manifest.skin;
    applyDefaultTheme();
  }

  function applyDefaultTheme() {
    const backgroundColor = state.manifest?.theme?.backgroundColor || "#4b4b4b";
    const textColor = state.manifest?.theme?.textColor || "#f2f2f2";
    els.app.style.setProperty("--default-player-bg", backgroundColor);
    els.app.style.setProperty("--default-player-text", textColor);
    els.app.style.setProperty("--default-player-muted", colorWithAlpha(textColor, 0.58));
    els.app.style.setProperty("--default-player-soft", colorWithAlpha(textColor, 0.42));
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
    if (!state.ytApiReady || state.player || !window.YT?.Player) return;
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
    if (equalizerToggle instanceof HTMLInputElement) equalizerToggle.checked = state.view !== "source";
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
  }

  function bindPopampTransportControls() {
    const prev = document.getElementById("popampPrevButton");
    const play = document.getElementById("popampPlayButton");
    const pause = document.getElementById("popampPauseButton");
    const stop = document.getElementById("popampStopButton");
    const next = document.getElementById("popampNextButton");
    const eject = document.getElementById("popampEjectButton");

    prev?.addEventListener("click", press(prev, () => prevTrack(true)));
    play?.addEventListener("click", press(play, playCurrent));
    pause?.addEventListener("click", press(pause, pausePlayback));
    stop?.addEventListener("click", press(stop, stopPlayback));
    next?.addEventListener("click", press(next, () => nextTrack(true)));
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
  }

  function restoreDefaultTrackCard() {
    const trackCard = document.querySelector(".track-card");
    if (!trackCard || !defaultTrackCardNodes.length) return;
    trackCard.replaceChildren(...defaultTrackCardNodes.map(node => node.cloneNode(true)));
  }

  function mountPopampSourceFrame() {
    const frame = document.querySelector(".youtube-frame");
    const jcard = document.querySelector(".track-card .jcard");
    if (frame && jcard && frame.parentElement !== jcard) {
      jcard.appendChild(frame);
    }
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
        selectTrack(Number(row.dataset.index), true);
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
        selectTrack(Number(row.dataset.index), true);
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

  function playCurrent() {
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
    else playCurrent();
  }

  function handleTrackEnded() {
    if (state.popampRepeatEnabled) {
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

  function nextTrack(shouldPlay = true) {
    if (state.popampShuffleEnabled) {
      selectTrack(nextShuffleIndex(), shouldPlay);
      return;
    }
    selectTrack(state.currentIndex + 1, shouldPlay);
  }

  function prevTrack(shouldPlay = true) {
    /* Restart current track if more than 4 seconds in; otherwise go back */
    selectTrack(state.position > 4 ? state.currentIndex : state.currentIndex - 1, shouldPlay);
  }

  function selectTrack(index, shouldPlay = true) {
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
    if (shouldPlay) playCurrent();
    else cueCurrent();
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
    state.revealed.add(index);
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
    syncPopampTransportState();
    updatePopampDisplay();
    syncPopampToggles();
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
        buffering: isBuffering
      });
    }
  }

  function drawPopampMatrix(canvas, { mode, position, playing, buffering }) {
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
      eq.checked = state.view !== "source";
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
    if (state.manifest.skin === "popamp") {
      els.viewToggleLabel.textContent = state.view === "source" ? "Playlist" : "Video";
      els.viewToggle?.setAttribute("aria-label", state.view === "source" ? "Show playlist" : "Show video");
      return;
    }
    if (state.manifest.skin === "default") {
      els.viewToggleLabel.textContent = state.view === "source" ? "Tracks" : "Video";
      els.viewToggle?.setAttribute("aria-label", state.view === "source" ? "Show tracks" : "Show video");
      return;
    }
    els.viewToggleLabel.textContent = state.view === "source" ? "Tape Tracks" : "Music Video";
    els.viewToggle?.setAttribute("aria-label", state.view === "source" ? "Show tracks" : "Show music video");
  }

  function toggleView() {
    setView(state.view === "source" ? "playlist" : "source");
  }

  /* ── Helpers ── */
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
