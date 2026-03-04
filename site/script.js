const previews = {
  index: {
    chip: "Workspace",
    title: "Conversation hub with search and filters",
    text: "Scan, classify, and jump to any conversation using local index, folder pivots, and tag filters.",
    points: ["Indexed local lookup", "Folder plus tag pivots", "Fast open actions"]
  },
  prompt: {
    chip: "Prompt Library",
    title: "Template snippets with variable placeholders",
    text: "Save repeatable prompts, group them by tags, fill variables quickly, and insert directly to input.",
    points: ["Template catalog", "Tag-based grouping", "Variable prompt fill"]
  },
  formula: {
    chip: "Formula Desk",
    title: "Capture equations and copy to publishing formats",
    text: "Extract formulas from messages and copy as LaTeX or Word-friendly MathML with source jump support.",
    points: ["Formula collector", "LaTeX and MathML copy", "Back-link to source message"]
  },
  mermaid: {
    chip: "Mermaid Desk",
    title: "Render diagrams and trace origin in one panel",
    text: "Detect Mermaid blocks, render preview, copy code, and navigate back to the exact source message.",
    points: ["Diagram preview", "Source code copy", "Origin tracing"]
  }
};

const tabs = Array.from(document.querySelectorAll(".preview-tab"));
const previewStage = document.getElementById("previewStage");
const previewChip = document.getElementById("previewChip");
const previewTitle = document.getElementById("previewTitle");
const previewText = document.getElementById("previewText");
const previewPoints = document.getElementById("previewPoints");

let currentIndex = 0;
let rotationTimer = null;

function applyPreview(key) {
  const data = previews[key];
  if (!data || !previewStage || !previewChip || !previewTitle || !previewText || !previewPoints) {
    return;
  }

  previewStage.dataset.mode = key;
  previewChip.textContent = data.chip;
  previewTitle.textContent = data.title;
  previewText.textContent = data.text;
  previewPoints.innerHTML = data.points.map((point) => `<li>${point}</li>`).join("");
}

function setActiveTab(nextIndex) {
  if (!tabs.length) {
    return;
  }

  currentIndex = (nextIndex + tabs.length) % tabs.length;
  tabs.forEach((tab, index) => {
    tab.classList.toggle("is-active", index === currentIndex);
  });

  const shotKey = tabs[currentIndex].dataset.shot;
  if (shotKey) {
    applyPreview(shotKey);
  }
}

function startRotation() {
  if (!tabs.length) {
    return;
  }

  stopRotation();
  rotationTimer = window.setInterval(() => {
    setActiveTab(currentIndex + 1);
  }, 5200);
}

function stopRotation() {
  if (rotationTimer === null) {
    return;
  }
  window.clearInterval(rotationTimer);
  rotationTimer = null;
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    setActiveTab(index);
    startRotation();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    setActiveTab(currentIndex + 1);
    startRotation();
  }
  if (event.key === "ArrowLeft") {
    setActiveTab(currentIndex - 1);
    startRotation();
  }
});

if (previewStage) {
  previewStage.addEventListener("mousemove", (event) => {
    const rect = previewStage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const tiltX = (0.5 - y) * 2.2;
    const tiltY = (x - 0.5) * 2.2;
    previewStage.style.transform = `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });

  previewStage.addEventListener("mouseleave", () => {
    previewStage.style.transform = "";
  });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  },
  {
    threshold: 0.16,
    rootMargin: "0px 0px -44px 0px"
  }
);

document.querySelectorAll(".reveal").forEach((node, index) => {
  node.style.transitionDelay = `${Math.min(index * 70, 360)}ms`;
  revealObserver.observe(node);
});

setActiveTab(0);
startRotation();
