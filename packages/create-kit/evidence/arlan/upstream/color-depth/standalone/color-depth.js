function initColorDepth(root = document) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!reduce) {
    root.querySelectorAll(".depth-metal, .depth-foil").forEach((el) => {
      if (el.dataset.depthBound) return;
      el.dataset.depthBound = "1";
      let raf = 0;
      let px = 0.5;
      let py = 0.5;
      const write = () => {
        raf = 0;
        const s = el.style;
        s.setProperty("--pointer-x", (px * 100).toFixed(1) + "%");
        s.setProperty("--pointer-y", (py * 100).toFixed(1) + "%");
        s.setProperty("--glare-x", (px * 100).toFixed(1) + "%");
        s.setProperty("--glare-y", (py * 100).toFixed(1) + "%");
        s.setProperty("--shine-angle", (110 + (px - 0.5) * 50).toFixed(1) + "deg");
      };
      const schedule = () => {
        if (!raf) raf = requestAnimationFrame(write);
      };
      el.addEventListener(
        "pointermove",
        (e) => {
          const r = el.getBoundingClientRect();
          if (r.width && r.height) {
            px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
          }
          schedule();
        },
        { passive: true },
      );
      el.addEventListener("pointerleave", () => {
        px = 0.5;
        py = 0.5;
        schedule();
      });
    });
  }

  root.querySelectorAll(".depth-toggle").forEach((el) => {
    if (el.dataset.depthToggleBound) return;
    el.dataset.depthToggleBound = "1";
    if (!el.hasAttribute("data-on")) el.setAttribute("data-on", "true");
    el.addEventListener("click", () => {
      el.setAttribute("data-on", el.getAttribute("data-on") === "true" ? "false" : "true");
    });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initColorDepth());
  } else {
    initColorDepth();
  }
}
