const MATHJAX_SCRIPT_ID = "city-mathjax-runtime";
const MATHJAX_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/mathjax@4/tex-svg.js";

let mathJaxRuntimePromise = null;

export function renderMarkdownToHtml(markdown) {
  const source = String(markdown || "").trim();
  if (!source) {
    return '<p class="note-rendered-empty">Nothing to render yet.</p>';
  }

  const lines = source.split(/\r?\n/);
  const blocks = [];
  let listItems = [];
  let paragraphLines = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    blocks.push(`<ul>${listItems.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }
    blocks.push(`<p>${applyInlineMarkdown(paragraphLines.join(" "))}</p>`);
    paragraphLines = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      flushParagraph();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      flushParagraph();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`);
      return;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      return;
    }

    paragraphLines.push(trimmed);
  });

  flushList();
  flushParagraph();
  return blocks.join("");
}

function applyInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function queueMathTypeset(element, enabled) {
  if (!element) {
    return;
  }

  if (!enabled) {
    clearMathTypeset(element);
    return;
  }

  if (element.dataset.mathTypesetPending === "true") {
    return;
  }

  element.dataset.mathTypesetPending = "true";
  ensureMathJaxRuntime().then((mathJax) => {
    if (element.dataset.mathTypesetPending !== "true") {
      return;
    }
    window.requestAnimationFrame(() => {
      if (element.dataset.mathTypesetPending !== "true") {
        return;
      }
      mathJax.typesetPromise([element]).catch(() => {}).finally(() => {
        delete element.dataset.mathTypesetPending;
      });
    });
  }).catch(() => {
    delete element.dataset.mathTypesetPending;
  });
}

function ensureMathJaxRuntime() {
  if (window.MathJax?.typesetPromise) {
    return Promise.resolve(window.MathJax);
  }

  if (!mathJaxRuntimePromise) {
    window.MathJax = window.MathJax || {
      tex: {
        inlineMath: [["\\(", "\\)"], ["$", "$"]],
        displayMath: [["\\[", "\\]"], ["$$", "$$"]]
      },
      svg: {
        fontCache: "global"
      },
      options: {
        skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
      }
    };

    mathJaxRuntimePromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById(MATHJAX_SCRIPT_ID);
      if (existingScript instanceof HTMLScriptElement) {
        existingScript.addEventListener("load", () => resolve(window.MathJax), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("MathJax support failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = MATHJAX_SCRIPT_ID;
      script.src = MATHJAX_SCRIPT_URL;
      script.async = true;
      script.addEventListener("load", () => resolve(window.MathJax), { once: true });
      script.addEventListener("error", () => reject(new Error("MathJax support failed to load.")), { once: true });
      document.head.append(script);
    }).then((mathJax) => {
      if (!mathJax?.typesetPromise) {
        throw new Error("MathJax support did not initialize.");
      }
      return mathJax;
    }).catch((error) => {
      mathJaxRuntimePromise = null;
      throw error;
    });
  }

  return mathJaxRuntimePromise;
}

function clearMathTypeset(element) {
  const mathJax = window.MathJax;
  const clearPromise = mathJax?.typesetClear;
  if (typeof clearPromise === "function") {
    clearPromise([element]);
  }
  delete element.dataset.mathTypesetPending;
}
