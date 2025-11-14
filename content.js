// content.js
(function () {
  let audio = null;
  function gatherPageText() {
    let text = "";
    try {
      text = document.body ? (document.body.innerText || "") : "";
    } catch (e) {
      text = "";
    }
    text = text.replace(/\s+/g, " ").trim();
    if (text.length > 5000) text = text.slice(0, 5000);
    return text;
  }

  function sendText() {
    const text = gatherPageText();
    chrome.runtime.sendMessage({ type: "PAGE_TEXT", text });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    sendText();
  } else {
    window.addEventListener("DOMContentLoaded", sendText, { once: true });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;

    if (message.type === "PLAY_MOOD_MUSIC") {
      const url = message.url;
      if (!url) return;

      if (!audio) {
        audio = new Audio();
      } else {
        try { audio.pause(); } catch (e) {}
      }
      audio.src = url;
      audio.loop = true;
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }

    if (message.type === "STOP_MUSIC") {
      if (audio) {
        try { audio.pause(); } catch (e) {}
        audio.src = "";
        audio = null;
      }
    }
  });
})();