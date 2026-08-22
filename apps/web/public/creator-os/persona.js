/**
 * Persona constellation — a living canvas visualization of the owner's
 * context. Pure client-side rendering of the JSON data block emitted by the
 * persona mini-app; no network, no storage. Runs a cheap 2D-canvas particle
 * field (Messages-webview friendly) with a breathing core, orbiting nodes,
 * and pointer attraction.
 */
(function () {
  "use strict";

  function start() {
    var canvas = document.getElementById("persona-canvas");
    var dataEl = document.getElementById("persona-data");
    if (!canvas || !dataEl || !canvas.getContext) return;
    var data;
    try {
      data = JSON.parse(dataEl.textContent || "{}");
    } catch {
      return;
    }
    var nodes = Array.isArray(data.nodes) ? data.nodes : [];
    var completion =
      typeof data.completion === "number" ? data.completion : 0;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0;
    var h = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    var GROUP_HUES = { signal: 208, account: 158, context: 288 };
    var particles = nodes.map(function (node, i) {
      var ring = node.group === "signal" ? 0.34 : node.group === "account" ? 0.52 : 0.68;
      return {
        label: String(node.label || ""),
        energy: Math.max(0.1, Math.min(1, Number(node.energy) || 0.1)),
        hue: GROUP_HUES[node.group] || 208,
        angle: (i / Math.max(nodes.length, 1)) * Math.PI * 2 + i * 0.7,
        speed: 0.00012 + (i % 5) * 0.00004,
        ring: ring,
        wobble: Math.random() * Math.PI * 2,
      };
    });

    var pointer = { x: null, y: null };
    function setPointer(e) {
      var rect = canvas.getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      pointer.x = p.clientX - rect.left;
      pointer.y = p.clientY - rect.top;
    }
    function clearPointer() {
      pointer.x = null;
      pointer.y = null;
    }
    canvas.addEventListener("pointermove", setPointer);
    canvas.addEventListener("pointerdown", setPointer);
    canvas.addEventListener("pointerleave", clearPointer);
    canvas.addEventListener("touchmove", setPointer, { passive: true });
    canvas.addEventListener("touchend", clearPointer);

    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      var cx = w / 2;
      var cy = h / 2;
      var base = Math.min(w, h) / 2;
      var breathe = reduced ? 0 : Math.sin(t * 0.0012) * 0.04;

      // Core: the owner. Radius breathes with time, glow with completion.
      var coreR = base * (0.16 + completion * 0.08) * (1 + breathe);
      var glow = ctx.createRadialGradient(cx, cy, coreR * 0.2, cx, cy, coreR * 2.4);
      glow.addColorStop(0, "hsla(208,90%,72%," + (0.5 + completion * 0.3) + ")");
      glow.addColorStop(1, "hsla(208,90%,72%,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "hsla(208,60%,90%,0.9)";
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Nodes orbit; lit nodes link back to the core.
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (!reduced) {
          p.angle += p.speed * (0.6 + p.energy);
          p.wobble += 0.004;
        }
        var r = base * p.ring * (1 + Math.sin(p.wobble) * 0.03);
        var x = cx + Math.cos(p.angle) * r;
        var y = cy + Math.sin(p.angle) * r * 0.92;
        if (pointer.x !== null) {
          var dx = pointer.x - x;
          var dy = pointer.y - y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 12000) {
            x += dx * 0.12;
            y += dy * 0.12;
          }
        }
        if (p.energy > 0.4) {
          ctx.strokeStyle =
            "hsla(" + p.hue + ",70%,70%," + p.energy * 0.22 + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        var nr = 2.5 + p.energy * 4.5;
        var ng = ctx.createRadialGradient(x, y, 0, x, y, nr * 3);
        ng.addColorStop(0, "hsla(" + p.hue + ",85%,72%," + p.energy * 0.55 + ")");
        ng.addColorStop(1, "hsla(" + p.hue + ",85%,72%,0)");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(x, y, nr * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "hsla(" + p.hue + ",80%," + (55 + p.energy * 30) + "%,0.95)";
        ctx.beginPath();
        ctx.arc(x, y, nr, 0, Math.PI * 2);
        ctx.fill();
        if (p.energy > 0.4 && base > 130) {
          ctx.fillStyle = "hsla(0,0%,100%," + (0.35 + p.energy * 0.4) + ")";
          ctx.font = "10px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillText(p.label.slice(0, 18), x, y - nr - 6);
        }
      }
      if (!reduced) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
