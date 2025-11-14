// background.js

const MOOD_TO_MP3 = {
  positive: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  negative: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  neutral: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
};

// ---------------- SENTIMENT ANALYSIS ----------------

async function analyzeSentimentViaAPI(text) {
  try {
    const resp = await fetch("https://sentim-api.herokuapp.com/api/v1/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!resp.ok) {
      return simpleSentiment(text);
    }

    const contentType = resp.headers.get("content-type") || "";

    // If not JSON → fallback
    if (!contentType.includes("application/json")) {
      return simpleSentiment(text);
    }

    let data;
    try {
      data = await resp.json();
    } catch (e) {
      return simpleSentiment(text);
    }

    const mood = data?.result?.type;

    if (["positive", "negative", "neutral"].includes(mood)) {
      return mood;
    }

    return simpleSentiment(text);

  } catch (e) {
    return simpleSentiment(text);
  }
}


function simpleSentiment(text) {
  const pos = ["good","great","happy","love","excellent","awesome","fantastic","joy","wonderful","amazing","positive","nice","success","win"];
  const neg = ["bad","sad","hate","terrible","awful","horrible","angry","pain","fail","tragic","negative","poor","worst","loss"];

  const t = (text || "").toLowerCase();
  let score = 0;

  for (const w of pos) if (t.includes(w)) score++;
  for (const w of neg) if (t.includes(w)) score--;

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

// ---------------- OFFSCREEN DOCUMENT ----------------

async function ensureOffscreenDocument() {
  if (!chrome.offscreen) return;
  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play mood music based on sentiment'
    });
  } catch (e) {
    // If already created, creation throws; safe to ignore.
  }
}

function sendRuntimeMessageSafe(payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(payload, () => {
        // If receiving end doesn't exist, lastError will be set.
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ ok: false, error: err.message });
        } else {
          resolve({ ok: true });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: String(e && e.message || e) });
    }
  });
}

function sendTabMessageSafe(tabId, payload) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, payload, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ ok: false, error: err.message });
        } else {
          resolve({ ok: true });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: String(e && e.message || e) });
    }
  });
}

async function sendToOffscreenWithRetry(payload, maxAttempts = 5, delayMs = 150) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    const res = await sendRuntimeMessageSafe(payload);
    if (res.ok) return true;
    await new Promise(r => setTimeout(r, delayMs));
    attempt++;
  }
  return false;
}


// ---------------- MESSAGE LISTENER ----------------

chrome.runtime.onMessage.addListener((message, sender) => {
  
  // ----------- PLAY MUSIC TRIGGER -----------
  if (message?.type === "PAGE_TEXT") {
    (async () => {
      const mood = await analyzeSentimentViaAPI(message.text || "");
      const url = MOOD_TO_MP3[mood] ?? MOOD_TO_MP3.neutral;

      const offscreenAvailable = !!chrome.offscreen;

      if (offscreenAvailable) {
        await ensureOffscreenDocument();
        const delivered = await sendToOffscreenWithRetry({ type: "PLAY_MOOD_MUSIC", mood, url });
        if (!delivered && sender?.tab?.id) {
          // Fallback to content script when offscreen hasn't received yet
          await sendTabMessageSafe(sender.tab.id, { type: "PLAY_MOOD_MUSIC", mood, url });
        }
      } else if (sender?.tab?.id) {
        await sendTabMessageSafe(sender.tab.id, { type: "PLAY_MOOD_MUSIC", mood, url });
      }
    })();

    return true;
  }


  // ----------- STOP MUSIC TRIGGER -----------
  if (message?.type === "STOP_MUSIC") {
    (async () => {
      const offscreenAvailable = !!chrome.offscreen;

      if (offscreenAvailable) {
        await ensureOffscreenDocument();
        const delivered = await sendToOffscreenWithRetry({ type: "STOP_MUSIC" });
        if (!delivered) {
          chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs?.[0]?.id) {
              await sendTabMessageSafe(tabs[0].id, { type: "STOP_MUSIC" });
            }
          });
        }
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (tabs?.[0]?.id) {
            await sendTabMessageSafe(tabs[0].id, { type: "STOP_MUSIC" });
          }
        });
      }
    })();

    return true;
  }

});
