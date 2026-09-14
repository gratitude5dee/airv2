/*
 * Browser-side half of the checkout fragment exchange. The token never
 * leaves location.hash until this POST; strip it before any later navigation
 * so it cannot escape in history, screenshots, or a copied URL.
 */
(function () {
  "use strict";
  var status = document.querySelector("[data-checkout-launch]");
  var params = new URLSearchParams(window.location.hash.slice(1));
  var token = params.get("t");
  window.history.replaceState(null, document.title, window.location.pathname);

  function show(message) {
    if (status) status.textContent = message;
  }
  if (!token) {
    show("This checkout link is incomplete. Ask Air for a fresh link.");
    return;
  }
  fetch(window.location.pathname, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: token }),
  })
    .then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || !data.next) {
          throw new Error(typeof data.error === "string" ? data.error : "Could not open this checkout handoff.");
        }
        window.location.replace(data.next);
      });
    })
    .catch(function (error) {
      show(error && error.message ? error.message : "Could not open this checkout handoff.");
    });
})();
