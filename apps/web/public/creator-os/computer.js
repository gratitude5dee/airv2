/**
 * Computer mini-app embed helper. The desktop stream page (moonlight-web)
 * handles keyboard itself when top-level, but inside an iframe — especially
 * the Messages webview — key events land on the parent document instead of
 * the stream. Forward them as the `keyboard_event` postMessages the stream
 * page's embedded mode expects. Keys are only ever sent to the embedded
 * stream frame; nothing is read back (the frame is cross-origin).
 */
(function () {
  "use strict";
  var frame = document.getElementById("live-desktop");
  if (!frame) return;
  // Pin postMessage to the exact stream origin (server-provided, host only)
  // so keystrokes can never be delivered to an unexpected frame origin.
  var streamOrigin = frame.getAttribute("data-stream-origin");
  if (!streamOrigin) return;

  function isFormField(target) {
    if (!target || !target.tagName) return false;
    var tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
  }

  function forward(event, isDown) {
    // Keys typed into the page's own form fields stay on the page.
    if (isFormField(event.target)) return;
    if (!frame.contentWindow) return;
    frame.contentWindow.postMessage(
      {
        type: "keyboard_event",
        isDown: isDown,
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        repeat: event.repeat,
      },
      streamOrigin
    );
  }

  document.addEventListener(
    "keydown",
    function (event) {
      forward(event, true);
    },
    true
  );
  document.addEventListener(
    "keyup",
    function (event) {
      forward(event, false);
    },
    true
  );
})();
