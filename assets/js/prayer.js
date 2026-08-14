/* Gebetszeiten – Quelle ist ausschliesslich data/prayer-times.json,
   die automatisch von Mawaqit (ID 27703) befuellt wird. Keine Zeiten im Code. */

(function () {
  "use strict";

  const S = window.Site;
  const ORDER = ["fajr", "shuruq", "dhuhr", "asr", "maghrib", "isha"];
  const COUNTDOWN_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  let data = null;
  let timer = null;

  /* ---------- Zeit-Hilfen (immer Ortszeit der Moschee) ---------- */

  function zoneNow() {
    const zone = (data && data.timezone) || "Europe/Berlin";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(new Date());

    const value = (type) => Number(parts.find((part) => part.type === type).value);
    const hour = value("hour") % 24;
    return {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      seconds: hour * 3600 + value("minute") * 60 + value("second")
    };
  }

  function toMinutes(time) {
    if (typeof time !== "string") return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function toTime(minutes) {
    const total = ((minutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  /* ---------- Daten ---------- */

  function dayTimes(month, day) {
    if (data && data.calendar) {
      const entry = data.calendar[String(month)] && data.calendar[String(month)][String(day)];
      if (entry) return entry;
    }
    const now = zoneNow();
    if (data && data.today && month === now.month && day === now.day) return data.today;
    return null;
  }

  function iqamaFor(month, day) {
    if (data && data.iqamaCalendar) {
      const entry = data.iqamaCalendar[String(month)] && data.iqamaCalendar[String(month)][String(day)];
      if (entry) return entry;
    }
    return (data && data.iqamaToday) || null;
  }

  /** Iqama ist entweder ein Offset ("+10") oder eine feste Uhrzeit ("13:30"). */
  function iqamaTime(value, adhanMinutes) {
    if (!value) return null;
    const fixed = toMinutes(value);
    if (fixed != null) return toTime(fixed);
    const offset = Number(String(value).replace("+", ""));
    if (Number.isFinite(offset) && adhanMinutes != null) return toTime(adhanMinutes + offset);
    return null;
  }

  function imsakTime(times) {
    if (!data || !data.imsakOffsetMinutes || !times) return null;
    const fajr = toMinutes(times.fajr);
    return fajr == null ? null : toTime(fajr - data.imsakOffsetMinutes);
  }

  function hasTimes() {
    const now = zoneNow();
    return Boolean(dayTimes(now.month, now.day));
  }

  /** Naechstes Gebet – faellt nach Isha automatisch auf den Fajr des Folgetages. */
  function nextPrayer() {
    const now = zoneNow();
    const today = dayTimes(now.month, now.day);
    if (!today) return null;

    for (const key of COUNTDOWN_KEYS) {
      const minutes = toMinutes(today[key]);
      if (minutes != null && minutes * 60 > now.seconds) {
        return { key, time: today[key], seconds: minutes * 60 - now.seconds };
      }
    }

    const tomorrow = new Date(Date.UTC(now.year, now.month - 1, now.day + 1));
    const next = dayTimes(tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate()) || today;
    const fajr = toMinutes(next.fajr);
    if (fajr == null) return null;
    return { key: "fajr", time: next.fajr, seconds: 86400 - now.seconds + fajr * 60, tomorrow: true };
  }

  function currentPrayerKey() {
    const now = zoneNow();
    const today = dayTimes(now.month, now.day);
    if (!today) return null;
    let current = null;
    for (const key of COUNTDOWN_KEYS) {
      const minutes = toMinutes(today[key]);
      if (minutes != null && minutes * 60 <= now.seconds) current = key;
    }
    return current;
  }

  /* ---------- Bausteine ---------- */

  function timesGrid(options) {
    const now = zoneNow();
    const times = dayTimes(now.month, now.day);
    if (!times) return "";

    const iqama = options.showIqama ? iqamaFor(now.month, now.day) : null;
    const active = currentPrayerKey();
    const cells = [];

    const imsak = options.showImsak ? imsakTime(times) : null;
    if (imsak) {
      cells.push(cell("imsak", S.t("prayer.imsak"), imsak, false, null));
    }

    ORDER.forEach((key) => {
      if (!times[key]) return;
      const iqamaValue = iqama && iqama[key] ? iqamaTime(iqama[key], toMinutes(times[key])) : null;
      cells.push(cell(key, S.t(`prayer.${key}`), times[key], key === active, iqamaValue));
    });

    return `<div class="times-grid">${cells.join("")}</div>`;
  }

  function cell(key, name, time, isActive, iqama) {
    return `<div class="time-cell" data-active="${isActive ? "true" : "false"}" data-prayer="${key}">
      <div class="time-cell__name">${S.escapeHtml(name)}</div>
      <div class="time-cell__value">${S.escapeHtml(time)}</div>
      ${iqama ? `<div class="time-cell__iqama">${S.escapeHtml(S.t("prayer.iqama"))} ${S.escapeHtml(iqama)}</div>` : ""}
    </div>`;
  }

  function jumuaBox() {
    if (!data) return "";
    const now = zoneNow();
    const times = dayTimes(now.month, now.day);

    let value = "";
    if (Array.isArray(data.jumua) && data.jumua.length) {
      value = data.jumua.join(" · ");
    } else if (data.jumuaAsDuhr && times && times.dhuhr) {
      value = times.dhuhr;
    }
    if (!value) return "";

    return `<div class="jumua-box">
      <div>
        <div class="jumua-box__label">${S.escapeHtml(S.t("prayer.jumua"))}</div>
        ${data.jumuaAsDuhr ? `<div style="font-size:0.85rem;opacity:0.85">${S.escapeHtml(S.t("prayer.jumuaAsDuhr"))}</div>` : ""}
      </div>
      <div class="jumua-box__time">${S.escapeHtml(value)}</div>
    </div>`;
  }

  function countdownBlock(next) {
    const hours = Math.floor(next.seconds / 3600);
    const minutes = Math.floor((next.seconds % 3600) / 60);
    const seconds = next.seconds % 60;
    const pad = (n) => String(n).padStart(2, "0");

    return `<div class="next-prayer">
      <div>
        <div class="next-prayer__label">${S.escapeHtml(S.t("home.nextPrayer"))}</div>
        <div class="next-prayer__name">${S.escapeHtml(S.t(`prayer.${next.key}`))}</div>
        <div class="next-prayer__time">${S.escapeHtml(next.time)}</div>
      </div>
      <div class="countdown" data-countdown>
        <div class="countdown__cell"><div class="countdown__value" data-cd-h>${pad(hours)}</div><div class="countdown__unit">h</div></div>
        <div class="countdown__cell"><div class="countdown__value" data-cd-m>${pad(minutes)}</div><div class="countdown__unit">min</div></div>
        <div class="countdown__cell"><div class="countdown__value" data-cd-s>${pad(seconds)}</div><div class="countdown__unit">sek</div></div>
      </div>
    </div>`;
  }

  function unavailableBox() {
    const url = (data && data.url) || "https://mawaqit.net/de/27703";
    return `<div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">🕌</div>
      <p>${S.escapeHtml(S.t("prayer.unavailable"))}</p>
      <a class="btn btn--outline" href="${S.escapeHtml(url)}" target="_blank" rel="noopener">${S.escapeHtml(
        S.t("prayer.sourceLink")
      )}</a>
    </div>`;
  }

  function sourceFoot() {
    const url = (data && data.url) || "https://mawaqit.net/de/27703";
    const updated = data && data.updatedAt ? new Date(data.updatedAt) : null;
    let updatedText = "";
    if (updated && !Number.isNaN(updated.getTime())) {
      updatedText = `${S.t("prayer.updated")}: ${updated.toLocaleDateString(S.t("meta.locale", "de-DE"))}`;
    }
    return `<div class="panel-foot">
      <span>${S.escapeHtml(S.t("prayer.note"))}</span>
      <span>
        ${updatedText ? `${S.escapeHtml(updatedText)} · ` : ""}
        <a href="${S.escapeHtml(url)}" target="_blank" rel="noopener">${S.escapeHtml(S.t("prayer.source"))}</a>
      </span>
    </div>`;
  }

  /* ---------- Countdown ---------- */

  function startTimer(container) {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const box = container.querySelector("[data-countdown]");
      if (!box) return;
      const next = nextPrayer();
      if (!next) return;

      if (next.seconds <= 1) {
        render(container);
        return;
      }
      const pad = (n) => String(n).padStart(2, "0");
      box.querySelector("[data-cd-h]").textContent = pad(Math.floor(next.seconds / 3600));
      box.querySelector("[data-cd-m]").textContent = pad(Math.floor((next.seconds % 3600) / 60));
      box.querySelector("[data-cd-s]").textContent = pad(next.seconds % 60);
    }, 1000);
  }

  /* ---------- Monatsuebersicht ---------- */

  function monthTable() {
    if (!data || !data.calendar) return "";
    const now = zoneNow();
    const month = data.calendar[String(now.month)];
    if (!month) return "";

    const head = ["prayer.day", "prayer.fajr", "prayer.shuruq", "prayer.dhuhr", "prayer.asr", "prayer.maghrib", "prayer.isha"]
      .map((key) => `<th>${S.escapeHtml(S.t(key))}</th>`)
      .join("");

    const rows = Object.keys(month)
      .map(Number)
      .sort((a, b) => a - b)
      .map((day) => {
        const times = month[String(day)];
        const cells = ORDER.map((key) => `<td>${S.escapeHtml(times[key] || "–")}</td>`).join("");
        return `<tr data-today="${day === now.day ? "true" : "false"}"><td>${day}</td>${cells}</tr>`;
      })
      .join("");

    return `<h2 style="margin-top:34px">${S.escapeHtml(S.t("prayer.monthTitle"))}</h2>
      <div class="month-table-wrap"><table class="month-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /* ---------- Ausgabe ---------- */

  function render(container) {
    const mode = container.getAttribute("data-prayer") || "compact";
    const full = mode === "full";

    if (!hasTimes()) {
      container.innerHTML = unavailableBox();
      return;
    }

    const next = nextPrayer();
    const parts = [
      `<div class="card">`,
      next ? countdownBlock(next) : "",
      `<h2 class="sr-only">${S.escapeHtml(S.t("home.todayTimes"))}</h2>`,
      timesGrid({ showIqama: full, showImsak: full }),
      jumuaBox(),
      full ? sourceFoot() : "",
      `</div>`
    ];

    if (!full) {
      parts.push(
        `<p style="margin-top:16px"><a class="btn btn--outline" href="gebetszeiten.html">${S.escapeHtml(
          S.t("home.allTimes")
        )}</a></p>`
      );
    } else {
      parts.push(monthTable());
    }

    container.innerHTML = parts.join("");
    startTimer(container);
  }

  function renderAll() {
    document.querySelectorAll("[data-prayer]").forEach(render);
  }

  S.ready
    .then(() => S.loadJson("data/prayer-times.json"))
    .then((json) => {
      data = json && json.pending ? { ...json, calendar: null, today: null } : json;
    })
    .catch((error) => {
      console.error("Gebetszeiten konnten nicht geladen werden.", error);
      data = null;
    })
    .finally(() => {
      renderAll();
      S.onLangChange(renderAll);
    });
})();
