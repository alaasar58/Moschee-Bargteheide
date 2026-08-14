#!/usr/bin/env node
/**
 * Holt die Gebetszeiten der Moschee von Mawaqit und schreibt sie nach data/prayer-times.json.
 *
 * Die Zeiten werden bewusst NICHT im Code gepflegt: Quelle ist ausschliesslich Mawaqit
 * (Islamische Gemeinde Bargteheide, ID 27703). Der GitHub-Workflow
 * .github/workflows/update-prayer-times.yml fuehrt dieses Skript taeglich aus,
 * sodass Aenderungen in Mawaqit automatisch auf der Website erscheinen.
 *
 * Aufruf:  node scripts/fetch-mawaqit.mjs [mawaqitId]
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = resolve(ROOT, "data/prayer-times.json");
const SETTINGS_FILE = resolve(ROOT, "content/settings.json");

const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

async function readSettings() {
  try {
    return JSON.parse(await readFile(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function readMawaqitId(settings) {
  if (process.argv[2]) return process.argv[2].trim();
  if (process.env.MAWAQIT_ID) return process.env.MAWAQIT_ID.trim();
  if (settings?.mawaqit?.id) return String(settings.mawaqit.id);
  return "27703";
}

/**
 * Mawaqit kennt mehrere Adressformen (Kennung, Kurzname, Sprache).
 * Es werden alle bekannten Formen der Reihe nach probiert, bis eine Seite
 * mit Gebetszeiten antwortet.
 */
function candidateUrls(id, settings) {
  const urls = [];
  const push = (url) => {
    if (url && !urls.includes(url)) urls.push(url);
  };

  const configured = settings?.mawaqit?.url;
  push(configured);

  // Aus der hinterlegten Adresse die weiteren bekannten Formen ableiten.
  const fromUrl = configured && /mawaqit\.net\/[a-z]{2}\/(?:m\/)?([^/?#]+)/.exec(configured);
  if (fromUrl) {
    const name = fromUrl[1];
    push(`${configured.replace(/\/$/, "")}/embed`);
    push(`https://mawaqit.net/de/m/${name}`);
    push(`https://mawaqit.net/en/m/${name}`);
    push(`https://mawaqit.net/de/${name}`);
    push(`https://mawaqit.net/en/${name}`);
  }

  const slug = settings?.mawaqit?.slug;
  if (slug) {
    push(`https://mawaqit.net/de/${encodeURIComponent(slug)}`);
    push(`https://mawaqit.net/en/${encodeURIComponent(slug)}`);
  }

  const key = encodeURIComponent(id);
  push(`https://mawaqit.net/de/id/${key}`);
  push(`https://mawaqit.net/en/id/${key}`);
  push(`https://mawaqit.net/de/m/${key}`);
  push(`https://mawaqit.net/de/${key}`);
  push(`https://mawaqit.net/en/${key}`);

  return urls;
}

/** Schneidet ab `startIndex` ein balanciertes JSON-Objekt aus dem Text heraus. */
function extractBalancedObject(text, startIndex) {
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }
  throw new Error("confData konnte nicht vollstaendig gelesen werden.");
}

/** Sucht rueckwaerts den Beginn des Objekts, in dem `index` liegt. */
function objectStartBefore(text, index) {
  let depth = 0;
  for (let i = index; i >= 0; i--) {
    const ch = text[i];
    if (ch === "}") depth++;
    else if (ch === "{") {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/**
 * Liest die Gebetszeiten-Daten aus der Mawaqit-Seite.
 * Mawaqit hat den Aufbau der Seite schon mehrfach geaendert, deshalb werden
 * mehrere bekannte Stellen der Reihe nach probiert.
 */
function parseConfData(html) {
  const attempts = [];

  // 1. Klassisch: var confData = { ... }
  const marker = /(?:var\s+|window\.)?confData\s*=\s*\{/.exec(html);
  if (marker) {
    attempts.push(html.indexOf("{", marker.index));
  }

  // 2. JSON in einem Attribut oder Script-Block: irgendwo steht "times":["05:12",...]
  const times = /["']times["']\s*:\s*\[\s*["']\d{1,2}:\d{2}["']/.exec(html);
  if (times) {
    const start = objectStartBefore(html, times.index);
    if (start >= 0) attempts.push(start);
  }

  for (const start of attempts) {
    if (start < 0) continue;
    try {
      const conf = JSON.parse(extractBalancedObject(html, start));
      if (conf && (Array.isArray(conf.times) || Array.isArray(conf.calendar))) return conf;
    } catch {
      /* naechsten Versuch probieren */
    }
  }

  throw new Error(`Gebetszeiten nicht in der Seite gefunden. ${describePage(html)}`);
}

/** Kurze Beschreibung der Seite fuer das Protokoll, damit Aenderungen bei Mawaqit auffallen. */
function describePage(html) {
  const hints = [
    `Laenge ${html.length}`,
    `confData: ${html.includes("confData") ? "ja" : "nein"}`,
    `"times": ${html.includes('"times"') || html.includes("times:") ? "ja" : "nein"}`,
    `Uhrzeiten im Text: ${/\d{1,2}:\d{2}/.test(html) ? "ja" : "nein"}`
  ];

  const sample = /["']?times["']?\s*[:=]/.exec(html) || /\d{1,2}:\d{2}/.exec(html);
  if (sample) {
    const from = Math.max(0, sample.index - 120);
    hints.push(`Auszug: ${html.slice(from, from + 260).replace(/\s+/g, " ")}`);
  }

  return hints.join(" | ");
}

const isTime = (value) => typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value);

/** Normalisiert einen Tageseintrag aus Mawaqit auf { fajr, shuruq, dhuhr, asr, maghrib, isha }. */
function normalizeDay(entry) {
  if (!Array.isArray(entry) || entry.length < 6) return null;
  const [fajr, shuruq, dhuhr, asr, maghrib, isha] = entry;
  if (![fajr, shuruq, dhuhr, asr, maghrib, isha].every(isTime)) return null;
  return { fajr, shuruq, dhuhr, asr, maghrib, isha };
}

/** Mawaqit liefert den Kalender als Array mit 12 Monaten, je Monat ein Objekt "1".."31". */
function normalizeCalendar(calendar) {
  if (!Array.isArray(calendar)) return null;
  const out = {};
  calendar.forEach((month, index) => {
    if (!month || typeof month !== "object") return;
    const days = {};
    for (const [day, times] of Object.entries(month)) {
      const normalized = normalizeDay(times);
      if (normalized) days[String(Number(day))] = normalized;
    }
    if (Object.keys(days).length) out[String(index + 1)] = days;
  });
  return Object.keys(out).length ? out : null;
}

/** Iqama-Kalender: je Tag 5 Werte (Offsets in Minuten wie "+10" oder feste Zeiten wie "13:30"). */
function normalizeIqamaCalendar(calendar) {
  if (!Array.isArray(calendar)) return null;
  const out = {};
  calendar.forEach((month, index) => {
    if (!month || typeof month !== "object") return;
    const days = {};
    for (const [day, values] of Object.entries(month)) {
      if (!Array.isArray(values) || values.length < 5) continue;
      const entry = {};
      PRAYER_KEYS.forEach((key, i) => {
        const value = values[i];
        if (typeof value === "string" && value.trim() !== "" && value.trim() !== "0") {
          entry[key] = value.trim();
        }
      });
      if (Object.keys(entry).length) days[String(Number(day))] = entry;
    }
    if (Object.keys(days).length) out[String(index + 1)] = days;
  });
  return Object.keys(out).length ? out : null;
}

function normalizeIqama(iqama) {
  if (!Array.isArray(iqama) || iqama.length < 5) return null;
  const entry = {};
  PRAYER_KEYS.forEach((key, i) => {
    const value = iqama[i];
    if (typeof value === "string" && value.trim() !== "" && value.trim() !== "0") {
      entry[key] = value.trim();
    }
  });
  return Object.keys(entry).length ? entry : null;
}

function normalizeJumua(conf) {
  const list = [];
  if (isTime(conf.jumua)) list.push(conf.jumua);
  if (isTime(conf.jumua2)) list.push(conf.jumua2);
  if (isTime(conf.jumua3)) list.push(conf.jumua3);
  return list;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Moschee-Bargteheide-Website/1.0)",
      "Accept-Language": "de,en;q=0.8"
    }
  });
  if (!response.ok) throw new Error(`Mawaqit antwortete mit HTTP ${response.status}`);
  return response.text();
}

/** Probiert alle bekannten Adressformen und liefert die erste, die Gebetszeiten enthaelt. */
async function loadConf(id, settings) {
  const problems = [];

  for (const url of candidateUrls(id, settings)) {
    try {
      const conf = parseConfData(await fetchHtml(url));
      console.log(`Gebetszeiten gelesen von: ${url}`);
      return { conf, url };
    } catch (error) {
      problems.push(`${url} -> ${error.message}`);
    }
  }

  throw new Error(`Keine Adresse hat funktioniert:\n  ${problems.join("\n  ")}`);
}

async function main() {
  const settings = await readSettings();
  const id = await readMawaqitId(settings);

  const { conf, url } = await loadConf(id, settings);

  const today = normalizeDay(
    Array.isArray(conf.times) && conf.times.length >= 5
      ? [conf.times[0], conf.shuruq, conf.times[1], conf.times[2], conf.times[3], conf.times[4]]
      : null
  );

  const data = {
    source: "mawaqit",
    mosqueId: String(id),
    mosqueName: conf.name || conf.localisation || null,
    url,
    timezone: conf.timezone || "Europe/Berlin",
    updatedAt: new Date().toISOString(),
    imsakOffsetMinutes:
      Number.isFinite(Number(conf.imsakNbMinBeforeFajr)) && Number(conf.imsakNbMinBeforeFajr) > 0
        ? Number(conf.imsakNbMinBeforeFajr)
        : null,
    jumua: normalizeJumua(conf),
    jumuaAsDuhr: Boolean(conf.jumuaAsDuhr),
    iqamaToday: normalizeIqama(conf.iqama),
    iqamaCalendar: normalizeIqamaCalendar(conf.iqamaCalendar),
    calendar: normalizeCalendar(conf.calendar),
    today
  };

  if (!data.calendar && !data.today) {
    throw new Error("Es konnten weder Jahreskalender noch Tageszeiten gelesen werden.");
  }

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  const months = data.calendar ? Object.keys(data.calendar).length : 0;
  console.log(
    `Gebetszeiten aktualisiert: ${data.mosqueName ?? id} – ${months} Monate im Kalender, ` +
      `Jumu'a: ${data.jumua.length ? data.jumua.join(", ") : "keine Angabe"}`
  );
}

main().catch((error) => {
  console.error(`Fehler beim Abrufen der Gebetszeiten: ${error.message}`);
  process.exit(1);
});
