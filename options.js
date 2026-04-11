const DEFAULT_THEME = "light";

function setTheme(value) {
  chrome.storage.sync.set({ classicTheme: value });
}

function loadTheme() {
  chrome.storage.sync.get({ classicTheme: DEFAULT_THEME }, (data) => {
    const value = data.classicTheme || DEFAULT_THEME;
    const input = document.querySelector(
      `input[name="theme"][value="${value}"]`
    );
    if (input) input.checked = true;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadTheme();

  document.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.addEventListener("change", (event) => {
      if (event.target.checked) {
        setTheme(event.target.value);
      }
    });
  });
});
