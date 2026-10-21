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
    message: (data.get('message') || '').trim(),
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
    setStatus(form, 'ok', 'Thank you! Your request is in. We will reach out shortly with your quote. Prefer to talk now? Call ' + callLink + '.');
    trackLead(payload.formOrigin);
  } catch (err) {
    setStatus(form, 'error', 'We could not send your request right now. Please call or text us at ' + callLink + ' and we will get you a quote today.');
  } finally {
    btn.disabled = false;
    btn.textContent = btn.dataset.label || 'Get My Quote';
  }
}

function initForms() {
  document.querySelectorAll('form[data-quote]').forEach((form) => {
    form.dataset.started = String(Date.now());
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.dataset.label = btn.textContent;
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
