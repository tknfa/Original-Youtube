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
  ];
  let mediaListPromise = null;
  const unsupportedMedia = new Set();
  const SUPPORTS_HAS = (() => {
    try {
      return CSS.supports("selector(:has(*))");
    } catch (error) {
      return false;
    }
  })();

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

  function getMediaList() {
    if (!mediaListPromise) {
      mediaListPromise = fetch(
        chrome.runtime.getURL("assets/gifs/manifest.json")
      )
        .then((response) => (response.ok ? response.json() : { gifs: [] }))
        .then((data) => {
          const list = Array.isArray(data.media)
            ? data.media
            : Array.isArray(data.gifs)
            ? data.gifs
            : [];
          return list;
        })
        .catch(() => []);
    }
    return mediaListPromise;
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
