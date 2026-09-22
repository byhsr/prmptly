/* prmptly bridge — lets the host app load and save canvases.
 *
 * Loaded after js/main.js. ark's own files are untouched: this only reads the
 * public surface main.js already exposes (FD.app, FD.bus).
 *
 *   ark  --"ark:change"-->  host   (debounced; host writes vault/canvases/<id>.json)
 *   host --"ark:load"------>  ark   (FD.app.importText, no confirm dialog)
 */
(function () {
  if (window.parent === window) return; // opened standalone — nothing to do

  var timer = null;
  var suppressUntil = 0; // ignore the change we cause by loading a doc

  function post(msg) {
    msg.source = "ark";
    window.parent.postMessage(msg, "*");
  }

  function send() {
    try {
      post({ type: "ark:change", doc: FD.app.toJSON() });
    } catch (e) {
      /* store not ready yet */
    }
  }

  FD.bus.on("doc", function () {
    if (Date.now() < suppressUntil) return;
    clearTimeout(timer);
    timer = setTimeout(send, 600);
  });

  window.addEventListener("message", function (e) {
    var data = e.data;
    if (!data || data.source !== "prmptly") return;

    if (data.type === "ark:load" && data.doc) {
      suppressUntil = Date.now() + 1500;
      FD.app.importText(data.doc, { confirmReplace: false });
      return;
    }

    if (data.type === "ark:theme") {
      document.documentElement.dataset.theme = data.theme === "light" ? "light" : "dark";
    }
  });

  // boot() is async, so FD.app.ready flips a tick after load — poll for it rather
  // than racing the load event. Bounded so a failed boot can't spin a timer forever.
  (function waitReady(attempts) {
    if (FD.app && FD.app.ready) {
      post({ type: "ark:ready" });
      return;
    }
    if (attempts > 400) return; // ~20s
    setTimeout(function () {
      waitReady(attempts + 1);
    }, 50);
  })(0);
})();
