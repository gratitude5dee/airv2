/*
 * Browser-side half of the Kernel provider-action exchange. The token
 * never leaves location.hash until this POST; strip it immediately so it
 * cannot escape in history, screenshots, or a copied URL. On success the
 * provider-hosted ceremony URL replaces this page via location.replace —
 * the URL never re-enters our origin's history.
 */
(function () {
  "use strict";
  var status = document.querySelector("[data-kernel-action]");
  var params = new URLSearchParams(window.location.hash.slice(1));
  var token = params.get("t");
  window.history.replaceState(null, document.title, window.location.pathname);

  function show(message) {
    if (status) status.textContent = message;
  }
  if (!token) {
    show("This link is incomplete. Ask Air for a fresh one.");
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
        if (!response.ok || !data.url) {
          throw new Error(typeof data.error === "string" ? data.error : "Could not open this payment step.");
        }
        window.location.replace(data.url);
      });
    })
    .catch(function (error) {
      show(error && error.message ? error.message : "Could not open this payment step.");
    });
})();
