// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("stopBtn");
  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "STOP_MUSIC" });
    window.close();
  });
});