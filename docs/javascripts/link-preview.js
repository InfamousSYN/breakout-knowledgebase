(function () {
  "use strict";

  var cache = new Map();
  var tooltip = null;
  var activeLink = null;
  var hoverTimeout = null;
  var leaveTimeout = null;

  function createTooltip() {
    var el = document.createElement("div");
    el.className = "link-preview-tooltip";
    document.body.appendChild(el);
    return el;
  }

  function isInternalCrossPageLink(a) {
    if (!a.href) return false;
    try {
      var url = new URL(a.href, window.location.origin);
    } catch (e) {
      return false;
    }
    if (url.hostname !== window.location.hostname) return false;
    if (url.pathname === window.location.pathname) return false;
    if (a.getAttribute("href").charAt(0) === "#") return false;
    return true;
  }

  function truncate(text, max) {
    if (text.length <= max) return text;
    return text.substring(0, max).replace(/\s+\S*$/, "") + "\u2026";
  }

  function extractContent(html, url) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    var content = doc.querySelector(".md-content");
    if (!content) return null;

    var titleEl = content.querySelector("h1");
    var title = titleEl ? titleEl.textContent.replace(/\u00b6$/, "").trim() : url;

    var excerpt = "";
    var paragraphs = content.querySelectorAll("p");
    for (var i = 0; i < paragraphs.length; i++) {
      var text = paragraphs[i].textContent.trim();
      if (text.length > 20) {
        excerpt = truncate(text, 300);
        break;
      }
    }

    var sections = [];
    var headings = content.querySelectorAll("h2");
    for (var j = 0; j < headings.length && j < 5; j++) {
      sections.push(headings[j].textContent.replace(/\u00b6$/, "").trim());
    }

    return { title: title, excerpt: excerpt, sections: sections };
  }

  function renderTooltip(data) {
    var html = '<div class="link-preview-title">' + escapeHtml(data.title) + "</div>";
    if (data.excerpt) {
      html += '<div class="link-preview-excerpt">' + escapeHtml(data.excerpt) + "</div>";
    }
    if (data.sections.length > 0) {
      html += '<div class="link-preview-sections">';
      for (var i = 0; i < data.sections.length; i++) {
        html += '<span class="link-preview-section"># ' + escapeHtml(data.sections[i]) + "</span>";
      }
      html += "</div>";
    }
    return html;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function positionTooltip(link) {
    var rect = link.getBoundingClientRect();
    var tipWidth = 320;
    var tipHeight = tooltip.offsetHeight || 150;

    var top = rect.bottom + 8;
    var left = rect.left + rect.width / 2 - tipWidth / 2;

    if (top + tipHeight > window.innerHeight - 16) {
      top = rect.top - tipHeight - 8;
    }

    if (left < 8) left = 8;
    if (left + tipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tipWidth - 8;
    }

    tooltip.style.top = top + "px";
    tooltip.style.left = left + "px";
  }

  function showTooltip(link) {
    if (!tooltip) tooltip = createTooltip();

    var url = link.href;
    activeLink = link;

    if (cache.has(url)) {
      var data = cache.get(url);
      if (data) {
        tooltip.innerHTML = renderTooltip(data);
      } else {
        return;
      }
      positionTooltip(link);
      tooltip.classList.add("link-preview-visible");
      return;
    }

    tooltip.innerHTML = '<div class="link-preview-loading">Loading\u2026</div>';
    positionTooltip(link);
    tooltip.classList.add("link-preview-visible");

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      })
      .then(function (html) {
        var data = extractContent(html, url);
        cache.set(url, data);
        if (activeLink !== link) return;
        if (data) {
          tooltip.innerHTML = renderTooltip(data);
          positionTooltip(link);
        } else {
          hideTooltip();
        }
      })
      .catch(function () {
        cache.set(url, null);
        if (activeLink === link) hideTooltip();
      });
  }

  function hideTooltip() {
    if (tooltip) {
      tooltip.classList.remove("link-preview-visible");
    }
    activeLink = null;
  }

  function init() {
    var content = document.querySelector(".md-content");
    if (!content) return;

    content.addEventListener("mouseover", function (e) {
      var link = e.target.closest("a[href]");
      if (!link || !isInternalCrossPageLink(link)) return;

      clearTimeout(leaveTimeout);

      if (activeLink === link) return;

      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(function () {
        showTooltip(link);
      }, 300);
    });

    content.addEventListener("mouseout", function (e) {
      var link = e.target.closest("a[href]");
      if (!link) return;

      clearTimeout(hoverTimeout);

      leaveTimeout = setTimeout(function () {
        hideTooltip();
      }, 200);
    });

    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(".link-preview-tooltip")) {
        clearTimeout(leaveTimeout);
      }
    });

    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(".link-preview-tooltip")) {
        leaveTimeout = setTimeout(function () {
          hideTooltip();
        }, 200);
      }
    });
  }

  // Material instant-loading compatibility
  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      init();
    });
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
