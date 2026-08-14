/* Grundgeruest der Website: Sprachen, Kopf- und Fusszeile, Einstellungen.
   Alle Inhalte kommen aus JSON-Dateien im Ordner /content – dadurch kann die
   Gemeinde Texte, Neuigkeiten, Kurse und Veranstaltungen ohne Programmierung pflegen. */

(function () {
  "use strict";

  const LANGS = ["de", "tr", "ar", "sq"];
  const FALLBACK = "de";
  const STORAGE_KEY = "mb-lang";

  const PAGES = [
    { key: "home", href: "index.html" },
    { key: "prayer", href: "gebetszeiten.html" },
    { key: "courses", href: "kurse.html" },
    { key: "news", href: "neuigkeiten.html" },
    { key: "events", href: "veranstaltungen.html" },
    { key: "about", href: "ueber-uns.html" },
    { key: "contact", href: "kontakt.html" },
    { key: "membership", href: "mitglied-werden.html" },
    { key: "donate", href: "spenden.html" }
  ];

  const state = {
    lang: FALLBACK,
    dict: {},
    settings: {},
    subscribers: []
  };

  /* ---------- Hilfsfunktionen ---------- */

  function get(object, path) {
    return path.split(".").reduce((acc, key) => (acc && acc[key] != null ? acc[key] : null), object);
  }

  function t(key, fallback) {
    const value = get(state.dict, key);
    if (typeof value === "string") return value;
    return fallback != null ? fallback : key;
  }

  /** Mehrsprachiges Feld aus den Inhaltsdateien lesen, mit Rueckfall auf Deutsch. */
  function field(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[state.lang] || value[FALLBACK] || Object.values(value).find(Boolean) || "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  /** Absatzweise Ausgabe von mehrzeiligem Text (kein HTML aus Inhaltsdateien). */
  function paragraphs(text) {
    return String(text || "")
      .split(/\n{2,}/)
      .filter((part) => part.trim())
      .map((part) => `<p>${escapeHtml(part.trim()).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function formatDate(iso) {
    if (!iso) return "";
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    const locale = get(state.dict, "meta.locale") || "de-DE";
    try {
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(date);
    } catch {
      return date.toLocaleDateString("de-DE");
    }
  }


  /* ---------- Datum: Hidschri als Hauptangabe ---------- */

  /** Hidschri-Datum (Umm al-Qura) in der aktuellen Sprache. */
  function formatHijri(iso) {
    const date = iso instanceof Date ? iso : new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return "";
    const locale = (get(state.dict, "meta.locale") || "de-DE").split("-")[0];
    try {
      return new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Berlin"
      }).format(date);
    } catch {
      return "";
    }
  }

  /** Datumsangabe mit dem Hidschri-Datum gross und dem gregorianischen klein darunter. */
  function dateStack(iso, extra) {
    const hijri = formatHijri(iso);
    const gregorian = formatDate(iso);
    if (!hijri) return `<span class="date-stack"><span class="date-stack__main">${escapeHtml(gregorian)}</span></span>`;

    return `<span class="date-stack">
      <span class="date-stack__main">${escapeHtml(hijri)}</span>
      <span class="date-stack__sub">${escapeHtml(gregorian)}${extra ? ` · ${escapeHtml(extra)}` : ""}</span>
    </span>`;
  }

  async function loadJson(path) {
    const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  /* ---------- Sprache ---------- */

  function detectLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl && LANGS.includes(fromUrl)) return fromUrl;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && LANGS.includes(stored)) return stored;
    } catch {
      /* localStorage nicht verfuegbar */
    }

    for (const entry of navigator.languages || [navigator.language || ""]) {
      const code = String(entry).slice(0, 2).toLowerCase();
      if (LANGS.includes(code)) return code;
    }
    return FALLBACK;
  }

  function applyTranslations(root) {
    const scope = root || document;

    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"), el.textContent);
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.getAttribute("data-i18n-attr")
        .split(",")
        .forEach((pair) => {
          const [attr, key] = pair.split(":").map((part) => part.trim());
          if (attr && key) el.setAttribute(attr, t(key));
        });
    });

    const titleKey = document.body.getAttribute("data-page-title-key");
    if (titleKey) {
      document.title = `${t(titleKey)} – ${t("site.title")}`;
    }
  }

  async function setLang(lang, options) {
    const target = LANGS.includes(lang) ? lang : FALLBACK;
    state.dict = await loadJson(`content/i18n/${target}.json`);
    state.lang = target;

    const dir = get(state.dict, "meta.dir") || "ltr";
    document.documentElement.setAttribute("lang", target);
    document.documentElement.setAttribute("dir", dir);
    document.body.setAttribute("dir", dir);

    try {
      localStorage.setItem(STORAGE_KEY, target);
    } catch {
      /* ignorieren */
    }

    renderChrome();
    applyTranslations();

    if (!options || options.notify !== false) {
      state.subscribers.forEach((fn) => {
        try {
          fn(target);
        } catch (error) {
          console.error(error);
        }
      });
    }
  }

  /* ---------- Kopf- und Fusszeile ---------- */

  function currentPage() {
    const file = location.pathname.split("/").pop() || "index.html";
    return file === "" ? "index.html" : file;
  }

  const LOGO = `
    <svg class="brand__mark" viewBox="0 0 48 48" role="img" aria-hidden="true" fill="none"
         stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M24 6c4.6 3.2 7.4 7.4 7.4 12.2 0 2-.5 3.6-1.3 5H17.9c-.8-1.4-1.3-3-1.3-5C16.6 13.4 19.4 9.2 24 6Z"/>
      <path d="M12 42V25.5c0-1.6 1.1-2.3 2.4-2.3h19.2c1.3 0 2.4.7 2.4 2.3V42"/>
      <path d="M8 42h32"/>
      <path d="M20 42v-7a4 4 0 0 1 8 0v7"/>
      <path d="M40 42V22m0-4v-3M8 42V22m0-4v-3"/>
    </svg>`;

  function navItems(activeClassAttr) {
    return PAGES.map((page) => {
      const active = currentPage() === page.href ? ' aria-current="page"' : "";
      return `<li><a class="${activeClassAttr}" href="${page.href}"${active} data-i18n="nav.${page.key}">${escapeHtml(
        t(`nav.${page.key}`)
      )}</a></li>`;
    }).join("");
  }

  function langMenuItems() {
    const meta = {
      de: { flag: "🇩🇪", name: "Deutsch" },
      tr: { flag: "🇹🇷", name: "Türkçe" },
      ar: { flag: "🇸🇦", name: "العربية" },
      sq: { flag: "🇦🇱", name: "Shqip" }
    };
    return LANGS.map((code) => {
      const item = meta[code];
      const current = code === state.lang ? ' aria-current="true"' : "";
      return `<li><button type="button" class="lang__option" data-lang="${code}"${current}>
        <span class="lang__flag" aria-hidden="true">${item.flag}</span><span>${item.name}</span>
      </button></li>`;
    }).join("");
  }

  function renderHeader() {
    const host = document.querySelector("[data-site-header]");
    if (!host) return;

    const flags = { de: "🇩🇪", tr: "🇹🇷", ar: "🇸🇦", sq: "🇦🇱" };
    const showNotice = state.settings.demoNotice !== false;

    host.innerHTML = `
      ${
        showNotice
          ? `<div class="notice-bar"><div class="container"><span data-i18n="banner.demo">${escapeHtml(
              t("banner.demo")
            )}</span></div></div>`
          : ""
      }
      <header class="site-header">
        <div class="container header-inner">
          <a class="brand" href="index.html">
            ${LOGO}
            <span class="brand__text">
              <span class="brand__title" data-i18n="site.title">${escapeHtml(t("site.title"))}</span>
              <span class="brand__sub" data-i18n="site.subtitle">${escapeHtml(t("site.subtitle"))}</span>
            </span>
          </a>

          <nav class="nav" aria-label="Hauptmenü">
            <ul class="nav__list">${navItems("nav__link")}</ul>
          </nav>

          <div class="header-actions">
            <div class="lang">
              <button type="button" class="icon-btn" data-lang-toggle aria-expanded="false" aria-haspopup="true">
                <span aria-hidden="true">${flags[state.lang]}</span>
                <span class="lang__current">${state.lang.toUpperCase()}</span>
                <span class="sr-only" data-i18n="nav.language">${escapeHtml(t("nav.language"))}</span>
              </button>
              <ul class="lang__menu" data-lang-menu>${langMenuItems()}</ul>
            </div>

            <button type="button" class="icon-btn menu-toggle" data-menu-toggle aria-expanded="false">
              <span aria-hidden="true">☰</span>
              <span class="sr-only" data-i18n="nav.menu">${escapeHtml(t("nav.menu"))}</span>
            </button>
          </div>
        </div>

        <div class="mobile-nav" data-mobile-nav>
          <div class="container">
            <ul class="mobile-nav__list">${navItems("")}</ul>
          </div>
        </div>
      </header>`;

    bindHeader(host);
  }

  function bindHeader(host) {
    const langToggle = host.querySelector("[data-lang-toggle]");
    const langMenu = host.querySelector("[data-lang-menu]");
    const menuToggle = host.querySelector("[data-menu-toggle]");
    const mobileNav = host.querySelector("[data-mobile-nav]");

    function closeLang() {
      langMenu.setAttribute("data-open", "false");
      langToggle.setAttribute("aria-expanded", "false");
    }

    langToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = langMenu.getAttribute("data-open") === "true";
      langMenu.setAttribute("data-open", open ? "false" : "true");
      langToggle.setAttribute("aria-expanded", open ? "false" : "true");
    });

    langMenu.addEventListener("click", (event) => {
      const button = event.target.closest("[data-lang]");
      if (!button) return;
      closeLang();
      setLang(button.getAttribute("data-lang"));
    });

    // Nur einmal registrieren – die Kopfzeile wird bei jedem Sprachwechsel neu aufgebaut.
    if (!bindHeader.globalBound) {
      bindHeader.globalBound = true;
      const closeOpenMenu = () => {
        const menu = document.querySelector("[data-lang-menu]");
        const toggle = document.querySelector("[data-lang-toggle]");
        if (!menu || !toggle) return;
        menu.setAttribute("data-open", "false");
        toggle.setAttribute("aria-expanded", "false");
      };
      document.addEventListener("click", closeOpenMenu);
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeOpenMenu();
      });
    }

    menuToggle.addEventListener("click", () => {
      const open = mobileNav.getAttribute("data-open") === "true";
      mobileNav.setAttribute("data-open", open ? "false" : "true");
      menuToggle.setAttribute("aria-expanded", open ? "false" : "true");
    });
  }

  function renderFooter() {
    const host = document.querySelector("[data-site-footer]");
    if (!host) return;

    const address = state.settings.address || {};
    const contact = state.settings.contact || {};
    // Nur verlinken, wenn die Mawaqit-Adresse der Moschee bekannt ist.
    const mawaqitUrl = (state.settings.mawaqit && state.settings.mawaqit.url) || "";

    const contactLines = [
      `${escapeHtml(address.street || "")}`,
      `${escapeHtml(`${address.zip || ""} ${address.city || ""}`.trim())}`
    ].filter(Boolean);

    if (contact.phone) {
      contactLines.push(`<a href="tel:${escapeHtml(contact.phone.replace(/\s+/g, ""))}">${escapeHtml(contact.phone)}</a>`);
    }
    if (contact.email) {
      contactLines.push(`<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>`);
    }

    host.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <h3 data-i18n="site.title">${escapeHtml(t("site.title"))}</h3>
              <p style="font-size:0.93rem;max-width:40ch">${escapeHtml(t("home.aboutText"))}</p>
            </div>
            <div>
              <h3 data-i18n="footer.quickLinks">${escapeHtml(t("footer.quickLinks"))}</h3>
              <ul class="footer-list">${navItems("")}</ul>
            </div>
            <div>
              <h3 data-i18n="footer.contact">${escapeHtml(t("footer.contact"))}</h3>
              <ul class="footer-list">${contactLines.map((line) => `<li>${line}</li>`).join("")}</ul>
              <p style="font-size:0.83rem;margin-top:12px">
                ${
                  mawaqitUrl
                    ? `<a href="${escapeHtml(mawaqitUrl)}" target="_blank" rel="noopener"
                         data-i18n="footer.prayerSource">${escapeHtml(t("footer.prayerSource"))}</a>`
                    : `<span data-i18n="footer.prayerSource">${escapeHtml(t("footer.prayerSource"))}</span>`
                }
              </p>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© ${new Date().getFullYear()} ${escapeHtml(
              state.settings.associationName || "Islamische Gemeinde Bargteheide e.V."
            )} · <span data-i18n="footer.rights">${escapeHtml(t("footer.rights"))}</span></span>
            <span>
              <a href="impressum.html" data-i18n="footer.imprint">${escapeHtml(t("footer.imprint"))}</a> ·
              <a href="datenschutz.html" data-i18n="footer.privacy">${escapeHtml(t("footer.privacy"))}</a>
            </span>
          </div>
        </div>
      </footer>`;
  }

  function renderChrome() {
    renderHeader();
    renderFooter();
  }

  /* ---------- Start ---------- */

  const ready = (async function init() {
    try {
      state.settings = await loadJson("content/settings.json");
    } catch (error) {
      console.error("Einstellungen konnten nicht geladen werden.", error);
      state.settings = {};
    }
    await setLang(detectLang(), { notify: false });
    return state;
  })();

  window.Site = {
    ready,
    LANGS,
    get lang() {
      return state.lang;
    },
    get settings() {
      return state.settings;
    },
    t,
    field,
    escapeHtml,
    paragraphs,
    formatDate,
    formatHijri,
    dateStack,
    loadJson,
    applyTranslations,
    setLang,
    onLangChange(fn) {
      state.subscribers.push(fn);
    }
  };
})();
