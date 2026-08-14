/* Setzt Angaben aus content/settings.json in die Seiten ein
   (Adresse, Bild, Karte, Kontaktdaten, Bankverbindung). */

(function () {
  "use strict";

  const S = window.Site;

  function addressLine(settings) {
    const address = settings.address || {};
    return [address.street, [address.zip, address.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  }

  function renderHeroImage(settings) {
    document.querySelectorAll("[data-hero-image]").forEach((img) => {
      if (settings.heroImage) img.setAttribute("src", settings.heroImage);
      img.setAttribute("alt", `${S.t("site.subtitle")} – ${addressLine(settings)}`);
      img.addEventListener(
        "error",
        () => {
          // Wenn das Foto der Moschee noch fehlt, bleibt der ruhige Farbverlauf des Bereichs sichtbar.
          const media = img.closest(".hero__media");
          if (media) media.style.display = "none";
        },
        { once: true }
      );
    });
  }

  function renderAddress(settings) {
    const line = addressLine(settings);
    document.querySelectorAll("[data-address]").forEach((el) => {
      el.textContent = line;
    });
  }

  function renderMap(settings) {
    const maps = settings.maps || {};
    document.querySelectorAll("[data-map]").forEach((el) => {
      if (!maps.embed) {
        el.innerHTML = "";
        return;
      }
      el.innerHTML = `<div class="map-frame">
        <iframe src="${S.escapeHtml(maps.embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
                title="${S.escapeHtml(S.t("contact.mapTitle"))}"></iframe>
      </div>`;
    });

    document.querySelectorAll("[data-route-button]").forEach((el) => {
      if (!maps.route) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.setAttribute("href", maps.route);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
      el.textContent = S.t("contact.route");
    });
  }

  function renderContact(settings) {
    const contact = settings.contact || {};
    const rows = [];

    rows.push(
      `<li><span class="label">${S.escapeHtml(S.t("common.address"))}</span><span>${S.escapeHtml(
        addressLine(settings)
      )}</span></li>`
    );

    if (contact.phone) {
      rows.push(
        `<li><span class="label">${S.escapeHtml(S.t("common.phone"))}</span><a href="tel:${S.escapeHtml(
          contact.phone.replace(/\s+/g, "")
        )}">${S.escapeHtml(contact.phone)}</a></li>`
      );
    }
    if (contact.email) {
      rows.push(
        `<li><span class="label">${S.escapeHtml(S.t("common.email"))}</span><a href="mailto:${S.escapeHtml(
          contact.email
        )}">${S.escapeHtml(contact.email)}</a></li>`
      );
    }

    const missing = !contact.phone && !contact.email;

    document.querySelectorAll("[data-contact-details]").forEach((el) => {
      el.innerHTML = `<ul class="detail-list">${rows.join("")}</ul>
        ${missing ? `<p class="info-box" style="margin-top:16px">${S.escapeHtml(S.t("contact.noContact"))}</p>` : ""}`;
    });

    // Schaltflaechen, die eine bestaetigte E-Mail-Adresse benoetigen.
    document.querySelectorAll("[data-mail-button]").forEach((el) => {
      if (contact.email) {
        el.hidden = false;
        el.setAttribute("href", `mailto:${contact.email}`);
      } else {
        el.hidden = true;
      }
    });
  }

  function renderBank(settings) {
    const bank = settings.bank || {};
    const rows = [
      ["donate.accountHolder", bank.accountHolder],
      ["donate.iban", bank.iban],
      ["donate.bic", bank.bic],
      ["donate.bankName", bank.bank],
      ["donate.purpose", bank.purpose]
    ].filter(([, value]) => Boolean(value));

    document.querySelectorAll("[data-bank]").forEach((el) => {
      if (!rows.length) {
        el.innerHTML = `<p class="info-box">${S.escapeHtml(S.t("donate.noBank"))}</p>`;
        return;
      }
      el.innerHTML = `<table class="bank-table"><tbody>${rows
        .map(
          ([key, value]) =>
            `<tr><th scope="row">${S.escapeHtml(S.t(key))}</th><td>${S.escapeHtml(value)}</td></tr>`
        )
        .join("")}</tbody></table>`;
    });

    document.querySelectorAll("[data-donation-link]").forEach((el) => {
      if (settings.donationLink) {
        el.hidden = false;
        el.setAttribute("href", settings.donationLink);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      } else {
        el.hidden = true;
      }
    });
  }

  function renderAll() {
    const settings = S.settings || {};
    renderHeroImage(settings);
    renderAddress(settings);
    renderMap(settings);
    renderContact(settings);
    renderBank(settings);
  }

  S.ready.then(() => {
    renderAll();
    S.onLangChange(renderAll);
  });
})();
