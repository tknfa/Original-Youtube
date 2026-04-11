(() => {
  const state = {
    initialized: false,
    observer: null,
    scheduled: false,
  };

  const REMOVE_SELECTORS = [
    // Shorts shelves and sections
    "ytd-reel-shelf-renderer",
    "ytd-shorts-shelf-renderer",
    "ytd-rich-section-renderer[is-shorts]",
    "ytd-rich-item-renderer ytd-reel-item-renderer",

    // Community posts and non-video sections
    "ytd-post-renderer",

    // Playables
    "ytd-playable-card-renderer",
    "ytd-game-card-renderer",

    // Ask for videos (beta prompt module)
    "ytd-feed-nudge-renderer",
    "ytd-text-prompt-renderer",
  ];

  const AD_REPLACE_SELECTORS = [
    "ytd-ad-slot-renderer",
    "ytd-display-ad-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-promoted-video-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-search-pyv-renderer",
  ];

  const AD_REMOVE_SELECTORS = [
    "ytd-banner-promo-renderer",
    "ytd-masthead-ad-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-companion-slot-renderer",
  ];

  const HAS_SELECTORS = [
    "ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)",
    "ytd-rich-section-renderer:has(ytd-shorts-shelf-renderer)",
    "ytd-rich-section-renderer:has(ytd-post-renderer)",
    "ytd-rich-item-renderer:has(ytd-reel-item-renderer)",
  ];

  const SPONSORED_BADGE_REGEX = /\b(sponsored|promotion|promoted|ad|ads)\b/i;
  const BANNED_SECTION_TITLES = new Set([
    "shorts",
    "youtube playables",
    "playables",
    "ask for videos any way you like",
  ]);
  const BANNED_SECTION_TEXT = [
    "ask for videos any way you like",
    "ask in your own words",
    "youtube featured",
  ];
  const FEATURED_PROMO_TEXT = [
    "youtube featured",
    "dress for the fest",
  ];
  const DEFAULT_THEME = "light";
  let mediaManifestPromise = null;
  const unsupportedMedia = new Set();
  const SUPPORTS_HAS = (() => {
    try {
      return CSS.supports("selector(:has(*))");
    } catch (error) {
      return false;
    }
  })();

  function getClassicBlue() {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--classic-link-active")
      .trim();
    return value || "#065fd4";
  }

  function getHomeBrowse() {
    return (
      document.querySelector('ytd-browse[page-subtype="home"]') ||
      document.querySelector('ytd-browse[page-subtype="feed"]')
    );
  }

  function applyTheme(theme) {
    const normalized = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-classic-theme", normalized);
    if (state.initialized) {
      scheduleApply();
    }
  }

  function initTheme() {
    chrome.storage.sync.get({ classicTheme: DEFAULT_THEME }, (data) => {
      applyTheme(data.classicTheme || DEFAULT_THEME);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      if (changes.classicTheme) {
        applyTheme(changes.classicTheme.newValue || DEFAULT_THEME);
      }
    });
  }

  function removeBySelectors() {
    REMOVE_SELECTORS.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          const container =
            selector === "ytd-rich-item-renderer ytd-reel-item-renderer"
              ? el.closest("ytd-rich-item-renderer")
              : el;
          if (container) container.remove();
        });
      } catch (error) {
        // Skip invalid selector on older engines.
      }
    });

    AD_REMOVE_SELECTORS.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((el) => el.remove());
      } catch (error) {
        // Skip invalid selector on older engines.
      }
    });

    if (SUPPORTS_HAS) {
      HAS_SELECTORS.forEach((selector) => {
        try {
          document.querySelectorAll(selector).forEach((el) => el.remove());
        } catch (error) {
          // Skip invalid selector on older engines.
        }
      });
    }
  }

  function getMediaManifest() {
    if (!mediaManifestPromise) {
      mediaManifestPromise = fetch(
        chrome.runtime.getURL("assets/gifs/manifest.json")
      )
        .then((response) => (response.ok ? response.json() : {}))
        .catch(() => ({}));
    }
    return mediaManifestPromise;
  }

  function getMediaList() {
    return getMediaManifest().then((data) => {
      const list = Array.isArray(data.media)
        ? data.media
        : Array.isArray(data.gifs)
        ? data.gifs
        : [];
      return list;
    });
  }

  function getLogoFile() {
    return getMediaManifest().then((data) =>
      typeof data.logo === "string" ? data.logo : null
    );
  }

  function pickRandomMedia(mediaList) {
    if (!mediaList || mediaList.length === 0) return null;
    const index = Math.floor(Math.random() * mediaList.length);
    return mediaList[index];
  }

  function isProbablyPlayable(fileName) {
    const extension = (fileName.split(".").pop() || "").toLowerCase();
    if (["gif", "png", "jpg", "jpeg", "webp"].includes(extension)) return true;
    if (["mp4", "m4v", "webm", "ogg"].includes(extension)) {
      const video = document.createElement("video");
      const mime =
        extension === "webm"
          ? "video/webm"
          : extension === "ogg"
          ? "video/ogg"
          : "video/mp4";
      return video.canPlayType(mime) !== "";
    }
    return false;
  }

  function createMediaElement(mediaUrl, mediaFile, mediaList, container) {
    const isVideo = /\.(mp4|m4v|webm|ogg)$/i.test(mediaUrl);
    if (isVideo) {
      const video = document.createElement("video");
      video.src = mediaUrl;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", "Classic filler video");
      video.addEventListener(
        "canplay",
        () => {
          video.play().catch(() => {});
        },
        { once: true }
      );
      video.addEventListener(
        "error",
        () => {
          unsupportedMedia.add(mediaFile);
          renderMediaInContainer(container, mediaList);
        },
        { once: true }
      );
      return video;
    }

    const img = document.createElement("img");
    img.src = mediaUrl;
    img.alt = "Classic filler";
    img.loading = "lazy";
    return img;
  }

  function renderMediaInContainer(container, mediaList) {
    if (!container || !container.isConnected) return;
    const candidates = mediaList.filter(
      (file) => !unsupportedMedia.has(file) && isProbablyPlayable(file)
    );
    if (candidates.length === 0) {
      container.remove();
      return;
    }

    const mediaFile = pickRandomMedia(candidates);
    if (!mediaFile) {
      container.remove();
      return;
    }

    const mediaUrl = chrome.runtime.getURL(`assets/gifs/${mediaFile}`);
    container.dataset.classicGifReplaced = "true";
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "classic-gif-slot";

    const mediaElement = createMediaElement(
      mediaUrl,
      mediaFile,
      mediaList,
      container
    );
    wrapper.appendChild(mediaElement);
    container.appendChild(wrapper);
  }

  function replaceAdModulesWithGifs() {
    return getMediaList().then((mediaList) => {
      const adSelector = AD_REPLACE_SELECTORS.join(",");
      const adNodes = document.querySelectorAll(adSelector);

      adNodes.forEach((adNode) => {
        const container =
          adNode.closest(
            "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-playlist-renderer"
          ) || adNode;

        if (!container || container.dataset.classicGifReplaced === "true") {
          return;
        }

        if (!mediaList || mediaList.length === 0) {
          container.remove();
          return;
        }

        renderMediaInContainer(container, mediaList);
      });
    });
  }

  function forceBlueText() {
    const blue = getClassicBlue();
    const hostSelector =
      "ytd-rich-grid-media, ytd-rich-grid-slim-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer";
    const textSelector =
      "#video-title, #video-title-link, #metadata-line, #byline, #meta, yt-formatted-string";

    document.querySelectorAll(hostSelector).forEach((host) => {
      host.style.setProperty("--yt-spec-text-primary", blue, "important");
      host.style.setProperty("--yt-spec-text-secondary", blue, "important");
      host.style.setProperty("--yt-endpoint-color", blue, "important");
      host.style.setProperty("--yt-endpoint-visited-color", blue, "important");
      host.style.setProperty("--yt-spec-link-primary", blue, "important");
      host.style.setProperty("color", blue, "important");

      host.querySelectorAll(textSelector).forEach((el) => {
        el.style.setProperty("color", blue, "important");
      });

      if (host.shadowRoot) {
        host.shadowRoot.querySelectorAll(textSelector).forEach((el) => {
          el.style.setProperty("color", blue, "important");
        });
      }
    });
  }

  function forceSquareHomeThumbnails() {
    const browse = getHomeBrowse();
    if (!browse) return;

    const applySquareCorners = (node, { clip = false, overflow = false } = {}) => {
      [
        "border-radius",
        "border-start-start-radius",
        "border-start-end-radius",
        "border-end-start-radius",
        "border-end-end-radius",
      ].forEach((property) => {
        node.style.setProperty(property, "0", "important");
      });

      if (overflow) {
        node.style.setProperty("overflow", "hidden", "important");
      }

      if (clip) {
        node.style.setProperty("clip-path", "inset(0 round 0px)", "important");
        node.style.setProperty("-webkit-mask-image", "none", "important");
        node.style.setProperty("mask-image", "none", "important");
      }
    };

    const hosts = browse.querySelectorAll(
      [
        "ytd-thumbnail",
        "ytd-thumbnail-view-model",
        "a#thumbnail",
        "#thumbnail",
        "#thumbnail-container",
        "yt-image",
        "yt-img-shadow",
        "yt-core-image",
        "ytd-thumbnail-overlay-time-status-renderer",
      ].join(", ")
    );

    const childSelector = [
      "#thumbnail",
      "#thumbnail-container",
      "img",
      "yt-image",
      "yt-image img",
      "yt-img-shadow",
      "yt-img-shadow img",
      "yt-core-image",
      "yt-core-image img",
      "img.yt-core-image",
      "img.yt-core-image--fill-parent-height",
      "ytd-thumbnail-overlay-time-status-renderer",
    ].join(", ");

    hosts.forEach((host) => {
      [
        "--yt-border-radius-large",
        "--yt-border-radius-medium",
        "--yt-border-radius-small",
        "--ytd-thumbnail-border-radius",
        "--ytd-grid-thumbnail-border-radius",
      ].forEach((variable) => {
        host.style.setProperty(variable, "0px", "important");
      });

      applySquareCorners(host, { clip: true, overflow: true });

      host.querySelectorAll(childSelector).forEach((child) => {
        applySquareCorners(child, { clip: true });
      });

      if (host.shadowRoot) {
        host.shadowRoot.querySelectorAll(childSelector).forEach((child) => {
          applySquareCorners(child, { clip: true });
        });
      }
    });

    browse
      .querySelectorAll(
        [
          "a#thumbnail",
          "a#thumbnail #thumbnail",
          "a#thumbnail #thumbnail-container",
          "a#thumbnail img",
          "a#thumbnail yt-image",
          "a#thumbnail yt-image img",
          "a#thumbnail yt-img-shadow",
          "a#thumbnail yt-img-shadow img",
          "a#thumbnail yt-core-image",
          "a#thumbnail yt-core-image img",
        ].join(", ")
      )
      .forEach((node) => {
        applySquareCorners(node, {
          clip: node.tagName !== "A",
          overflow: node.tagName === "A",
        });
      });
  }

  function restoreRoundHomeAvatars() {
    const browse = getHomeBrowse();
    if (!browse) return;

    browse
      .querySelectorAll(
        [
          "ytd-channel-thumbnail-with-link-renderer img",
          "ytd-channel-thumbnail-with-link-renderer yt-img-shadow",
          "ytd-channel-thumbnail-with-link-renderer yt-image img",
          "ytd-video-owner-renderer img",
          "ytd-guide-entry-renderer img",
        ].join(", ")
      )
      .forEach((node) => {
        node.style.setProperty("border-radius", "9999px", "important");
        node.style.setProperty("border-start-start-radius", "9999px", "important");
        node.style.setProperty("border-start-end-radius", "9999px", "important");
        node.style.setProperty("border-end-start-radius", "9999px", "important");
        node.style.setProperty("border-end-end-radius", "9999px", "important");
        node.style.setProperty("clip-path", "none", "important");
      });
  }

  function removeShelvesByTitle() {
    const candidates = document.querySelectorAll(
      "ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytd-rich-shelf-renderer, ytd-shelf-renderer, ytd-item-section-renderer"
    );

    candidates.forEach((el) => {
      const title =
        el.querySelector("#title-container #title") ||
        el.querySelector("#title") ||
        el.querySelector("#title-text") ||
        el.querySelector("h3") ||
        el.querySelector("yt-formatted-string");
      const text = (title?.textContent || "").trim().toLowerCase();
      if (!BANNED_SECTION_TITLES.has(text)) return;

      const container = el.closest("ytd-rich-section-renderer") || el;
      container.remove();
    });
  }

  function removeAskForVideosModule() {
    // Remove by placeholder or text snippets unique to the module.
    document
      .querySelectorAll('input[placeholder*="Ask in your own words"]')
      .forEach((input) => {
        const container = input.closest(
          "ytd-rich-section-renderer, ytd-item-section-renderer, ytd-rich-shelf-renderer, ytd-shelf-renderer, ytd-rich-item-renderer"
        );
        if (container) container.remove();
      });

    // Remove by scanning visible text within likely modules.
    const candidates = document.querySelectorAll(
      "ytd-rich-section-renderer, ytd-item-section-renderer, ytd-rich-shelf-renderer, ytd-shelf-renderer, ytd-rich-item-renderer, ytd-horizontal-card-list-renderer, ytd-feed-nudge-renderer"
    );

    candidates.forEach((el) => {
      const text = (el.textContent || "").toLowerCase();
      const matches = BANNED_SECTION_TEXT.some((phrase) => text.includes(phrase));
      if (!matches) return;
      el.remove();
    });
  }

  function ensureRecommendedBar() {
    const browse = getHomeBrowse();
    if (!browse) return;

    const grid = browse.querySelector("ytd-rich-grid-renderer");
    if (!grid) return;
    const contents = grid.querySelector("#contents");
    if (!contents) return;

    let bar = grid.querySelector(":scope > .classic-recommended-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "classic-recommended-bar";
      bar.textContent = "Recommended";
      grid.insertBefore(bar, contents);
    }

    bar.textContent = "Recommended";
    bar.style.setProperty("display", "flex", "important");
    bar.style.setProperty("align-items", "center", "important");
    bar.style.setProperty("height", "42px", "important");
    bar.style.setProperty("padding", "0 16px", "important");
    bar.style.setProperty("margin", "0 0 16px", "important");
    bar.style.setProperty("font-family", "Arial, Helvetica, sans-serif", "important");
    bar.style.setProperty("font-size", "14px", "important");
    bar.style.setProperty("font-weight", "700", "important");
    bar.style.setProperty("border", "1px solid #d8d8d8", "important");
    bar.style.setProperty("box-sizing", "border-box", "important");
    bar.style.setProperty(
      "background",
      document.documentElement.getAttribute("data-classic-theme") === "dark"
        ? "#111111"
        : "#ffffff",
      "important"
    );
    bar.style.setProperty(
      "color",
      document.documentElement.getAttribute("data-classic-theme") === "dark"
        ? "#ffffff"
        : "#111111",
      "important"
    );
  }

  function removeRichGridHeaderBar() {
    const grid = document.querySelector("ytd-rich-grid-renderer");
    if (!grid) return;

    const header =
      grid.querySelector("#header") || grid.querySelector("#header-container");
    if (header) header.remove();
  }

  function pruneHomeGridChrome() {
    const browse = getHomeBrowse();
    if (!browse) return;

    const grid = browse.querySelector("ytd-rich-grid-renderer");
    if (!grid) return;

    [...grid.children].forEach((child) => {
      if (
        child.id === "contents" ||
        child.classList.contains("classic-recommended-bar")
      ) {
        return;
      }

      child.remove();
    });
  }

  function stripLeadingHomeSections() {
    const browse = getHomeBrowse();
    if (!browse) return;

    const contents = browse.querySelector("ytd-rich-grid-renderer #contents");
    if (!contents) return;

    const children = [...contents.children];

    for (const child of children) {
      const isVideoRow =
        child.matches("ytd-rich-item-renderer, ytd-rich-grid-row") ||
        Boolean(
          child.querySelector(
            "ytd-rich-item-renderer, ytd-rich-grid-media, ytd-rich-grid-slim-media"
          )
        );

      if (isVideoRow) {
        break;
      }

      child.remove();
    }
  }

  function removeFeaturedPopups() {
    const candidates = document.querySelectorAll(
      [
        "ytd-rich-section-renderer",
        "ytd-rich-item-renderer",
        "ytd-rich-shelf-renderer",
        "ytd-item-section-renderer",
        "ytd-banner-promo-renderer",
        "ytd-feed-nudge-renderer",
        "ytd-statement-banner-renderer",
        "ytd-brand-video-singleton-renderer",
        "ytd-brand-video-shelf-renderer",
      ].join(", ")
    );

    candidates.forEach((candidate) => {
      const text = (candidate.textContent || "").toLowerCase();
      if (!FEATURED_PROMO_TEXT.some((phrase) => text.includes(phrase))) {
        return;
      }

      candidate.remove();
    });

    document
      .querySelectorAll("yt-formatted-string, span, a, button")
      .forEach((node) => {
        const text = (node.textContent || "").trim().toLowerCase();
        if (!FEATURED_PROMO_TEXT.some((phrase) => text.includes(phrase))) {
          return;
        }

        const container = node.closest(
          [
            "ytd-rich-section-renderer",
            "ytd-rich-item-renderer",
            "ytd-rich-shelf-renderer",
            "ytd-item-section-renderer",
            "ytd-banner-promo-renderer",
            "ytd-feed-nudge-renderer",
            "ytd-statement-banner-renderer",
            "ytd-brand-video-singleton-renderer",
            "ytd-brand-video-shelf-renderer",
            "#dismissible",
          ].join(", ")
        );

        if (container) {
          container.remove();
        }
      });
  }

  function ensureClassicLogo() {
    const logoLink = document.querySelector("ytd-topbar-logo-renderer a#logo");
    if (!logoLink) return;
    const hasCustomLogo = logoLink.querySelector(".classic-logo-image, .classic-logo");
    const customChildCount = [...logoLink.children].filter(
      (child) =>
        child.classList.contains("classic-logo-image") ||
        child.classList.contains("classic-logo")
    ).length;
    const hasOnlyCustomLogo =
      hasCustomLogo &&
      [...logoLink.children].every((child) =>
        child.classList.contains("classic-logo-image") ||
        child.classList.contains("classic-logo")
      );

    if (
      logoLink.dataset.classicLogoApplied === "true" &&
      hasOnlyCustomLogo &&
      customChildCount === 1
    ) {
      return;
    }

    if (logoLink.dataset.classicLogoPending === "true") {
      return;
    }

    logoLink.dataset.classicLogoApplied = "true";
    logoLink.dataset.classicLogoPending = "true";
    logoLink.replaceChildren();

    getLogoFile().then((logoFile) => {
      if (!logoLink.isConnected) {
        return;
      }

      if (logoFile) {
        const logoUrl = chrome.runtime.getURL(`assets/gifs/${logoFile}`);
        const img = document.createElement("img");
        img.className = "classic-logo-image";
        img.alt = "YouTube";
        img.addEventListener(
          "load",
          () => {
            logoLink.dataset.classicLogoPending = "false";
          },
          { once: true }
        );
        img.addEventListener(
          "error",
          () => {
            img.remove();
            logoLink.dataset.classicLogoPending = "false";
            injectTextLogo(logoLink);
          },
          { once: true }
        );
        img.src = logoUrl;
        logoLink.replaceChildren(img);
        return;
      }

      logoLink.dataset.classicLogoPending = "false";
      injectTextLogo(logoLink);
    });
  }

  function injectTextLogo(logoLink) {
    if (!logoLink || logoLink.querySelector(".classic-logo")) return;
    const classic = document.createElement("span");
    classic.className = "classic-logo";
    const you = document.createElement("span");
    you.className = "classic-logo-you";
    you.textContent = "You";
    const tube = document.createElement("span");
    tube.className = "classic-logo-tube";
    tube.textContent = "Tube";
    classic.appendChild(you);
    classic.appendChild(tube);
    logoLink.appendChild(classic);
  }

  function removeShortsNavEntries() {
    document
      .querySelectorAll(
        'ytd-guide-entry-renderer a[href^="/shorts"], ytd-mini-guide-entry-renderer a[href^="/shorts"]'
      )
      .forEach((link) => {
        const entry =
          link.closest("ytd-guide-entry-renderer") ||
          link.closest("ytd-mini-guide-entry-renderer");
        if (entry) entry.remove();
      });
  }

  function removeSponsoredByBadges() {
    const badges = document.querySelectorAll(
      "ytd-badge-supported-renderer, ytd-ad-badge-supported-renderer, ytd-badge-renderer, #ad-badge, #badge"
    );

    badges.forEach((badge) => {
      const text = (badge.textContent || "").trim();
      if (!SPONSORED_BADGE_REGEX.test(text)) return;

      const card = badge.closest(
        "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-playlist-renderer"
      );

      if (card) card.remove();
    });
  }

  function applyClassicMode() {
    removeBySelectors();
    replaceAdModulesWithGifs();
    removeFeaturedPopups();
    removeRichGridHeaderBar();
    ensureRecommendedBar();
    pruneHomeGridChrome();
    stripLeadingHomeSections();
    ensureClassicLogo();
    forceBlueText();
    forceSquareHomeThumbnails();
    restoreRoundHomeAvatars();
    removeShelvesByTitle();
    removeAskForVideosModule();
    removeShortsNavEntries();
    removeSponsoredByBadges();
  }

  function scheduleApply() {
    if (state.scheduled) return;
    state.scheduled = true;

    requestAnimationFrame(() => {
      state.scheduled = false;
      applyClassicMode();
    });
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    initTheme();
    scheduleApply();

    state.observer = new MutationObserver(scheduleApply);

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("yt-navigate-finish", scheduleApply);
    window.addEventListener("yt-page-data-updated", scheduleApply);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
