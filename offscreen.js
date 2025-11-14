// offscreen.js
(function() {
  let audio = null;

  function ensureAudio() {
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.volume = 0.5;
    }
    return audio;
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;

    if (message.type === 'PLAY_MOOD_MUSIC') {
      const url = message.url;
      if (!url) return;
      const a = ensureAudio();
      try { a.pause(); } catch (e) {}
      a.src = url;
      a.play().catch(() => {
        // Autoplay may fail; leave silently to avoid disruptive errors.
      });
    }

    if (message.type === 'STOP_MUSIC') {
      if (audio) {
        try { audio.pause(); } catch (e) {}
        audio.src = '';
        audio = null;
      }
    }
  });
})();