(() => {
  const state = {
    initialized: false,
    observer: null,
  };

  function applyClassicMode() {
    // TODO: Add DOM cleanup logic for classic layout.
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    applyClassicMode();

    state.observer = new MutationObserver(() => {
      applyClassicMode();
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
