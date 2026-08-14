/* Islamischer Kalender: heutiges Hidschri-Datum, Countdown bis Ramadan und
   die besonderen Tage im islamischen Jahr.

   Die Umrechnung nutzt den im Browser eingebauten Umm-al-Qura-Kalender
   (Intl, Kalender "islamic-umalqura"). Dadurch bleiben die Angaben ohne
   Pflegeaufwand richtig. Gegenprobe mit dem Aushang der Gemeinde:
   Opferfest 27.05.2026 = 10. Dhu l-Hiddscha 1447 – stimmt ueberein.

   Die tatsaechlichen Termine haengen von der Mondsichtung bzw. der Ansage der
   Gemeinde ab. Deshalb sind alle berechneten Tage als "voraussichtlich"
   gekennzeichnet; bestaetigte Termine koennen in content/islamic-days.json
   eingetragen werden und haben Vorrang. */

(function () {
  "use strict";

  const S = window.Site;
  const ZONE = "Europe/Berlin";
  const DAY_MS = 86400000;

  /* Reihenfolge = Reihenfolge im islamischen Jahr. */
  const EVENTS = [
    { id: "newYear", month: 1, day: 1 },
    { id: "ashura", month: 1, day: 10 },
    { id: "isra", month: 7, day: 27 },
    { id: "baraah", month: 8, day: 15 },
    { id: "ramadan", month: 9, day: 1 },
    { id: "laylatAlQadr", month: 9, day: 27 },
    { id: "eidFitr", month: 10, day: 1, days: 3 },
    { id: "hajj", month: 12, day: 8, days: 6 },
    { id: "arafah", month: 12, day: 9 },
    { id: "eidAdha", month: 12, day: 10, days: 4 }
  ];

  let overrides = null;

  /* ---------- Umrechnung ---------- */

  const partsFormatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: ZONE
  });

  function hijriParts(date) {
    const parts = partsFormatter.formatToParts(date);
    const value = (type) => parts.find((part) => part.type === type).value;
    return { day: Number(value("day")), month: Number(value("month")), year: parseInt(value("year"), 10) };
  }

  function formatHijri(date, locale) {
    try {
      return new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: ZONE
      }).format(date);
    } catch {
      const h = hijriParts(date);
      return `${h.day}.${h.month}.${h.year}`;
    }
  }

  /** Mitternacht (Ortszeit) des heutigen Tages – Basis fuer alle Tagesabstaende. */
  function today() {
    const iso = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date());
    return new Date(`${iso}T00:00:00Z`);
  }

  function toIso(date) {
    return date.toISOString().slice(0, 10);
  }

  /** Naechstes Vorkommen eines islamischen Datums ab heute. */
  function nextOccurrence(month, day, from) {
    let cursor = from || today();
    for (let i = 0; i < 1200; i++) {
      const h = hijriParts(cursor);
      if (h.month === month && h.day === day) return cursor;
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    return null;
  }

  function daysUntil(date) {
    return Math.round((date.getTime() - today().getTime()) / DAY_MS);
  }

  /* ---------- Termine ---------- */

  function overrideFor(id) {
    if (!overrides) return null;
    const entry = overrides[id];
    if (!entry || !entry.date) return null;
    return entry;
  }

  function upcoming() {
    const list = [];

    EVENTS.forEach((event) => {
      const override = overrideFor(event.id);
      const date = override ? new Date(`${override.date}T00:00:00Z`) : nextOccurrence(event.month, event.day);
      if (!date || Number.isNaN(date.getTime())) return;

      const length = event.days || 1;
      const remaining = daysUntil(date);
      // Mehrtaegige Zeiten (Hadsch, Feste) bleiben bis zum letzten Tag sichtbar.
      if (remaining + length - 1 < 0) return;

      list.push({
        id: event.id,
        date,
        iso: toIso(date),
        days: remaining,
        running: remaining <= 0 && remaining + length - 1 >= 0,
        confirmed: Boolean(override && override.confirmed)
      });
    });

    return list.sort((a, b) => a.date - b.date);
  }

  function ramadan() {
    return upcoming().find((entry) => entry.id === "ramadan") || null;
  }

  /* ---------- Ausgabe ---------- */

  function renderHijriDate() {
    document.querySelectorAll("[data-hijri-date]").forEach((el) => {
      const locale = S.t("meta.locale", "de-DE").split("-")[0];
      el.textContent = formatHijri(new Date(), locale);
    });
  }

  function renderRamadanCountdown() {
    const hosts = document.querySelectorAll("[data-ramadan-countdown]");
    if (!hosts.length) return;

    const entry = ramadan();
    hosts.forEach((host) => {
      if (!entry) {
        host.innerHTML = "";
        return;
      }

      const running = entry.days <= 0;
      host.innerHTML = `<div class="countdown-card">
        <div>
          <div class="countdown-card__label">${S.escapeHtml(
            running ? S.t("islamic.ramadanRunning") : S.t("islamic.untilRamadan")
          )}</div>
          <div class="countdown-card__title">${S.escapeHtml(S.t("islamic.ramadan"))}</div>
          <div class="countdown-card__date">${S.dateStack(
            entry.iso,
            entry.confirmed ? "" : S.t("islamic.approx")
          )}</div>
        </div>
        ${
          running
            ? ""
            : `<div class="countdown-card__value">
                 <span class="countdown-card__number">${entry.days}</span>
                 <span class="countdown-card__unit">${S.escapeHtml(S.t("islamic.days"))}</span>
               </div>`
        }
      </div>`;
    });
  }

  function renderDayList() {
    const hosts = document.querySelectorAll("[data-islamic-days]");
    if (!hosts.length) return;

    const list = upcoming();
    hosts.forEach((host) => {
      const limit = Number(host.getAttribute("data-limit")) || list.length;
      const items = list.slice(0, limit);

      if (!items.length) {
        host.innerHTML = "";
        return;
      }

      host.innerHTML = `<ul class="day-list">${items
        .map((entry) => {
          const badge = entry.running
            ? `<span class="day-list__badge day-list__badge--now">${S.escapeHtml(S.t("islamic.now"))}</span>`
            : `<span class="day-list__badge">${S.escapeHtml(S.t("islamic.inDays").replace("{n}", entry.days))}</span>`;

          return `<li class="day-list__item">
            <div class="day-list__main">
              <span class="day-list__name">${S.escapeHtml(S.t(`islamic.${entry.id}`))}</span>
              <span class="day-list__date">${S.dateStack(
                entry.iso,
                entry.confirmed ? "" : S.t("islamic.approx")
              )}</span>
              <span class="day-list__text">${S.escapeHtml(S.t(`islamicInfo.${entry.id}`, ""))}</span>
            </div>
            ${badge}
          </li>`;
        })
        .join("")}</ul>
      <p class="day-list__note">${S.escapeHtml(S.t("islamic.note"))}</p>`;
    });
  }

  function renderAll() {
    renderHijriDate();
    renderRamadanCountdown();
    renderDayList();
  }

  S.ready
    .then(() => S.loadJson("content/islamic-days.json"))
    .then((json) => {
      overrides = (json && json.confirmed) || null;
    })
    .catch(() => {
      overrides = null;
    })
    .finally(() => {
      renderAll();
      S.onLangChange(renderAll);
    });
})();
