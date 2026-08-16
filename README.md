# Islamische Gemeinde Bargteheide e.V. – Moschee Bargteheide

Offizielle Website der Gemeinde: schlicht, modern, mobil zuerst und in vier Sprachen
(Deutsch, Türkçe, العربية, Shqip).

Die Seite ist eine reine statische Website – kein Server, keine Datenbank, keine
Programmierkenntnisse für die Pflege nötig. Inhalte liegen als JSON-Dateien im Ordner
`content/`, die Gebetszeiten kommen automatisch von **Mawaqit**.

---

## 1. Inhalt der Website

| Seite | Datei | Inhalt |
| --- | --- | --- |
| Startseite | `index.html` | Foto der Moschee, Name, Adresse, aktuelle Gebetszeiten, nächstes Gebet mit Countdown, Freitagsgebet, Kurzvorstellung, letzte 3 Neuigkeiten, Karte |
| Gebetszeiten | `gebetszeiten.html` | Imsak, Fajr, Shurūq, Dhuhr, Asr, Maghrib, Isha, Iqāma, Freitagsgebet, Monatsübersicht |
| Kurse | `kurse.html` | Kurse als Karten (Name, Beschreibung, Altersgruppe, Tage, Uhrzeit, Ort, Anmeldung) |
| Neuigkeiten | `neuigkeiten.html` | Übersicht und Einzelansicht („Mehr lesen“) |
| Veranstaltungen | `veranstaltungen.html` | Kommende und vergangene Termine |
| Über uns | `ueber-uns.html` | Gemeinde, Moschee, Ziele, Gemeinschaft, Bildung, Aktivitäten, Engagement |
| Kontakt | `kontakt.html` | Adresse, Karte, „Route starten“, Telefon/E-Mail (sobald bestätigt) |
| Mitglied werden | `mitglied-werden.html` | Ablauf der Mitgliedschaft |
| Spenden | `spenden.html` | Spendeninformationen und Bankverbindung |
| Ramadan | `ramadan.html` | Imsakiya für den ganzen Monat sowie Countdown bis Iftar bzw. Sahur |
| Impressum / Datenschutz | `impressum.html`, `datenschutz.html` | Rechtliche Seiten – von der Gemeinde zu vervollständigen |
| Überblick (intern) | `uebersicht.html` | Unterlage für die Vorstellung beim Vorstand: Funktionen, offene Punkte, Kosten, Datenschutz, nächste Schritte. Nicht im Menü verlinkt; Text in `content/overview.json` |

Alle Seiten, das Menü, die Fußzeile und die Beschriftungen der Gebetszeiten sind in allen
vier Sprachen übersetzt. Die Sprache wird oben rechts über die Schaltfläche gewechselt und
im Browser gespeichert. Arabisch schaltet die Seite automatisch auf Leserichtung von
rechts nach links.

---

## 2. Gebetszeiten (Mawaqit)

* Quelle: **Islamische Gemeinde Bargteheide, Mawaqit-ID `27703`**.
  Das Skript probiert die bekannten Adressformen von Mawaqit nacheinander durch.
  Ist die öffentliche Mawaqit-Seite der Moschee bekannt, kann ihre Adresse in
  `content/settings.json` unter `mawaqit.url` eingetragen werden – sie wird dann
  bevorzugt verwendet und auf der Website verlinkt. Solange dort nichts steht,
  zeigt die Website den Hinweis „Gebetszeiten über Mawaqit“ ohne Link.
* Es stehen **keine Gebetszeiten im Code**. Das Skript `scripts/fetch-mawaqit.mjs` liest den
  Jahreskalender aus Mawaqit und schreibt ihn nach `data/prayer-times.json`.
* Der GitHub-Workflow `.github/workflows/update-prayer-times.yml` läuft **täglich um 02:15 UTC**
  und aktualisiert die Datei automatisch. Ändert die Moschee ihre Zeiten in Mawaqit,
  erscheinen die neuen Zeiten von selbst auf der Website.
* Manuell ausführen:

  ```bash
  node scripts/fetch-mawaqit.mjs
  ```

  oder auf GitHub unter **Actions → „Gebetszeiten aktualisieren“ → Run workflow**.

Solange `data/prayer-times.json` noch nicht befüllt ist, zeigt die Website einen freundlichen
Hinweis mit Link zu Mawaqit an – es werden **niemals erfundene Zeiten** angezeigt.

Übernommen werden: Fajr, Shurūq, Dhuhr, Asr, Maghrib, Isha, Imsak (falls in Mawaqit gepflegt),
Iqāma-Zeiten (falls hinterlegt) und die Zeit(en) des Freitagsgebets.

---

## 2b. Farbmodus, App und Kalender

**Farbmodus.** Oben rechts lässt sich zwischen **Hell**, **Dunkel** und **Automatisch
(Gerät)** wählen; die Auswahl bleibt im Browser gespeichert. Ohne Auswahl erscheint die
Website **immer hell** – der Dunkelmodus des Handys wirkt nur bei „Automatisch“.
Zum Vorführen kann der Modus auch angehängt werden: `?theme=dark`.

**Ramadan.** `ramadan.html` zeigt die Imsakiya des ganzen Monats (Imsak, Fajr, Iftar) und
lässt sich ausdrucken. Auf der Startseite erscheint ab 30 Tagen vor Ramadan ein Hinweis,
im Ramadan selbst ein Countdown bis zum Iftar bzw. bis zum Ende des Sahur. Alle Zeiten
stammen aus denselben Mawaqit-Daten wie die Gebetszeiten.

**App auf dem Handy.** Über `manifest.webmanifest` und `sw.js` lässt sich die Website zum
Startbildschirm hinzufügen; die Gebetszeiten funktionieren dann auch **ohne Internet**
(zuletzt geladener Stand). Ein eigenes App-Symbol in 192 und 512 Pixel kann die Gemeinde
nachreichen – es wird dann in `manifest.webmanifest` unter `icons` ergänzt.

**Kalender.** Bei Veranstaltungen und bei den besonderen Tagen gibt es die Schaltfläche
„Zum Kalender“; sie erzeugt eine `.ics`-Datei für Handy- und Computerkalender.

---

## 3. Inhalte pflegen – ohne Programmierung

Alle Inhalte stehen in `content/`:

| Datei | Inhalt |
| --- | --- |
| `content/settings.json` | Adresse, Telefon, E-Mail, Bankverbindung, Karte, Hauptbild |
| `content/news.json` | Neuigkeiten |
| `content/events.json` | Veranstaltungen |
| `content/courses.json` | Kurse |
| `content/i18n/*.json` | Alle Texte der Website in den vier Sprachen |

Jede Datei enthält oben einen Hinweis (`_hinweis`) und eine Vorlage (`_vorlage`), die
kopiert und ausgefüllt werden kann. Fehlt eine Übersetzung, zeigt die Website automatisch
den deutschen Text.

**Beispiel – neue Meldung** (in `content/news.json` ganz oben in `items` einfügen):

```json
{
  "id": "iftar-2026",
  "date": "2026-03-01",
  "image": "assets/img/iftar-2026.jpg",
  "title": { "de": "Gemeinsames Iftar", "tr": "", "ar": "", "sq": "" },
  "excerpt": { "de": "Kurzer Text für die Übersicht.", "tr": "", "ar": "", "sq": "" },
  "body": { "de": "Ausführlicher Text.", "tr": "", "ar": "", "sq": "" }
}
```

Wichtig: `"demo": true` kennzeichnet Beispieleinträge sichtbar mit einem Etikett. Bei echten
Inhalten diese Zeile entfernen.

### Redaktionsoberfläche (optional, empfohlen)

Im Ordner `admin/` liegt eine fertige Konfiguration für **Decap CMS**. Damit pflegt der
Vorstand Neuigkeiten, Kurse, Veranstaltungen, Bilder und Grunddaten bequem über eine
Weboberfläche unter `.../admin/` – ohne JSON zu bearbeiten.

Nötig ist einmalig ein Login-Dienst (Anmeldung mit GitHub), z. B.:

* Hosting bei **Netlify** mit „Netlify Identity“ bzw. dem GitHub-Backend, oder
* ein kleiner OAuth-Dienst, dessen Adresse in `admin/config.yml` unter `backend` ergänzt wird.

Ohne diese Einrichtung funktioniert die Website vollständig – nur die Oberfläche unter
`/admin/` verlangt dann eine Anmeldung, die noch nicht eingerichtet ist.

---

## 4. Bilder

* Das Außenfoto der Moschee gehört als `assets/img/moschee-aussen.jpg` in den Bilderordner
  (siehe `assets/img/README.md`). Es erscheint dann automatisch auf der Startseite.
* Fehlt das Foto, bleibt der ruhige grüne Hintergrund stehen – die Seite funktioniert weiterhin.

---

## 5. Noch offen / von der Gemeinde zu bestätigen

Bewusst leer gelassen, damit nichts Unbestätigtes veröffentlicht wird. Diese Angaben
erscheinen erst auf der Website, sobald sie in `content/settings.json` eingetragen sind:

* Telefonnummer und E-Mail-Adresse
* Bankverbindung für Spenden
* Mitgliedsbeitrag
* Angaben in Impressum und Datenschutz (Vorstand, Registereintrag, Hosting-Anbieter)
* Der Hinweis „Gestaltung und Umsetzung“ in der Fußzeile steht in `content/settings.json`
  unter `credit` und kann dort geändert oder entfernt werden.
* **Kurse** – die Kursliste wird erst nach Vorlage der offiziellen Übersicht der Gemeinde
  eingetragen. Bis dahin zeigt die Kursseite einen Hinweis; es werden keine Kurse erfunden.

Das Hinweisband „Entwurf zur Vorstellung“ oben auf der Seite lässt sich abschalten, indem in
`content/settings.json` `"demoNotice": false` gesetzt wird.

---

## 6. Lokal ansehen

```bash
python3 -m http.server 8080
# danach im Browser: http://localhost:8080
```

Ein einfacher Doppelklick auf `index.html` genügt nicht, weil die Inhalte über
`fetch` aus JSON-Dateien geladen werden.

## 7. Veröffentlichen (GitHub Pages)

Die Veröffentlichung läuft vollautomatisch über GitHub Actions:
`.github/workflows/deploy-pages.yml`

* **Bei jedem Push** auf den Hauptbranch wird die Website neu veröffentlicht.
* Vor dem Veröffentlichen holt der Workflow die **aktuellen Gebetszeiten von Mawaqit**.
  Schlägt der Abruf fehl, wird die zuletzt gespeicherte Datei verwendet und die
  Veröffentlichung läuft trotzdem durch.
* Zusätzlich läuft der Workflow **täglich um 02:30 UTC**, damit die veröffentlichten
  Gebetszeiten auch ohne Änderung am Code aktuell bleiben.
* Manuell starten: **Actions → „Website auf GitHub Pages veröffentlichen“ → Run workflow**.

**Einmalige Einstellung in GitHub:**
**Settings → Pages → Build and deployment → Source: „GitHub Actions“**
(nicht „Deploy from a branch“). Ohne diese Einstellung schlägt der Deploy-Schritt fehl.

Die Seite ist danach erreichbar unter
`https://<benutzername>.github.io/Moschee-Bargteheide/`.
Alle Verweise im Code sind relativ, die Website funktioniert deshalb sowohl in einem
Unterverzeichnis als auch unter einer eigenen Domain.

Der Workflow verändert keine Website-Dateien: Er kopiert den Projektstand nach `_site`
(ohne `.github` und `scripts`), legt eine leere `.nojekyll`-Datei an und lädt das Ergebnis
zu GitHub Pages hoch.

Alternativ läuft die Website als statische Seite auf jedem Webspace – einfach alle Dateien
in das Web-Verzeichnis legen.

---

## بالعربية – ملخّص سريع

* الموقع ثابت (Static) بأربع لغات: الألمانية والتركية والعربية والألبانية، مع زر واضح لتغيير اللغة، والعربية تظهر من اليمين إلى اليسار.
* **أوقات الصلاة** تُؤخذ آليًا من Mawaqit (المعرّف 27703) عبر السكربت `scripts/fetch-mawaqit.mjs`، ويُشغّله GitHub يوميًا. لا توجد أي أوقات مكتوبة يدويًا في الكود.
* **المحتوى** كله في مجلد `content/`: الأخبار والفعاليات والدورات والإعدادات (العنوان، الهاتف، البريد، الحساب البنكي). تستطيع الجمعية إضافة محتوى جديد دون تعديل الكود، ويوجد أيضًا لوحة تحرير جاهزة في مجلد `admin/`.
* **صفحة الدورات فارغة عمدًا**: لم تُخترع أي دورة. بمجرد إرسال ورقة الدورات الرسمية تُضاف الدورات في `content/courses.json` وتظهر مباشرة على شكل بطاقات.
* **صورة المسجد**: ضعها باسم `assets/img/moschee-aussen.jpg` لتظهر تلقائيًا في الصفحة الرئيسية.
* المعلومات غير المؤكدة (الهاتف، البريد، الحساب البنكي، الاشتراك) تُركت فارغة ولا تظهر في الموقع حتى تُعتمد من الجمعية.
