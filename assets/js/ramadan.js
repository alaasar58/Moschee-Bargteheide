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

  /* Spalten der Imsakiya: der ganze Tag auf einen Blick.
     Imsak und Iftar sind farbig hervorgehoben. */
  const COLUMNS = [
    { key: "imsak", label: "prayer.imsak", tone: "imsak" },
    { key: "fajr", label: "ramadan.fajr" },
    { key: "shuruq", label: "prayer.shuruqShort" },
    { key: "dhuhr", label: "prayer.dhuhr" },
    { key: "asr", label: "prayer.asr" },
    { key: "maghrib", label: "ramadan.iftarShort", tone: "iftar" },
    { key: "isha", label: "prayer.isha" }
  ];

  function valueFor(times, key) {
    if (key === "imsak") return imsakOf(times) || "–";
    return times[key] || "–";
  }

  /** Daten der Imsakiya einmal aufbereiten – fuer Tabelle, Druck und PDF. */
  function imsakiyaModel() {
    const start = ramadanStart();
    if (!start) return null;

    const now = zoneNow();
    const entries = [];

    ramadanDays(start).forEach((date) => {
      const times = dayTimes(date);
      if (!times) return;

      entries.push({
        day: hijriParts(date).day,
        gregorian: new Intl.DateTimeFormat(S.t("meta.locale", "de-DE"), {
          day: "numeric",
          month: "short",
          weekday: "short",
          timeZone: "UTC"
        }).format(date),
        times,
        isToday:
          date.getUTCFullYear() === now.year && date.getUTCMonth() + 1 === now.month && date.getUTCDate() === now.day
      });
    });

    return { start, year: hijriParts(start).year, entries };
  }

  function savePdf(model, title) {
    if (!window.SitePdf) return;

    const rtl = S.lang === "ar";
    // In der Fusszeile die Reihenfolge an die Leserichtung anpassen.
    const footer = [S.t("prayer.note"), S.t("prayer.source")];
    if (rtl) footer.reverse();

    const columns = [{ label: S.t("ramadan.day"), width: 1.6 }].concat(
      COLUMNS.map((column) => ({ label: S.t(column.label), tone: column.tone }))
    );

    const rows = model.entries.map((entry) => ({
      cells: [String(entry.day)].concat(COLUMNS.map((column) => valueFor(entry.times, column.key))),
      sub: [entry.gregorian],
      highlight: entry.isToday
    }));

    window.SitePdf.tableToPdf(
      {
        title,
        subtitle: S.t("site.title"),
        footer: footer.join(" · "),
        rtl,
        columns,
        rows
      },
      `imsakiya-ramadan-${model.year}.pdf`
    );
  }

  function renderImsakiya() {
    const hosts = document.querySelectorAll("[data-imsakiya]");
    if (!hosts.length) return;

    const model = imsakiyaModel();
    if (!model) {
      hosts.forEach((host) => (host.innerHTML = ""));
      return;
    }

    const head = [`<th>${S.escapeHtml(S.t("ramadan.day"))}</th>`]
      .concat(
        COLUMNS.map(
          (column) =>
            `<th${column.tone ? ` data-col="${column.tone}"` : ""}>${S.escapeHtml(S.t(column.label))}</th>`
        )
      )
      .join("");

    const rows = model.entries
      .map((entry) => {
        const cells = COLUMNS.map(
          (column) =>
            `<td${column.tone ? ` data-col="${column.tone}"` : ""}>${S.escapeHtml(
              valueFor(entry.times, column.key)
            )}</td>`
        ).join("");

        return `<tr data-today="${entry.isToday ? "true" : "false"}">
          <td>
            <span class="date-stack">
              <span class="date-stack__main">${entry.day}. ${S.escapeHtml(S.t("ramadan.day"))}</span>
              <span class="date-stack__sub">${S.escapeHtml(entry.gregorian)}</span>
            </span>
          </td>${cells}
        </tr>`;
      })
      .join("");

    const title = S.t("ramadan.imsakiyaTitle").replace("{year}", model.year);

    hosts.forEach((host) => {
      if (!model.entries.length) {
        const text = data
          ? S.t("ramadan.notYet").replace("{date}", S.formatHijri(model.start) || "")
          : S.t("ramadan.unavailable");
        host.innerHTML = `<div class="empty-state"><div class="empty-state__icon" aria-hidden="true">🌙</div>
          <p>${S.escapeHtml(text)}</p></div>`;
        return;
      }

      host.innerHTML = `<div class="print-doc">
        <h2>${S.escapeHtml(title)}</h2>
        <div class="month-table-wrap month-table-wrap--scroll" data-imsakiya-scroll>
          <table class="month-table month-table--compact">
            <thead><tr>${head}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
      <p class="table-tools no-print">
        <button type="button" class="btn btn--outline" data-download-imsakiya>${S.escapeHtml(
          S.t("ramadan.download")
        )}</button>
        <button type="button" class="btn btn--outline" data-print-imsakiya>${S.escapeHtml(
          S.t("ramadan.print")
        )}</button>
      </p>`;

      const printButton = host.querySelector("[data-print-imsakiya]");
      if (printButton) {
        printButton.addEventListener("click", () => {
          const doc = host.querySelector(".print-doc");
          if (window.SitePdf) window.SitePdf.printOnly(doc);
          else window.print();
        });
      }

      const downloadButton = host.querySelector("[data-download-imsakiya]");
      if (downloadButton) downloadButton.addEventListener("click", () => savePdf(model, title));

      // Der heutige Tag steht beim Aufrufen bereits im Kasten sichtbar.
      const box = host.querySelector("[data-imsakiya-scroll]");
      const today = box && box.querySelector('tr[data-today="true"]');
      if (box && today) {
        const headHeight = box.querySelector("thead").getBoundingClientRect().height;
        box.scrollTop = Math.max(0, today.offsetTop - headHeight);
      }
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
