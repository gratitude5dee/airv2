/**
 * Creative plugin operator HUD (goal-creative.md CM1 task 6). Slot-only:
 * tab.hidden is true in the manifest, so no user-facing navigation entry
 * exists — this renders inside the /advanced operator console and nowhere
 * else. It shows render queue depth, job states, disk headroom, and the
 * last error: the thing support looks at with the user's consent.
 */
(function () {
  var sdk = window.__HERMES_PLUGINS__;
  if (!sdk || !window.React) return;
  var React = window.React;
  var h = React.createElement;

  function CreativeHud() {
    var state = React.useState(null);
    var stats = state[0];
    var setStats = state[1];

    React.useEffect(function () {
      var alive = true;
      function poll() {
        fetch("/api/plugins/creative/jobs?stats=1", { credentials: "include" })
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (body) { if (alive && body) setStats(body); })
          .catch(function () {});
      }
      poll();
      var timer = setInterval(poll, 15000);
      return function () { alive = false; clearInterval(timer); };
    }, []);

    if (!stats) {
      return h("div", { className: "creative-hud" }, "creative: loading\u2026");
    }
    return h(
      "div",
      { className: "creative-hud" },
      h("strong", null, "creative"),
      h("span", null, " queued " + (stats.queued || 0)),
      h("span", null, " running " + (stats.running || 0)),
      h("span", null, " failed " + (stats.failed || 0)),
      stats.disk_free_gb != null
        ? h("span", null, " disk " + stats.disk_free_gb + " GB free")
        : null,
      stats.last_error
        ? h("div", { className: "creative-hud-error" }, stats.last_error)
        : null
    );
  }

  sdk.register("creative", CreativeHud);
  if (sdk.registerSlot) {
    sdk.registerSlot("creative", "advanced", CreativeHud);
  }
})();
