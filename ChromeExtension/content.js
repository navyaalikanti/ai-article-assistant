let originalArticleHTML = null;

function getSelectedOrArticleText() {
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 50) {
    return selection.toString();
  }

  let text = "";
  const article = document.querySelector("article");
  if (article) text = article.innerText;

  if (!text || text.length < 500) {
    const paragraphs = Array.from(document.querySelectorAll("p"))
      .map(p => p.innerText)
      .filter(t => t.length > 50);
    text = paragraphs.join("\n");
  }

  return text.trim();
}

/* ==============================
   🔥 Highlight AI Answer
============================== */
function highlightAnswer(answer) {
  if (!answer || answer.length < 20) return;

  const container =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.body;

  // Save original HTML once
  if (!originalArticleHTML) {
    originalArticleHTML = container.innerHTML;
  }

  // Reset to original before new highlight
  container.innerHTML = originalArticleHTML;

  // Use first meaningful sentence
  const sentence = answer.split(".")[0].trim();
  if (sentence.length < 20) return;

  const safe = sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(safe, "i");

  container.innerHTML = container.innerHTML.replace(
    regex,
    match => `<mark class="ai-highlight" style="background:#fff3a0;">${match}</mark>`
  );

  const highlight = container.querySelector(".ai-highlight");
  if (highlight) {
    highlight.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/* ==============================
   Message Listener
============================== */
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_ARTICLE_TEXT") {
    sendResponse({ text: getSelectedOrArticleText() });
  }

  if (req.type === "HIGHLIGHT_ANSWER") {
    highlightAnswer(req.text);
  }
});
