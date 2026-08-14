/* Neuigkeiten, Veranstaltungen und Kurse – alle Inhalte kommen aus /content/*.json.
   Neue Eintraege werden dort ergaenzt, ohne dass Code geaendert werden muss. */

(function () {
  "use strict";

  const S = window.Site;
  const cache = {};

  async function content(name) {
    if (!cache[name]) cache[name] = S.loadJson(`content/${name}.json`);
    try {
      const json = await cache[name];
      return Array.isArray(json.items) ? json.items : [];
    } catch (error) {
      console.error(`content/${name}.json konnte nicht geladen werden.`, error);
      return [];
    }
  }

  function demoBadge(item) {
    return item && item.demo ? `<span class="badge">${S.escapeHtml(S.t("common.demo"))}</span>` : "";
  }

  function media(item) {
    if (!item.image) return "";
    return `<div class="entry-card__media"><img src="${S.escapeHtml(item.image)}" alt="${S.escapeHtml(
      S.field(item.title)
    )}" loading="lazy"></div>`;
  }

  function emptyState(text) {
    return `<div class="empty-state"><div class="empty-state__icon" aria-hidden="true">📄</div><p>${S.escapeHtml(
      text
    )}</p></div>`;
  }

  function byDateDesc(a, b) {
    return String(b.date || "").localeCompare(String(a.date || ""));
  }

  function todayIso() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  }

  /* ---------- Neuigkeiten ---------- */

  function newsCard(item) {
    return `<article class="entry-card">
      ${media(item)}
      <div class="entry-card__body">
        <div class="entry-card__meta">
          <time datetime="${S.escapeHtml(item.date || "")}">${S.dateStack(item.date)}</time>
          ${demoBadge(item)}
        </div>
        <h3 class="entry-card__title">${S.escapeHtml(S.field(item.title))}</h3>
        <p class="entry-card__text">${S.escapeHtml(S.field(item.excerpt) || S.field(item.body).slice(0, 160))}</p>
        <div class="entry-card__foot">
          <a class="btn btn--outline" href="neuigkeiten.html?id=${encodeURIComponent(item.id)}">${S.escapeHtml(
            S.t("news.readMore")
          )}</a>
        </div>
      </div>
    </article>`;
  }

  async function renderNews(host) {
    const mode = host.getAttribute("data-news");
    const items = (await content("news")).slice().sort(byDateDesc);
    const selectedId = new URLSearchParams(location.search).get("id");

    if (mode === "detail") {
      if (!selectedId) {
        host.innerHTML = "";
        return;
      }
      const item = items.find((entry) => entry.id === selectedId);
      const list = document.querySelector('[data-news="list"]');
      if (list) list.hidden = true;
      const head = document.querySelector("[data-news-listhead]");
      if (head) head.hidden = true;

      if (!item) {
        host.innerHTML = `${emptyState(S.t("news.notFound"))}
          <p style="margin-top:16px"><a class="btn btn--outline" href="neuigkeiten.html">${S.escapeHtml(
            S.t("news.backToList")
          )}</a></p>`;
        return;
      }

      host.innerHTML = `<article class="prose">
        <div class="entry-card__meta" style="margin-bottom:8px">
          <time datetime="${S.escapeHtml(item.date || "")}">${S.dateStack(item.date)}</time>
          ${demoBadge(item)}
        </div>
        <h1>${S.escapeHtml(S.field(item.title))}</h1>
        ${
          item.image
            ? `<img src="${S.escapeHtml(item.image)}" alt="${S.escapeHtml(
                S.field(item.title)
              )}" style="border-radius:16px;margin-bottom:18px">`
            : ""
        }
        ${S.paragraphs(S.field(item.body) || S.field(item.excerpt))}
        <p style="margin-top:24px"><a class="btn btn--outline" href="neuigkeiten.html">${S.escapeHtml(
          S.t("news.backToList")
        )}</a></p>
      </article>`;
      document.title = `${S.field(item.title)} – ${S.t("site.title")}`;
      return;
    }

    if (mode === "list" && selectedId) {
      host.hidden = true;
      return;
    }

    const limit = Number(host.getAttribute("data-limit")) || items.length;
    const visible = items.slice(0, limit);

    host.innerHTML = visible.length
      ? `<div class="grid grid--3">${visible.map(newsCard).join("")}</div>`
      : emptyState(S.t("news.empty"));
  }

  /* ---------- Veranstaltungen ---------- */

  function eventCard(item) {
    const place = S.field(item.location);

    return `<article class="entry-card">
      ${media(item)}
      <div class="entry-card__body">
        <div class="entry-card__meta"><time datetime="${S.escapeHtml(item.date || "")}">${S.dateStack(
          item.date,
          item.time ? `${item.time} ${S.t("common.oclock", "")}`.trim() : ""
        )}</time>${demoBadge(item)}</div>
        <h3 class="entry-card__title">${S.escapeHtml(S.field(item.title))}</h3>
        ${
          place
            ? `<ul class="detail-list"><li><span class="label">${S.escapeHtml(
                S.t("events.where")
              )}</span><span>${S.escapeHtml(place)}</span></li></ul>`
            : ""
        }
        <p class="entry-card__text">${S.escapeHtml(S.field(item.description))}</p>
        <div class="entry-card__foot">
          ${S.icsButton({
            uid: item.id,
            date: item.date,
            time: item.time,
            title: S.field(item.title),
            location: place,
            description: S.field(item.description)
          })}
        </div>
      </div>
    </article>`;
  }

  async function renderEvents(host) {
    const items = await content("events");
    const today = todayIso();

    const upcoming = items
      .filter((item) => String(item.endDate || item.date || "") >= today)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const past = items.filter((item) => String(item.endDate || item.date || "") < today).sort(byDateDesc);

    const blocks = [];
    blocks.push(`<h2>${S.escapeHtml(S.t("events.upcoming"))}</h2>`);
    blocks.push(
      upcoming.length ? `<div class="grid grid--2">${upcoming.map(eventCard).join("")}</div>` : emptyState(S.t("events.empty"))
    );
    if (past.length) {
      blocks.push(`<h2 style="margin-top:38px">${S.escapeHtml(S.t("events.past"))}</h2>`);
      blocks.push(`<div class="grid grid--2">${past.map(eventCard).join("")}</div>`);
    }
    host.innerHTML = blocks.join("");
  }

  /* ---------- Kurse ---------- */

  function detailRow(labelKey, value) {
    if (!value) return "";
    return `<li><span class="label">${S.escapeHtml(S.t(labelKey))}</span><span>${S.escapeHtml(value)}</span></li>`;
  }

  function courseCard(item) {
    const rows = [
      detailRow("courses.ageGroup", S.field(item.ageGroup)),
      detailRow("courses.days", S.field(item.days)),
      detailRow("courses.time", item.time),
      detailRow("courses.location", S.field(item.location)),
      detailRow("courses.registration", S.field(item.registration))
    ]
      .filter(Boolean)
      .join("");

    return `<article class="entry-card">
      ${media(item)}
      <div class="entry-card__body">
        <h3 class="entry-card__title">${S.escapeHtml(S.field(item.title))}</h3>
        ${
          S.field(item.description)
            ? `<p class="entry-card__text">${S.escapeHtml(S.field(item.description))}</p>`
            : ""
        }
        ${rows ? `<ul class="detail-list">${rows}</ul>` : ""}
        ${
          item.registrationLink
            ? `<div class="entry-card__foot"><a class="btn btn--outline" href="${S.escapeHtml(
                item.registrationLink
              )}">${S.escapeHtml(S.t("courses.registerLink"))}</a></div>`
            : ""
        }
      </div>
    </article>`;
  }

  async function renderCourses(host) {
    const items = await content("courses");
    host.innerHTML = items.length
      ? `<div class="grid grid--2">${items.map(courseCard).join("")}</div>`
      : `<div class="empty-state">
           <div class="empty-state__icon" aria-hidden="true">📚</div>
           <p>${S.escapeHtml(S.t("courses.empty"))}</p>
           <a class="btn btn--outline" href="kontakt.html">${S.escapeHtml(S.t("courses.emptyCta"))}</a>
         </div>`;
  }

  /* ---------- Start ---------- */

  function renderAll() {
    document.querySelectorAll("[data-news]").forEach(renderNews);
    document.querySelectorAll("[data-events]").forEach(renderEvents);
    document.querySelectorAll("[data-courses]").forEach(renderCourses);
  }

  S.ready.then(() => {
    renderAll();
    S.onLangChange(renderAll);
  });
})();
