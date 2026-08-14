/* Online-Aufnahmeantrag mit digitaler Unterschrift.

   Der Antrag wird ausschliesslich im Browser der Besucherin bzw. des Besuchers
   erzeugt – es werden keine Daten an einen Server oder an Dritte uebertragen.
   Am Ende steht ein fertiges Formular zum Speichern (PDF) oder Ausdrucken.
   Ein spaeterer Versand per E-Mail oder Formulardienst kann ergaenzt werden,
   sobald der Vorstand darueber entschieden hat. */

(function () {
  "use strict";

  const S = window.Site;

  const FIELDS = [
    { name: "firstName", key: "membership.formFirstName", type: "text", required: true, autocomplete: "given-name" },
    { name: "lastName", key: "membership.formLastName", type: "text", required: true, autocomplete: "family-name" },
    { name: "birthDate", key: "membership.formBirth", type: "date", required: true, autocomplete: "bday" },
    { name: "street", key: "membership.formStreet", type: "text", required: true, autocomplete: "street-address" },
    { name: "zip", key: "membership.formZip", type: "text", required: true, autocomplete: "postal-code" },
    { name: "city", key: "membership.formCity", type: "text", required: true, autocomplete: "address-level2" },
    { name: "email", key: "membership.formEmail", type: "email", required: true, autocomplete: "email" },
    { name: "phone", key: "membership.formPhone", type: "tel", required: false, autocomplete: "tel" }
  ];

  let signaturePad = null;

  /* ---------- Unterschriftenfeld ---------- */

  function createSignaturePad(canvas) {
    const context = canvas.getContext("2d");
    let drawing = false;
    let used = false;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const image = used ? canvas.toDataURL() : null;

      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineWidth = 2.2;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#16323a";

      if (image) {
        const restored = new Image();
        restored.onload = () => context.drawImage(restored, 0, 0, rect.width, rect.height);
        restored.src = image;
      }
    }

    function position(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    canvas.addEventListener("pointerdown", (event) => {
      drawing = true;
      used = true;
      canvas.setPointerCapture(event.pointerId);
      const point = position(event);
      context.beginPath();
      context.moveTo(point.x, point.y);
      event.preventDefault();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drawing) return;
      const point = position(event);
      context.lineTo(point.x, point.y);
      context.stroke();
      event.preventDefault();
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
      canvas.addEventListener(type, () => {
        drawing = false;
      });
    });

    window.addEventListener("resize", resize);
    resize();

    return {
      clear() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        used = false;
      },
      isEmpty() {
        return !used;
      },
      toDataUrl() {
        return canvas.toDataURL("image/png");
      }
    };
  }

  /* ---------- Formular ---------- */

  function fieldMarkup(field) {
    return `<label class="field">
      <span>${S.escapeHtml(S.t(field.key))}${field.required ? " *" : ""}</span>
      <input type="${field.type}" name="${field.name}" ${field.required ? "required" : ""}
             autocomplete="${field.autocomplete}" />
    </label>`;
  }

  function render(host) {
    const values = collect(host);

    host.innerHTML = `<form class="card" data-membership novalidate>
      <div class="form-grid form-grid--2">${FIELDS.map(fieldMarkup).join("")}</div>

      <h3 style="margin-top: 22px">${S.escapeHtml(S.t("membership.signatureTitle"))} *</h3>
      <p style="font-size: 0.9rem; color: var(--text-soft)">${S.escapeHtml(S.t("membership.signatureHint"))}</p>
      <div class="signature">
        <canvas data-signature aria-label="${S.escapeHtml(S.t("membership.signatureTitle"))}"></canvas>
        <div class="signature__actions">
          <button type="button" class="btn btn--outline" data-signature-clear>${S.escapeHtml(
            S.t("membership.signatureClear")
          )}</button>
        </div>
      </div>

      <p style="margin-top: 18px">
        <button type="submit" class="btn btn--primary">${S.escapeHtml(S.t("membership.submit"))}</button>
      </p>
      <p class="form-status" data-status role="status"></p>
      <p style="font-size: 0.85rem; color: var(--text-soft)">${S.escapeHtml(S.t("membership.formNote"))}</p>
    </form>
    <div data-application></div>`;

    const form = host.querySelector("[data-membership]");
    signaturePad = createSignaturePad(host.querySelector("[data-signature]"));

    // Eingaben beim Sprachwechsel nicht verlieren
    Object.entries(values).forEach(([name, value]) => {
      const input = form.elements[name];
      if (input && value) input.value = value;
    });

    host.querySelector("[data-signature-clear]").addEventListener("click", () => signaturePad.clear());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(host, form);
    });
  }

  function collect(host) {
    const form = host.querySelector("[data-membership]");
    if (!form) return {};
    const values = {};
    FIELDS.forEach((field) => {
      const input = form.elements[field.name];
      if (input) values[field.name] = input.value;
    });
    return values;
  }

  function submit(host, form) {
    const status = host.querySelector("[data-status]");
    const values = collect(host);

    const missing = FIELDS.some((field) => field.required && !String(values[field.name] || "").trim());
    if (missing || signaturePad.isEmpty()) {
      status.textContent = S.t("membership.formIncomplete");
      status.style.color = "var(--gold-600)";
      return;
    }

    status.textContent = S.t("membership.formDone");
    status.style.color = "var(--petrol-700)";
    renderApplication(host, values, signaturePad.toDataUrl());
    host.querySelector("[data-application]").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- Fertiger Antrag zum Speichern oder Drucken ---------- */

  function renderApplication(host, values, signature) {
    const settings = S.settings || {};
    const address = settings.address || {};
    const line = (key, value) =>
      `<tr><th scope="row">${S.escapeHtml(S.t(key))}</th><td>${S.escapeHtml(value || "–")}</td></tr>`;

    host.querySelector("[data-application]").innerHTML = `
      <div class="card application-doc" style="margin-top: 26px">
        <h2 style="margin-bottom: 4px">${S.escapeHtml(S.t("membership.title"))}</h2>
        <p style="color: var(--text-soft); margin-bottom: 18px">
          ${S.escapeHtml(settings.associationName || "Islamische Gemeinde Bargteheide e.V.")}<br>
          ${S.escapeHtml([address.street, `${address.zip || ""} ${address.city || ""}`.trim()].filter(Boolean).join(", "))}
        </p>

        <table class="bank-table">
          <tbody>
            ${line("membership.formFirstName", values.firstName)}
            ${line("membership.formLastName", values.lastName)}
            ${line("membership.formBirth", values.birthDate)}
            ${line("membership.formStreet", values.street)}
            ${line("membership.formZip", values.zip)}
            ${line("membership.formCity", values.city)}
            ${line("membership.formEmail", values.email)}
            ${line("membership.formPhone", values.phone)}
          </tbody>
        </table>

        <p style="margin-top: 22px; color: var(--text-soft); font-size: 0.9rem">
          ${S.escapeHtml(S.t("membership.signatureTitle"))} · ${S.escapeHtml(
            S.formatDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date()))
          )}
        </p>
        <img src="${signature}" alt="${S.escapeHtml(S.t("membership.signatureTitle"))}"
             style="max-width: 320px; border-bottom: 1px solid var(--border); padding-bottom: 6px" />

        <p style="margin-top: 22px" class="no-print">
          <button type="button" class="btn btn--primary" data-print>${S.escapeHtml(S.t("membership.formPrint"))}</button>
        </p>
      </div>`;

    host.querySelector("[data-print]").addEventListener("click", () => window.print());
  }

  function renderAll() {
    document.querySelectorAll("[data-membership-form]").forEach(render);
  }

  S.ready.then(() => {
    renderAll();
    S.onLangChange(renderAll);
  });
})();
