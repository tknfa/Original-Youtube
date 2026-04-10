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

    // Ad containers / promos
    "ytd-ad-slot-renderer",
    "ytd-display-ad-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-promoted-video-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-search-pyv-renderer",
    "ytd-banner-promo-renderer",
    "ytd-masthead-ad-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-companion-slot-renderer",

    // Playables
    "ytd-playable-card-renderer",
    "ytd-game-card-renderer",
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
  ]);
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
    removeShelvesByTitle();
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
