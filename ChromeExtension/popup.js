const MAX_TABS = 5;

/* ---------- TYPING EFFECT ---------- */
function typeText(element, text, speed = 30) {
  let i = 0;
  const interval = setInterval(() => {
    element.textContent += text[i];
    i++;
    if (i >= text.length) clearInterval(interval);
  }, speed);
}

/* ---------- CHAT TOGGLE ---------- */
document.getElementById("chat-toggle").addEventListener("click", () => {
  const panel = document.getElementById("chat-panel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
});

/* ---------- COPY ---------- */
document.getElementById("copy-btn").addEventListener("click", () => {
  const btn = document.getElementById("copy-btn");
  navigator.clipboard.writeText(document.getElementById("result").innerText);

  btn.style.background = "#dcfce7";
  setTimeout(() => {
    btn.style.background = "#f3f4f6";
  }, 1200);
});

/* ---------- SUMMARIZE ---------- */
document.getElementById("summarize").addEventListener("click", () => {
  summarizeFromTabs(true);
});

document.getElementById("summarize-tabs").addEventListener("click", () => {
  summarizeFromTabs(false);
});

/* ---------- CHAT SEND ---------- */
document.getElementById("send-btn").addEventListener("click", async () => {
  const input = document.getElementById("chat-input");
  const question = input.value.trim();
  if (!question) return;

  const chatMessages = document.getElementById("chat-messages");

  const userBubble = document.createElement("div");
  userBubble.className = "chat-user";
  userBubble.innerText = question;
  chatMessages.appendChild(userBubble);

  input.value = "";
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const aiBubble = document.createElement("div");
  aiBubble.className = "chat-ai";
  aiBubble.innerText = "Thinking...";
  chatMessages.appendChild(aiBubble);

  chrome.storage.sync.get(["lastCombinedText", "geminiApiKey"], async (res) => {
    if (!res.lastCombinedText || !res.lastCombinedText.trim()) {
      aiBubble.innerText = "❌ Please summarize an article first.";
      return;
    }

    const answer = await callGemini(
      `You are an assistant answering questions based only on the article below.
If the answer is not present, say "Not mentioned in the article".

ARTICLE:
${res.lastCombinedText}

QUESTION:
${question}`,
      res.geminiApiKey
    );

    aiBubble.innerText = "";
    typeText(aiBubble, answer, 25);

    /* 🔥 SEND ANSWER TO CONTENT SCRIPT FOR HIGHLIGHT */
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "HIGHLIGHT_ANSWER",
        text: answer
      });
    });
  });
});

/* ---------- SUMMARY CORE ---------- */
function summarizeFromTabs(singleTab) {
  const resultDiv = document.getElementById("result");
  resultDiv.innerText = "Summarising....";

  chrome.storage.sync.get(["geminiApiKey"], (res) => {
    chrome.tabs.query(
      singleTab ? { active: true, currentWindow: true } : {},
      async (tabs) => {
        const validTabs = tabs
          .filter(t => t.url && t.url.startsWith("http"))
          .slice(0, singleTab ? 1 : MAX_TABS);

        let combinedText = "";

        for (const tab of validTabs) {
          const response = await sendMessage(tab.id);
          if (response?.text) {
            combinedText += response.text.slice(0, 3000) + "\n\n";
          }
        }

        if (!combinedText.trim()) {
          resultDiv.innerText = "❌ No readable article found on this tab.";
          return;
        }

        chrome.storage.sync.set({ lastCombinedText: combinedText });

        const summary = await callGemini(
          `Summarize the following clearly:\n${combinedText}`,
          res.geminiApiKey
        );

        resultDiv.innerText = "";
        typeText(resultDiv, summary, 30);
      }
    );
  });
}

/* ---------- TAB MESSAGE ---------- */
function sendMessage(tabId) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { type: "GET_ARTICLE_TEXT" }, resolve);
  });
}

/* ---------- GEMINI ---------- */
async function callGemini(prompt, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 900 }
      })
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("Gemini API Error:", data);
    return data?.error?.message || "Gemini API error occurred.";
  }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "⚠️ Gemini returned no text.";
}
