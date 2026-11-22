const API = '';
const chatSession = 'pub-' + Math.random().toString(36).slice(2);

// Header scroll
const header = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 20);
});

// Burger
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
if (burger) burger.addEventListener('click', () => navLinks.classList.toggle('open'));

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Contact form
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: fd.get('name'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      message: fd.get('message'),
      source: 'landing'
    };
    const msg = document.getElementById('formMsg');
    try {
      const r = await fetch('/api/leads', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('error');
      msg.textContent = '¡Gracias! Tu solicitud fue enviada. Te contactaremos pronto.';
      form.reset();
    } catch {
      msg.textContent = 'No se pudo enviar. Intenta por teléfono o correo.';
    }
  });
}

// Chat widget
const fab = document.getElementById('chatFab');
const panel = document.getElementById('chatPanel');
const closeBtn = document.getElementById('chatClose');
const body = document.getElementById('chatBody');
const input = document.getElementById('chatInput');
const send = document.getElementById('chatSend');

function addMsg(text, who) {
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg ' + who;
  const b = document.createElement('div');
  b.className = 'chat-bubble';
  b.textContent = text;
  wrap.appendChild(b);
  body.appendChild(wrap);
  body.scrollTop = body.scrollHeight;
}
function showTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg bot';
  wrap.id = 'typing';
  wrap.innerHTML = '<div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>';
  body.appendChild(wrap);
  body.scrollTop = body.scrollHeight;
}
function hideTyping() { const t = document.getElementById('typing'); if (t) t.remove(); }

const OPENROUTER_KEY = ""; // Agrega tu key de OpenRouter para habilitar IA
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function localFaq(text) {
  const low = text.toLowerCase();
  const info = { hours: "Lun-Dom 8:00-22:00", location: "Paraíso, Tabasco", phone: "(933) 688 55 85", email: "contacto@puertoamgourmet.mx" };
  if (low.includes("hora") || low.includes("horario") || low.includes("abren") || low.includes("cierran")) return "¡Claro! Nuestro horario es " + info.hours + ". Te esperamos para disfrutar del mejor sabor del mar. ¿Te gustaría reservar mesa?";
  if (low.includes("ubicacion") || low.includes("ubicación") || low.includes("donde") || low.includes("dónde") || low.includes("dirección") || low.includes("direccion")) return "Estamos en " + info.location + ". Escríbenos al " + info.phone + " y te enviamos la ubicación exacta y cómo llegar. ¡Te esperamos!";
  if (low.includes("telefono") || low.includes("teléfono") || low.includes("contacto") || low.includes("whatsapp")) return "Puedes llamarnos al " + info.phone + " o escribir a " + info.email + ". Con gusto te atendemos.";
  if (low.includes("menu") || low.includes("menú") || low.includes("carta") || low.includes("platillo") || low.includes("comida")) return "Nuestro menú costero es una delicia: Huachinango a la Talla ($450, estrella de la casa), Camarones al Coco ($295), Molcajete de Mariscos ($380 para compartir), Filete de Robalo al Grill ($320) y más. ¿Te antoja alguno? Te envío la carta completa por WhatsApp.";
  if (low.includes("huachinango") || low.includes("estrella")) return "El Huachinango a la Talla ($450) es nuestra estrella: huachinango entero marinado en achiote, asado a la leña. ¡Una experiencia inolvidable! ¿Te gustaría reservar para probarlo?";
  if (low.includes("camaron") || low.includes("camarón") || low.includes("camarones")) return "Los Camarones al Coco ($295) son una delicia: empanizados en coco con salsa de mango y chile. Y el Ceviche de Camarón ($165) es fresco y ligero. ¿Te antoja alguno?";
  if (low.includes("pedido") || low.includes("estatus") || low.includes("rastrear") || low.includes("seguimiento")) return "No puedo rastrear pedidos en línea, pero con gusto damos seguimiento. Déjanos tu nombre, teléfono y número de pedido por WhatsApp y te confirmamos el estatus a la brevedad.";
  if (low.includes("reserva") || low.includes("reservar") || low.includes("mesa")) return "¡Con gusto! Para reservar necesito: nombre, teléfono, fecha, hora y número de personas. Déjanos esos datos aquí o por WhatsApp al " + info.phone + " y confirmamos en minutos.";
  if (low.includes("catering") || low.includes("evento") || low.includes("boda") || low.includes("comedor industrial")) return "Ofrecemos catering para eventos y comedor industrial. Cuéntanos fecha, número de personas y tipo de evento y te cotizamos. ¡Hacemos tu evento inolvidable!";
  if (low.includes("precio") || low.includes("costo") || low.includes("cuanto") || low.includes("cuánto")) return "Los precios varían por platillo y temporada. El Huachinango a la Talla está en $450, los Camarones al Coco en $295. Envíanos tu solicitud y te cotizamos sin compromiso.";
  if (low.includes("postre") || low.includes("flan") || low.includes("pastel") || low.includes("helado")) return "Para cerrar con broche de oro: Flan de Coco ($85), Pastel de Chocolate ($95) o Helado de Vainilla ($70). ¿Te antoja uno con tu platillo?";
  return "¡Hola! Soy el asistente de Puerto A&M. Puedo ayudarte con horarios, ubicación, reservas, catering, menú y contacto. ¿Te gustaría ver nuestro menú costero o reservar una mesa? Escríbenos al " + info.email + " o " + info.phone + ".";
}

async function sendMsg() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addMsg(text, 'user');
  showTyping();
  // Intentar IA directa (sin n8n)
  try {
    const SOUL = "Eres el asistente virtual de Puerto A&M Gourmet, restaurante de comida costera en Paraíso, Tabasco. Amable, cálido y persuasivo. Conoces el menú: Ceviche de Camarón $165, Sopa de Mariscos $140, Tostadas de Atún $150, Coctel de Camarón $175, Taco de Pescado a la Veracruzana $185, Filete de Robalo al Grill $320, Camarones al Coco $295, Huachinango a la Talla $450 (estrella), Molcajete de Mariscos $380, Enchiladas de Mariscos $210, Horchata $45, Limonada $55, Cerveza Artesanal $95, Vino Blanco $180, Flan de Coco $85, Pastel de Chocolate $95, Helado de Vainilla $70. Antoja describiendo sabores. Puedes tomar reservas (pide nombre, teléfono, fecha, hora, personas) y pedidos (platillos, cantidades, nombre, teléfono, dirección, hora). Sugiere bebidas y postres. No inventes datos fuera del menú. Horario Lun-Dom 8:00-22:00. Tel (933) 688 55 85. Email contacto@puertoamgourmet.mx. Responde en español, claro y conciso, máximo ~120 palabras. Termina con llamado a la acción.";
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'HTTP-Referer': window.location.href, 'X-Title': 'Puerto A&M' },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it:free',
        messages: [
          { role: 'system', content: SOUL },
          { role: 'user', content: text }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });
    const data = await r.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    hideTyping();
    if (reply) { addMsg(reply, 'bot'); return; }
  } catch (e) {}
  // Fallback local (sin IA)
  hideTyping();
  addMsg(localFaq(text), 'bot');
}
if (fab) fab.addEventListener('click', () => { panel.classList.toggle('open'); if (panel.classList.contains('open') && body.childElementCount === 0) addMsg('¡Hola! Soy el asistente de Puerto A&M. ¿En qué puedo ayudarte? (horarios, reservas, catering, menú, contacto)', 'bot'); });
if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.remove('open'));
if (send) send.addEventListener('click', sendMsg);
if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });
