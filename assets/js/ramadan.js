/* Ramadan: Countdown bis zum Iftar bzw. bis zum Ende des Sahur und die
   Imsakiya (Tabelle fuer den ganzen Monat).

   Grundlage sind dieselben Gebetszeiten wie ueberall auf der Website:
   data/prayer-times.json, automatisch von Mawaqit befuellt. Es werden keine
   Zeiten gerechnet oder geschaetzt – fehlen die Daten, sagt die Seite das. */

(function () {
  "use strict";

  const S = window.Site;
  const ZONE = "Europe/Berlin";
  const DAY_MS = 86400000;

  /* Ramadan-Bereich auf der Startseite: ab 30 Tagen vor Beginn sichtbar. */
  const LEAD_DAYS = 30;

  let data = null;
  let timer = null;

  const hijriNumbers = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: ZONE
  });

  function hijriParts(date) {
    const parts = hijriNumbers.formatToParts(date);
    const value = (type) => parts.find((part) => part.type === type).value;
    return { day: Number(value("day")), month: Number(value("month")), year: parseInt(value("year"), 10) };
  }

  function zoneNow() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(new Date());
    const value = (type) => Number(parts.find((part) => part.type === type).value);
    return {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      seconds: (value("hour") % 24) * 3600 + value("minute") * 60 + value("second")
    };
  }

  function toMinutes(time) {
    if (typeof time !== "string") return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function toTime(minutes) {
    const total = ((minutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function dayTimes(date) {
    if (!data || !data.calendar) return null;
    const month = data.calendar[String(date.getUTCMonth() + 1)];
    return (month && month[String(date.getUTCDate())]) || null;
  }

  /** Imsak = Fajr minus dem in Mawaqit hinterlegten Vorlauf; sonst Fajr selbst. */
  function imsakOf(times) {
    if (!times) return null;
    const fajr = toMinutes(times.fajr);
    if (fajr == null) return null;
    return data && data.imsakOffsetMinutes ? toTime(fajr - data.imsakOffsetMinutes) : times.fajr;
  }

  /* ---------- Zeitraum des Ramadan ---------- */

  /** Erster Tag des naechsten (oder laufenden) Ramadan. */
  function ramadanStart() {
    const now = zoneNow();
    let cursor = new Date(Date.UTC(now.year, now.month - 1, now.day, 12));

    // Laeuft der Ramadan bereits, zum ersten Tag zurueckgehen.
    if (hijriParts(cursor).month === 9) {
      while (hijriParts(cursor).day !== 1) {
        cursor = new Date(cursor.getTime() - DAY_MS);
      }
      return cursor;
    }

    for (let i = 0; i < 400; i++) {
      const h = hijriParts(cursor);
      if (h.month === 9 && h.day === 1) return cursor;
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    return null;
  }

  /** Alle Tage des Ramadan als Liste von Datumsobjekten. */
  function ramadanDays(start) {
    const days = [];
    let cursor = start;
    for (let i = 0; i < 31; i++) {
      if (hijriParts(cursor).month !== 9) break;
      days.push(cursor);
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    return days;
  }

  function daysUntil(date) {
    const now = zoneNow();
    const today = Date.UTC(now.year, now.month - 1, now.day);
    return Math.round((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - today) / DAY_MS);
  }

  /* ---------- Countdown auf der Startseite ---------- */

  /**
   * Waehrend des Tages laeuft die Uhr auf den Iftar (Maghrib),
   * nach dem Iftar auf das Ende des Sahur (Imsak) am naechsten Morgen.
   */
  function currentTarget() {
    const now = zoneNow();
    const todayDate = new Date(Date.UTC(now.year, now.month - 1, now.day));
    const times = dayTimes(todayDate);
    if (!times) return null;

    const imsak = toMinutes(imsakOf(times));
    const maghrib = toMinutes(times.maghrib);

    if (imsak != null && now.seconds < imsak * 60) {
      return { key: "sahur", time: imsakOf(times), seconds: imsak * 60 - now.seconds };
    }
    if (maghrib != null && now.seconds < maghrib * 60) {
      return { key: "iftar", time: times.maghrib, seconds: maghrib * 60 - now.seconds };
    }

    const tomorrow = new Date(todayDate.getTime() + DAY_MS);
    const next = dayTimes(tomorrow);
    const nextImsak = next ? toMinutes(imsakOf(next)) : null;
    if (nextImsak == null) return null;
    return { key: "sahur", time: imsakOf(next), seconds: 86400 - now.seconds + nextImsak * 60 };
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function countdownMarkup(target) {
    const hours = Math.floor(target.seconds / 3600);
    const minutes = Math.floor((target.seconds % 3600) / 60);
    const seconds = target.seconds % 60;

    return `<div class="ramadan-card">
      <div>
        <div class="ramadan-card__label">${S.escapeHtml(
          S.t(target.key === "iftar" ? "ramadan.untilIftar" : "ramadan.untilSahur")
        )}</div>
        <div class="ramadan-card__title">${S.escapeHtml(
          S.t(target.key === "iftar" ? "ramadan.iftar" : "ramadan.sahur")
        )} · ${S.escapeHtml(target.time)}</div>
      </div>
      <div class="countdown" data-ramadan-clock>
        <div class="countdown__cell"><div class="countdown__value" data-cd-h>${pad(hours)}</div><div class="countdown__unit">h</div></div>
        <div class="countdown__cell"><div class="countdown__value" data-cd-m>${pad(minutes)}</div><div class="countdown__unit">min</div></div>
        <div class="countdown__cell"><div class="countdown__value" data-cd-s>${pad(seconds)}</div><div class="countdown__unit">sek</div></div>
      </div>
    </div>`;
  }

  function renderHomeBox() {
    const hosts = document.querySelectorAll("[data-ramadan-box]");
    if (!hosts.length) return;

    const start = ramadanStart();
    if (!start) {
      hosts.forEach((host) => (host.innerHTML = ""));
      return;
    }

    const untilStart = daysUntil(start);
    const running = hijriParts(new Date()).month === 9;

    // Ausserhalb des Ramadan und der 30 Tage davor bleibt der Bereich leer.
    if (!running && untilStart > LEAD_DAYS) {
      hosts.forEach((host) => (host.innerHTML = ""));
      return;
    }

    const target = running ? currentTarget() : null;
    const link = `<p style="margin-top: 14px">
        <a class="btn btn--outline" href="ramadan.html">${S.escapeHtml(S.t("ramadan.linkCta"))}</a>
      </p>`;

    hosts.forEach((host) => {
      host.innerHTML = `<h2>${S.escapeHtml(S.t("ramadan.title"))}</h2>
        ${target ? countdownMarkup(target) : `<p>${S.escapeHtml(S.t("ramadan.linkText"))}</p>`}
        ${link}`;
    });

    startTimer();
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const clock = document.querySelector("[data-ramadan-clock]");
      if (!clock) return;
      const target = currentTarget();
      if (!target) return;
      if (target.seconds <= 1) {
        renderHomeBox();
        return;
      }
      clock.querySelector("[data-cd-h]").textContent = pad(Math.floor(target.seconds / 3600));
      clock.querySelector("[data-cd-m]").textContent = pad(Math.floor((target.seconds % 3600) / 60));
      clock.querySelector("[data-cd-s]").textContent = pad(target.seconds % 60);
    }, 1000);
  }

  /* ---------- Imsakiya ---------- */

  function renderImsakiya() {
    const hosts = document.querySelectorAll("[data-imsakiya]");
    if (!hosts.length) return;

    const start = ramadanStart();
    if (!start) {
      hosts.forEach((host) => (host.innerHTML = ""));
      return;
    }

    const days = ramadanDays(start);
    const year = hijriParts(start).year;
    const now = zoneNow();
    const rows = [];

    days.forEach((date) => {
      const times = dayTimes(date);
      if (!times) return;

      const hijri = hijriParts(date);
      const gregorian = new Intl.DateTimeFormat(S.t("meta.locale", "de-DE"), {
        day: "numeric",
        month: "short",
        weekday: "short",
        timeZone: "UTC"
      }).format(date);
      const isToday =
        date.getUTCFullYear() === now.year && date.getUTCMonth() + 1 === now.month && date.getUTCDate() === now.day;

      rows.push(`<tr data-today="${isToday ? "true" : "false"}">
        <td>
          <span class="date-stack">
            <span class="date-stack__main">${hijri.day}. ${S.escapeHtml(S.t("ramadan.day"))}</span>
            <span class="date-stack__sub">${S.escapeHtml(gregorian)}</span>
          </span>
        </td>
        <td>${S.escapeHtml(imsakOf(times) || "–")}</td>
        <td>${S.escapeHtml(times.fajr || "–")}</td>
        <td>${S.escapeHtml(times.maghrib || "–")}</td>
      </tr>`);
    });

    const title = S.t("ramadan.imsakiyaTitle").replace("{year}", year);

    hosts.forEach((host) => {
      if (!rows.length) {
        const text = data
          ? S.t("ramadan.notYet").replace("{date}", S.formatHijri(start) || "")
          : S.t("ramadan.unavailable");
        host.innerHTML = `<div class="empty-state"><div class="empty-state__icon" aria-hidden="true">🌙</div>
          <p>${S.escapeHtml(text)}</p></div>`;
        return;
      }

      host.innerHTML = `<div class="print-doc">
        <h2>${S.escapeHtml(title)}</h2>
        <div class="month-table-wrap">
          <table class="month-table">
            <thead><tr>
              <th>${S.escapeHtml(S.t("ramadan.day"))}</th>
              <th>${S.escapeHtml(S.t("prayer.imsak"))}</th>
              <th>${S.escapeHtml(S.t("ramadan.fajr"))}</th>
              <th>${S.escapeHtml(S.t("ramadan.iftar"))}</th>
            </tr></thead>
            <tbody>${rows.join("")}</tbody>
          </table>
        </div>
      </div>
      <p style="margin-top: 16px" class="no-print">
        <button type="button" class="btn btn--outline" data-print-imsakiya>${S.escapeHtml(
          S.t("ramadan.print")
        )}</button>
      </p>`;

      const button = host.querySelector("[data-print-imsakiya]");
      if (button) button.addEventListener("click", () => window.print());
    });
  }

  function renderAll() {
    renderHomeBox();
    renderImsakiya();
  }

  S.ready
    .then(() => S.loadJson("data/prayer-times.json"))
    .then((json) => {
      data = json && json.pending ? null : json;
    })
    .catch(() => {
      data = null;
    })
    .finally(() => {
      renderAll();
      S.onLangChange(renderAll);
    });
})();
