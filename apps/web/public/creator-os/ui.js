/**
 * Shared mini-app interaction helper (progressive enhancement, ~1kb).
 *
 * 1. Spotlight: elements with class "spot" get a pointer-following radial
 *    highlight (CSS owns the paint; this only writes --mx/--my). One
 *    delegated listener, no per-element handlers.
 * 2. Home reorder: an [data-reorder] grid supports iOS-style press-and-hold
 *    to enter edit mode, drag to rearrange, and posts the new order through
 *    the #order-form hidden form on release.
 *
 * No element is required: each feature activates only when its markup is
 * present, and the page is fully usable without this script.
 */
(function () {
  "use strict";

  document.addEventListener(
    "pointermove",
    function (event) {
      var spot = event.target instanceof Element && event.target.closest(".spot");
      if (!spot) return;
      var rect = spot.getBoundingClientRect();
      spot.style.setProperty("--mx", event.clientX - rect.left + "px");
      spot.style.setProperty("--my", event.clientY - rect.top + "px");
    },
    { passive: true }
  );

  var grid = document.querySelector("[data-reorder]");
  var form = document.getElementById("order-form");
  if (!grid || !form) return;
  var orderInput = form.querySelector('input[name="order"]');
  if (!orderInput) return;

  var HOLD_MS = 450;
  var holdTimer = 0;
  var editing = false;
  var dragged = null;
  var suppressClick = false;

  function orderNow() {
    return items()
      .map(function (a) {
        return a.getAttribute("data-slug");
      })
      .join(",");
  }

  var savedOrder = "";

  function items() {
    return Array.prototype.slice.call(grid.querySelectorAll("a[data-slug]"));
  }

  function stopEditing() {
    if (!editing) return;
    editing = false;
    suppressClick = true;
    setTimeout(function () {
      suppressClick = false;
    }, 0);
    grid.classList.remove("editing");
    if (dragged) dragged.classList.remove("drag");
    dragged = null;
    var next = orderNow();
    if (next !== savedOrder) {
      orderInput.value = next;
      form.submit();
    }
  }

  grid.addEventListener("pointerdown", function (event) {
    var link = event.target instanceof Element && event.target.closest("a[data-slug]");
    if (!link) return;
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(function () {
      editing = true;
      savedOrder = orderNow();
      grid.classList.add("editing");
      dragged = link;
      link.classList.add("drag");
    }, HOLD_MS);
  });

  grid.addEventListener("pointermove", function (event) {
    if (!editing || !dragged) {
      // Any real movement before the hold fires means a scroll, not a hold.
      clearTimeout(holdTimer);
      return;
    }
    event.preventDefault();
    var over = document.elementFromPoint(event.clientX, event.clientY);
    var target = over && over.closest("a[data-slug]");
    if (!target || target === dragged || target.parentElement !== grid) return;
    var all = items();
    if (all.indexOf(target) < all.indexOf(dragged)) {
      grid.insertBefore(dragged, target);
    } else {
      grid.insertBefore(dragged, target.nextSibling);
    }
  });

  ["pointerup", "pointercancel"].forEach(function (name) {
    grid.addEventListener(name, function () {
      clearTimeout(holdTimer);
      stopEditing();
    });
  });

  // A held press must not follow the link on release.
  grid.addEventListener("click", function (event) {
    if (editing || suppressClick) {
      event.preventDefault();
    }
  });

  // Dragging shouldn't scroll the page on touch.
  grid.addEventListener(
    "touchmove",
    function (event) {
      if (editing) event.preventDefault();
    },
    { passive: false }
  );
})();
