/* Landing del webinar Entrix: idioma EN/DE, nav, countdown, formulario simulado y animaciones. */
(function () {
  "use strict";

  const EVENT_START = Date.UTC(2026, 10, 18, 10, 0, 0); // 18 nov 2026, 11:00 CET
  const EVENT_END = Date.UTC(2026, 10, 18, 11, 0, 0);
  const LANGS = ["en", "de"];
  const STORAGE_KEY = "entrix-webinar-lang";
  const FREE_MAIL_DOMAINS = [
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.de", "hotmail.com", "hotmail.de", "outlook.com", "outlook.de",
    "live.com", "icloud.com", "me.com", "gmx.de", "gmx.net", "gmx.com", "web.de", "t-online.de", "aol.com",
    "proton.me", "protonmail.com", "mail.com"
  ];

  const params = new URLSearchParams(window.location.search);
  // ?capture muestra todo sin animaciones, para sacar capturas de página completa
  const skipMotion = params.has("capture") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dict = window.ENTRIX_I18N;

  /* ---- Idioma ---- */
  const parseAttrs = (el) => el.dataset.i18nAttr.split(",").map((pair) => pair.split(":").map((s) => s.trim()));

  // El inglés se lee del HTML, así hay una sola fuente por idioma
  const english = {};
  document.querySelectorAll("[data-i18n]").forEach((el) => { english[el.dataset.i18n] = el.textContent.trim(); });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => { english[el.dataset.i18nHtml] = el.innerHTML.trim(); });
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    parseAttrs(el).forEach(([attr, key]) => { english[key] = el.getAttribute(attr); });
  });

  let lang = "en";

  function t(key, vars) {
    let str = lang === "de" ? dict.de[key] : undefined;
    if (str === undefined) {
      if (lang === "de") console.warn(`[i18n] falta la traducción DE de "${key}"`);
      str = english[key] ?? dict.en[key] ?? key;
    }
    return vars ? str.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match) : str;
  }

  function applyLanguage(next) {
    lang = LANGS.includes(next) ? next : "en";
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : undefined;
      el.textContent = t(el.dataset.i18n, vars);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      parseAttrs(el).forEach(([attr, key]) => el.setAttribute(attr, t(key)));
    });
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
    });

    try {
      const url = new URL(window.location.href);
      if (lang === "en") url.searchParams.delete("lang");
      else url.searchParams.set("lang", lang);
      history.replaceState(null, "", url);
    } catch (error) { /* file:// puede bloquear replaceState */ }
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (error) { /* almacenamiento no disponible */ }
  }

  function initialLanguage() {
    const fromUrl = params.get("lang");
    if (LANGS.includes(fromUrl)) return fromUrl;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (LANGS.includes(stored)) return stored;
    } catch (error) { /* almacenamiento no disponible */ }
    return "en";
  }

  applyLanguage(initialLanguage());
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => applyLanguage(button.dataset.lang));
  });

  /* ---- Nav: sombra al hacer scroll + sección activa ---- */
  const nav = document.querySelector("[data-nav]");
  const updateNavShadow = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", updateNavShadow, { passive: true });
  updateNavShadow();

  const navLinks = [...document.querySelectorAll(".site-nav__links a")];
  if ("IntersectionObserver" in window) {
    const linkFor = new Map(navLinks.map((link) => [link.hash.slice(1), link]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const active = linkFor.get(entry.target.id);
        navLinks.forEach((link) => link.classList.toggle("is-active", link === active));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("main > section[id]").forEach((section) => spy.observe(section));
  }

  /* ---- CTAs: todos llevan al formulario y ponen el foco en el primer campo ---- */
  const registerCard = document.getElementById("register");
  const firstField = document.getElementById("f-first-name");
  const successView = document.querySelector("[data-success-view]");
  const successTitle = document.querySelector("[data-success-title]");

  document.querySelectorAll("[data-scroll-to-form]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      registerCard.scrollIntoView({ behavior: skipMotion ? "auto" : "smooth", block: "start" });
      const target = successView.hidden ? firstField : successTitle;
      window.setTimeout(() => target.focus({ preventScroll: true }), skipMotion ? 0 : 650);
    });
  });

  /* ---- Countdown ---- */
  const countdown = document.querySelector("[data-countdown]");
  if (countdown) {
    const units = { days: 864e5, hours: 36e5, minutes: 6e4, seconds: 1e3 };
    const outputs = Object.fromEntries(Object.keys(units).map((unit) => [unit, countdown.querySelector(`[data-unit="${unit}"]`)]));
    const label = countdown.querySelector("[data-countdown-label]");
    let timer;

    const tick = () => {
      const now = Date.now();
      let rest = Math.max(0, EVENT_START - now);
      Object.entries(units).forEach(([unit, ms]) => {
        const value = Math.floor(rest / ms);
        rest -= value * ms;
        const text = String(value).padStart(2, "0");
        if (outputs[unit].textContent !== text) outputs[unit].textContent = text;
      });
      if (now >= EVENT_START) {
        label.dataset.i18n = now >= EVENT_END ? "countdown.ended" : "countdown.live";
        label.textContent = t(label.dataset.i18n);
        if (now >= EVENT_END) window.clearInterval(timer);
      }
    };
    tick();
    timer = window.setInterval(tick, 1000);
  }

  /* ---- Formulario (simulado: no envía datos) ---- */
  const form = document.getElementById("register-form");
  const formView = document.querySelector("[data-form-view]");
  const successText = document.querySelector("[data-success-text]");
  const submitButton = form.querySelector('[type="submit"]');
  const submitLabel = form.querySelector("[data-submit-label]");
  const fields = [...form.querySelectorAll("input, select")];

  function errorFor(input) {
    if (input.type === "checkbox") return input.checked ? null : "err.privacy";
    const value = input.value.trim();
    if (input.tagName === "SELECT") return value ? null : "err.select";
    if (!value) return "err.required";
    if (input.type === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return "err.email";
      if (FREE_MAIL_DOMAINS.includes(value.split("@")[1].toLowerCase())) return "err.workEmail";
    }
    return null;
  }

  // Devuelve true si el campo es válido
  function validate(input) {
    const key = errorFor(input);
    const message = document.getElementById(input.getAttribute("aria-describedby"));
    input.setAttribute("aria-invalid", String(Boolean(key)));
    if (key) {
      message.dataset.i18n = key;
      message.textContent = t(key);
    } else {
      delete message.dataset.i18n;
      message.textContent = "";
    }
    message.hidden = !key;
    return !key;
  }

  const isInvalid = (input) => input.getAttribute("aria-invalid") === "true";
  fields.forEach((input) => {
    input.addEventListener("blur", () => {
      if (input.type !== "checkbox" && (input.value.trim() || isInvalid(input))) validate(input);
    });
    input.addEventListener("input", () => { if (isInvalid(input)) validate(input); });
    input.addEventListener("change", () => { if (isInvalid(input)) validate(input); });
  });

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.classList.toggle("is-loading", isLoading);
    submitButton.setAttribute("aria-busy", String(isLoading));
    submitLabel.dataset.i18n = isLoading ? "form.loading" : "cta.register";
    submitLabel.textContent = t(submitLabel.dataset.i18n);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const invalid = fields.filter((input) => !validate(input));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    const data = new FormData(form);
    const registration = { name: data.get("firstName").trim(), email: data.get("email").trim() };
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      successText.dataset.i18n = "success.text";
      successText.dataset.i18nVars = JSON.stringify(registration);
      successText.textContent = t("success.text", registration);
      formView.hidden = true;
      successView.hidden = false;
      successTitle.focus();
    }, 900);
  });

  /* ---- Add to calendar (.ics) ---- */
  const icsStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const icsText = (value) => value.replace(/\\/g, "\\\\").replace(/[,;]/g, (char) => `\\${char}`).replace(/\n/g, "\\n");
  const icsFold = (line) => line.match(/.{1,73}/g).join("\r\n ");

  document.querySelector("[data-add-to-calendar]").addEventListener("click", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Entrix webinar concept//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:entrix-webinar-20261118@entrix-concept",
      `DTSTAMP:${icsStamp(Date.now())}`,
      `DTSTART:${icsStamp(EVENT_START)}`,
      `DTEND:${icsStamp(EVENT_END)}`,
      `SUMMARY:${icsText(t("ics.summary"))}`,
      `DESCRIPTION:${icsText(t("ics.description"))}`,
      "LOCATION:Online",
      "END:VEVENT",
      "END:VCALENDAR"
    ].map(icsFold).join("\r\n") + "\r\n";

    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "entrix-webinar.ics" });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* ---- Aparición al hacer scroll ---- */
  const revealables = document.querySelectorAll("[data-reveal]");
  if (skipMotion || !("IntersectionObserver" in window)) {
    revealables.forEach((el) => el.classList.add("is-visible"));
  } else {
    const revealer = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    revealables.forEach((el) => revealer.observe(el));
  }
})();
