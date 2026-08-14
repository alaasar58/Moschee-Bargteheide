# Bilder / الصور

## Hauptbild der Startseite

Das Außenfoto der Moschee gehört in diesen Ordner und muss genau so heißen:

```
assets/img/moschee-aussen.jpg
```

Solange die Datei fehlt, zeigt die Startseite den ruhigen grünen Hintergrund –
die Seite bleibt also auch ohne Foto vollständig funktionsfähig.

Empfehlung: Querformat, mindestens 1600 × 900 Pixel, Dateigröße möglichst unter 500 KB.

Ein anderer Dateiname ist ebenfalls möglich; dann muss er in `content/settings.json`
unter `heroImage` eingetragen werden.

## Bilder für Neuigkeiten, Veranstaltungen und Kurse

Bilder einfach in diesen Ordner legen und in der jeweiligen JSON-Datei den Pfad eintragen, z. B.:

```json
"image": "assets/img/iftar-2026.jpg"
```

---

## بالعربية

- صورة المسجد من الخارج توضع في هذا المجلد باسم `moschee-aussen.jpg` وتظهر تلقائيًا في الصفحة الرئيسية.
- إذا لم تكن الصورة موجودة، يظهر خلفية خضراء هادئة بدل الصورة، ويبقى الموقع يعمل بشكل كامل.
- صور الأخبار والفعاليات والدورات توضع في نفس المجلد، ويُكتب مسارها في ملف JSON المناسب.
