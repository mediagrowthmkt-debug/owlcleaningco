/* Owl Cleaning Co. site script
   CRM: every quote form posts to the server-side proxy (owl-lead-api), which holds the GHL token and writes
   contact + tag website-lead-owl + source "site" + note with every answer. No token ever in the browser. */
window.OWL_CONFIG = window.OWL_CONFIG || {
  crmWebhook: 'https://mediagrowth.com.br/owl-lead-api/api.php',
  phoneDisplay: '(978) 239-2635',
  phoneTel: '+19782392635'
};

const OWL_TRACK_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'];

function initTracking() {
  try {
    const params = new URLSearchParams(location.search);
    const found = {};
    OWL_TRACK_KEYS.forEach((k) => { if (params.get(k)) found[k] = params.get(k).slice(0, 300); });
    if (Object.keys(found).length) sessionStorage.setItem('owl_track', JSON.stringify(found));
    if (!sessionStorage.getItem('owl_ref') && document.referrer && !document.referrer.includes(location.host)) {
      sessionStorage.setItem('owl_ref', document.referrer.slice(0, 500));
    }
  } catch (e) { /* storage blocked: tracking is optional */ }
}

function storedTracking() {
  try { return JSON.parse(sessionStorage.getItem('owl_track') || '{}'); } catch (e) { return {}; }
}

function initMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('is-open')));
}

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/);
  return { firstName: parts.shift() || '', lastName: parts.join(' ') };
}

function buildPayload(form) {
  const data = new FormData(form);
  const name = splitName(data.get('name'));
  const consentBox = form.querySelector('[name="sms_consent"]');
  const consentText = consentBox ? (consentBox.closest('label').innerText || '').replace(/\s+/g, ' ').trim() : '';
  let referrer = '';
  try { referrer = sessionStorage.getItem('owl_ref') || ''; } catch (e) { referrer = ''; }
  return Object.assign({
    firstName: name.firstName,
    lastName: name.lastName,
    phone: (data.get('phone') || '').trim(),
    email: (data.get('email') || '').trim(),
    city: data.get('city') || '',
    service: data.get('service') || '',
    bedrooms: data.get('bedrooms') || '',
    bathrooms: data.get('bathrooms') || '',
    frequency: data.get('frequency') || '',
    message: [data.get('zip') ? 'ZIP: ' + String(data.get('zip')).trim() : '', (data.get('message') || '').trim()].filter(Boolean).join(' | '),
    smsConsent: data.get('sms_consent') === 'yes',
    smsConsentText: data.get('sms_consent') === 'yes' ? consentText : '',
    formOrigin: form.dataset.origin || 'website',
    pageUrl: location.href.split('#')[0],
    pageTitle: document.title,
    referrer,
    company_site: data.get('company_site') || ''
  }, storedTracking());
}

function setStatus(form, type, html) {
  const box = form.querySelector('.form-status');
  if (!box) return;
  box.className = 'form-status ' + (type === 'ok' ? 'is-ok' : 'is-error');
  box.innerHTML = html;
}

async function handleQuote(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const btn = form.querySelector('button[type="submit"]');
  const cfg = window.OWL_CONFIG;
  const callLink = '<a href="tel:' + cfg.phoneTel + '">' + cfg.phoneDisplay + '</a>';

  if (form._qs && form._qs.current < form._qs.steps.length - 1) { form._qs.next(); return; }
  if (form._qs && !form._qs.valid(form._qs.current)) return;
  if (form.querySelector('[name="company_site"]').value) return;
  if (Date.now() - Number(form.dataset.started || 0) < 2500) return;
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const payload = buildPayload(form);
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    if (!cfg.crmWebhook) throw new Error('crm-not-connected');
    const res = await fetch(cfg.crmWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    form.reset();
    if (form._qs) form._qs.done();
    setStatus(form, 'ok', 'Thank you! Your request is in. We will reach out shortly with your quote. Prefer to talk now? Call ' + callLink + '.');
    trackLead(payload.formOrigin);
  } catch (err) {
    setStatus(form, 'error', 'We could not send your request right now. Please call or text us at ' + callLink + ' and we will get you a quote today.');
  } finally {
    btn.disabled = false;
    btn.textContent = btn.dataset.label || 'Get My Quote';
  }
}

function initStepper(form) {
  const steps = Array.from(form.querySelectorAll('.qs-step'));
  if (steps.length < 2) return;
  const back = form.querySelector('.qs-back');
  const nextBtn = form.querySelector('.qs-next');
  const count = form.querySelector('[data-qs-count]');
  const label = form.querySelector('[data-qs-name]');
  const bar = form.querySelector('.qs-bar span');
  const err = form.querySelector('.qs-error');
  const qs = { steps, current: 0 };

  function radioGroups(step) {
    return Array.from(new Set(Array.from(step.querySelectorAll('input[type="radio"]')).map((r) => r.name)));
  }
  function showError(msg) { if (err) { err.textContent = msg; err.classList.toggle('is-on', !!msg); } }

  qs.valid = function (i) {
    const step = steps[i];
    for (const name of radioGroups(step)) {
      if (!step.querySelector('input[name="' + name + '"]:checked')) {
        const lbl = step.querySelector('input[name="' + name + '"]').closest('.opts').previousElementSibling;
        const what = lbl && lbl.classList.contains('qs-label') ? lbl.textContent.toLowerCase() : 'an option';
        showError('Please choose ' + (what === 'an option' ? what : 'the number of ' + what) + ' to continue.');
        return false;
      }
    }
    const city = step.querySelector('[name="city"]');
    const zip = step.querySelector('[name="zip"]');
    if (city && !city.value) { showError('Please select your town.'); city.focus(); return false; }
    if (zip) {
      const z = zip.value.trim();
      if (z && !/^\d{5}$/.test(z)) { showError('Please enter a 5 digit ZIP code.'); zip.focus(); return false; }
      if (city && /^other/i.test(city.value) && !z) { showError('Please add your ZIP code so we know where the home is.'); zip.focus(); return false; }
    }
    for (const el of step.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), select, textarea')) {
      if (el.closest('.hp')) continue;
      if (!el.checkValidity()) {
        const name = (el.labels && el.labels[0] ? el.labels[0].textContent : 'this field').replace(/\(optional\)/i, '').trim();
        showError('Please check ' + name.toLowerCase() + '.');
        el.focus();
        return false;
      }
    }
    showError('');
    return true;
  };

  qs.show = function (i, focus) {
    qs.current = i;
    steps.forEach((s, k) => { s.hidden = k !== i; });
    const last = i === steps.length - 1;
    back.hidden = i === 0;
    nextBtn.hidden = last;
    form.classList.toggle('is-last', last);
    count.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
    label.textContent = steps[i].dataset.name || '';
    bar.style.width = ((i + 1) / steps.length * 100) + '%';
    showError('');
    if (focus) {
      const top = form.getBoundingClientRect().top;
      if (top < 70 || top > window.innerHeight * 0.6) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const first = steps[i].querySelector('input:checked') || steps[i].querySelector('input:not([type="hidden"]), select');
      if (first && !(first.type === 'radio' && window.matchMedia('(hover: none)').matches)) first.focus({ preventScroll: true });
    }
  };
  qs.next = function () { if (qs.valid(qs.current) && qs.current < steps.length - 1) qs.show(qs.current + 1, true); };
  qs.done = function () { form.classList.add('is-done'); };

  back.addEventListener('click', () => { if (qs.current > 0) qs.show(qs.current - 1, true); });
  nextBtn.addEventListener('click', qs.next);
  steps.forEach((step, i) => {
    step.addEventListener('change', (e) => {
      if (e.target.type !== 'radio') return;
      showError('');
      const groups = radioGroups(step);
      const complete = groups.every((n) => step.querySelector('input[name="' + n + '"]:checked'));
      if (complete && (step.hasAttribute('data-auto') || groups.length > 1)) setTimeout(() => { if (qs.current === i) qs.next(); }, 220);
    });
  });
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
    if (qs.current < steps.length - 1) { e.preventDefault(); qs.next(); }
  });
  form._qs = qs;
  form.classList.add('is-stepped');
  qs.show(0, false);
}

function initForms() {
  document.querySelectorAll('form[data-quote]').forEach((form) => {
    form.dataset.started = String(Date.now());
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.dataset.label = btn.textContent;
    initStepper(form);
    form.addEventListener('submit', handleQuote);
  });
}

function adsConversion(kind) {
  const conv = (window.OWL_ADS_CONV || {})[kind];
  if (window.gtag && conv) window.gtag('event', 'conversion', { send_to: conv });
}

function trackLead(source) {
  if (window.gtag) window.gtag('event', 'generate_lead', { form: 'quote', source });
  adsConversion('lead');
}

function initCallTracking() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="tel:"]');
    if (!a) return;
    if (window.gtag) window.gtag('event', 'phone_call_click', { link_url: a.getAttribute('href'), page: location.pathname });
    adsConversion('call');
  });
}

function initYear() {
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
}

document.addEventListener('DOMContentLoaded', () => {
  initTracking();
  initMenu();
  initForms();
  initCallTracking();
  initYear();
});
