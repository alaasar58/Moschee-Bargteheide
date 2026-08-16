/* Unterlage fuer die Vorstellung beim Vorstand.

   Der gesamte Text steht in content/overview.json und ist dort in allen vier
   Sprachen hinterlegt – die Gemeinde kann ihn jederzeit ohne Code anpassen. */

(function () {
  "use strict";

  const S = window.Site;
  let data = null;

  function block(entry) {
    const points = Array.isArray(entry.points) ? entry.points : [];

    return `<section class="card overview-block">
      <h2 class="overview-block__title">
        <span class="overview-block__icon" aria-hidden="true">${S.escapeHtml(entry.icon || "•")}</span>
        ${S.escapeHtml(S.field(entry.title))}
      </h2>
      ${S.field(entry.text) ? `<p class="overview-block__text">${S.escapeHtml(S.field(entry.text))}</p>` : ""}
      ${
        points.length
          ? `<ul class="overview-list">${points
              .map((point) => `<li>${S.escapeHtml(S.field(point))}</li>`)
              .join("")}</ul>`
          : ""
      }
    </section>`;
  }

  function render() {
    const hosts = document.querySelectorAll("[data-overview]");
    if (!hosts.length) return;

    if (!data) {
      hosts.forEach((host) => {
        host.innerHTML = `<div class="empty-state"><p>${S.escapeHtml(S.t("common.error"))}</p></div>`;
      });
      return;
    }

    const settings = S.settings || {};
    const blocks = Array.isArray(data.blocks) ? data.blocks : [];

    hosts.forEach((host) => {
      host.innerHTML = `<div class="print-doc">
        <p class="overview-intro">${S.escapeHtml(S.field(data.intro))}</p>
        <p class="overview-meta">
          ${S.escapeHtml(settings.associationName || "Islamische Gemeinde Bargteheide e.V.")}
          ${data.updated ? ` · ${S.escapeHtml(S.t("overview.status"))}: ${S.escapeHtml(S.formatDate(data.updated))}` : ""}
        </p>
        <div class="overview-grid">${blocks.map(block).join("")}</div>
      </div>
      <p style="margin-top: 22px" class="no-print">
        <button type="button" class="btn btn--primary" data-print-overview>${S.escapeHtml(
          S.t("overview.print")
        )}</button>
      </p>`;

      const button = host.querySelector("[data-print-overview]");
      if (button) button.addEventListener("click", () => window.print());
    });
  }

  S.ready
    .then(() => S.loadJson("content/overview.json"))
    .then((json) => {
      data = json;
    })
    .catch((error) => {
      console.error("content/overview.json konnte nicht geladen werden.", error);
      data = null;
    })
    .finally(() => {
      render();
      S.onLangChange(render);
    });
})();
