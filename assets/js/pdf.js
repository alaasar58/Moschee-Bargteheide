/* Tabellen als PDF speichern – genau eine Seite im Format A4.

   Absichtlich ohne fremde Bibliothek: Die Tabelle wird auf eine Zeichenflaeche
   in A4-Groesse gemalt (dabei verkleinert sich die Schrift so weit, dass alle
   Zeilen auf die eine Seite passen) und anschliessend in eine sehr einfache,
   von Hand gebaute PDF-Datei gelegt. Vorteile: funktioniert offline, laedt
   nichts nach und stellt arabische Schrift richtig dar, weil der Browser sie
   selbst zeichnet. */

(function () {
  "use strict";

  // A4 bei 150 Punkten je Zoll – gut lesbar und noch handliche Dateigroesse.
  const PX_W = 1240;
  const PX_H = 1754;

  // A4 in der Masseinheit von PDF (1/72 Zoll).
  const PT_W = 595.28;
  const PT_H = 841.89;

  const encoder = new TextEncoder();

  function ascii(text) {
    return encoder.encode(text);
  }

  function join(parts) {
    let length = 0;
    parts.forEach((part) => (length += part.length));
    const out = new Uint8Array(length);
    let at = 0;
    parts.forEach((part) => {
      out.set(part, at);
      at += part.length;
    });
    return out;
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  /** Sehr einfaches PDF mit einer Seite und einem Bild darin. */
  function buildPdf(jpeg, width, height) {
    const scale = Math.min(PT_W / width, PT_H / height);
    const w = width * scale;
    const h = height * scale;
    const x = (PT_W - w) / 2;
    const y = (PT_H - h) / 2;

    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q\n`;

    const objects = [
      ascii("<</Type/Catalog/Pages 2 0 R>>"),
      ascii("<</Type/Pages/Kids[3 0 R]/Count 1>>"),
      ascii(
        `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PT_W} ${PT_H}]` +
          "/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>"
      ),
      join([
        ascii(
          `<</Type/XObject/Subtype/Image/Width ${width}/Height ${height}` +
            `/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpeg.length}>>\nstream\n`
        ),
        jpeg,
        ascii("\nendstream")
      ]),
      join([ascii(`<</Length ${content.length}>>\nstream\n`), ascii(content), ascii("endstream")])
    ];

    const parts = [];
    let offset = 0;
    const push = (bytes) => {
      parts.push(bytes);
      offset += bytes.length;
    };

    push(ascii("%PDF-1.4\n"));

    const offsets = [];
    objects.forEach((body, index) => {
      offsets.push(offset);
      push(ascii(`${index + 1} 0 obj\n`));
      push(body);
      push(ascii("\nendobj\n"));
    });

    const xrefAt = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((value) => {
      xref += `${String(value).padStart(10, "0")} 00000 n \n`;
    });
    xref += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF\n`;
    push(ascii(xref));

    return new Blob([join(parts)], { type: "application/pdf" });
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------- Tabelle zeichnen ---------- */

  function font(size, bold) {
    return `${bold ? "600 " : ""}${size}px "Segoe UI", system-ui, -apple-system, Arial, sans-serif`;
  }

  /**
   * spec = {
   *   title, subtitle, footer,
   *   rtl: true|false,
   *   columns: [{ label, width?, tone? }],   tone: "imsak" | "iftar"
   *   rows: [{ cells: ["…"], sub: ["…"|null], highlight: true|false }]
   * }
   */
  function drawTable(canvas, spec) {
    const ctx = canvas.getContext("2d");
    const rtl = Boolean(spec.rtl);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PX_W, PX_H);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.direction = rtl ? "rtl" : "ltr";

    const margin = 56;
    const innerW = PX_W - margin * 2;
    let top = margin;

    // Kopf
    ctx.fillStyle = "#1a6f68";
    ctx.textAlign = "center";
    ctx.font = font(40, true);
    ctx.fillText(spec.title || "", PX_W / 2, top + 20, innerW);
    top += 56;

    if (spec.subtitle) {
      ctx.fillStyle = "#5f7880";
      ctx.font = font(24, false);
      ctx.fillText(spec.subtitle, PX_W / 2, top + 12, innerW);
      top += 42;
    }

    ctx.strokeStyle = "#c79a2c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin, top);
    ctx.lineTo(PX_W - margin, top);
    ctx.stroke();
    top += 22;

    const footerH = spec.footer ? 46 : 0;
    const available = PX_H - margin - footerH - top;

    const columns = spec.columns || [];
    const rows = spec.rows || [];

    // Zeilenhoehe so waehlen, dass alles auf die eine Seite passt.
    const headH = Math.min(52, available / (rows.length + 1.6));
    let rowH = (available - headH) / Math.max(rows.length, 1);
    rowH = Math.min(rowH, 54);

    const weights = columns.map((column) => column.width || 1);
    const total = weights.reduce((sum, value) => sum + value, 0);
    const widths = weights.map((value) => (value / total) * innerW);

    const xOf = (index) => {
      let before = 0;
      for (let i = 0; i < index; i++) before += widths[i];
      return rtl ? PX_W - margin - before - widths[index] : margin + before;
    };

    const tones = {
      imsak: { bg: "#fdf6e7", text: "#7a6224" },
      iftar: { bg: "#e8f5f2", text: "#17706a" }
    };

    // Kopfzeile
    ctx.fillStyle = "#1a6f68";
    ctx.fillRect(margin, top, innerW, headH);
    ctx.fillStyle = "#ffffff";
    ctx.font = font(Math.min(22, headH * 0.46), true);
    columns.forEach((column, index) => {
      ctx.fillText(column.label || "", xOf(index) + widths[index] / 2, top + headH / 2, widths[index] - 10);
    });
    top += headH;

    const mainSize = Math.min(23, rowH * 0.44);
    const subSize = Math.min(15, rowH * 0.28);

    rows.forEach((row, rowIndex) => {
      const y = top + rowIndex * rowH;

      ctx.fillStyle = rowIndex % 2 ? "#f7fbfa" : "#ffffff";
      ctx.fillRect(margin, y, innerW, rowH);

      columns.forEach((column, index) => {
        if (!column.tone) return;
        ctx.fillStyle = tones[column.tone].bg;
        ctx.fillRect(xOf(index), y, widths[index], rowH);
      });

      if (row.highlight) {
        ctx.strokeStyle = "#2f9c91";
        ctx.lineWidth = 2;
        ctx.strokeRect(margin + 1, y + 1, innerW - 2, rowH - 2);
      }

      columns.forEach((column, index) => {
        const centerX = xOf(index) + widths[index] / 2;
        const value = (row.cells && row.cells[index]) || "";
        const sub = row.sub && row.sub[index];

        ctx.fillStyle = column.tone ? tones[column.tone].text : "#2b4247";
        ctx.font = font(mainSize, Boolean(column.tone) || Boolean(row.highlight));
        ctx.fillText(value, centerX, sub ? y + rowH * 0.38 : y + rowH / 2, widths[index] - 10);

        if (sub) {
          ctx.fillStyle = "#5f7880";
          ctx.font = font(subSize, false);
          ctx.fillText(sub, centerX, y + rowH * 0.72, widths[index] - 10);
        }
      });

      ctx.strokeStyle = "#e2ecea";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin, y + rowH);
      ctx.lineTo(PX_W - margin, y + rowH);
      ctx.stroke();
    });

    if (spec.footer) {
      ctx.fillStyle = "#5f7880";
      ctx.font = font(18, false);
      ctx.textAlign = "center";
      ctx.fillText(spec.footer, PX_W / 2, PX_H - margin + 4, innerW);
    }
  }

  /** Tabelle als einseitiges PDF herunterladen. */
  function tableToPdf(spec, filename) {
    const canvas = document.createElement("canvas");
    canvas.width = PX_W;
    canvas.height = PX_H;
    drawTable(canvas, spec);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const jpeg = base64ToBytes(dataUrl.split(",")[1]);
    download(buildPdf(jpeg, PX_W, PX_H), filename);
  }

  /**
   * Drucken, ohne dass leere Folgeseiten entstehen: Der gewuenschte Bereich
   * wird kurzzeitig direkt an den Seitenkoerper gehaengt, alles andere ist
   * waehrenddessen ausgeblendet. Danach steht wieder alles an seinem Platz.
   */
  function printOnly(node) {
    if (!node) {
      window.print();
      return;
    }

    const marker = document.createComment("druck");
    const portal = document.createElement("div");
    portal.className = "print-portal";

    node.parentNode.insertBefore(marker, node);
    portal.appendChild(node);
    document.body.appendChild(portal);
    document.documentElement.classList.add("is-printing");

    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      document.documentElement.classList.remove("is-printing");
      marker.parentNode.insertBefore(node, marker);
      marker.remove();
      portal.remove();
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("afterprint", restore);
    window.print();
    // Sicherheitsnetz fuer Browser ohne "afterprint".
    setTimeout(restore, 3000);
  }

  window.SitePdf = { tableToPdf, printOnly };
})();
