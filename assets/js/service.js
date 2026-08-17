/* Seite "Kostenlose Website fuer Moscheen".

   Privates Angebot des Erstellers der Website. Alle Texte stehen in
   content/service.json, die Kontaktwege in content/settings.json unter
   "service" – fehlt ein Eintrag, erscheint die zugehoerige Schaltflaeche nicht. */

(function () {
  "use strict";

  const S = window.Site;
  let data = null;

  function block(entry) {
    const points = Array.isArray(entry.points) ? entry.points : [];

    return `<section class="card overview-block" data-block="${S.escapeHtml(entry.id || "")}">
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

  function contactButtons() {
    const service = (S.settings && S.settings.service) || {};
    const buttons = [];

    if (service.email) {
      buttons.push(`<a class="btn btn--primary" href="mailto:${S.escapeHtml(service.email)}">
        <span aria-hidden="true">✉️</span> ${S.escapeHtml(S.t("service.email"))}
      </a>`);
    }
    if (service.website) {
      buttons.push(`<a class="btn btn--outline" href="${S.escapeHtml(service.website)}"
        target="_blank" rel="noopener">
        <span aria-hidden="true">🌐</span> ${S.escapeHtml(S.t("service.website"))}
      </a>`);
    }
    if (service.whatsapp) {
      buttons.push(`<a class="btn btn--outline" href="https://wa.me/${S.escapeHtml(
        String(service.whatsapp).replace(/[^0-9]/g, "")
      )}" target="_blank" rel="noopener">
        <span aria-hidden="true">💬</span> WhatsApp
      </a>`);
    }

    if (!buttons.length) return "";

    return `<section class="card service-contact">
      <h2>${S.escapeHtml(S.t("service.contactTitle"))}</h2>
      <p>${S.escapeHtml(S.t("service.contactText"))}</p>
      <div class="service-contact__actions">${buttons.join("")}</div>
    </section>`;
  }

  function render() {
    const hosts = document.querySelectorAll("[data-service]");
    if (!hosts.length) return;

    if (!data) {
      hosts.forEach((host) => {
        host.innerHTML = `<div class="empty-state"><p>${S.escapeHtml(S.t("common.error"))}</p></div>`;
      });
      return;
    }

    const blocks = Array.isArray(data.blocks) ? data.blocks : [];

    hosts.forEach((host) => {
      host.innerHTML = `
        <p class="overview-intro">${S.escapeHtml(S.field(data.intro))}</p>
        <div class="overview-grid">${blocks.map(block).join("")}</div>
        ${contactButtons()}
        <p class="service-note">${S.escapeHtml(S.field(data.disclaimer))}</p>`;
    });
  }

  S.ready
    .then(() => S.loadJson("content/service.json"))
    .then((json) => {
      data = json;
    })
    .catch((error) => {
      console.error("content/service.json konnte nicht geladen werden.", error);
      data = null;
    })
    .finally(() => {
      render();
      S.onLangChange(render);
    });
})();
