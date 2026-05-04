const toggle = document.getElementById("toggle-detector");
const statusText = document.getElementById("status-text");

chrome.storage.sync.get({ detectorEnabled: true }, (data) => {
  const enabled = data.detectorEnabled;
  toggle.checked = enabled;
  updateStatus(enabled);
});

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ detectorEnabled: enabled }, () => {
    updateStatus(enabled);
  });
});

function updateStatus(enabled) {
  statusText.textContent = enabled ? "Protection is ON." : "Protection is OFF.";
}