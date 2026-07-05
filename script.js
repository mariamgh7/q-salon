import { db } from "./firebase.js";
import { collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const SERVICES = {
  haircut: { name:'قص الشعر', price:5, duration:45, interval:60, capacity:2 },
  beard:   { name:'تشذيب اللحية', price:3, duration:30, interval:45, capacity:2 },
  combo:   { name:'شعر ولحية', price:7, duration:60, interval:60, capacity:2 },
  skin:    { name:'تنظيف البشرة', price:10, duration:90, interval:120, capacity:1 },
};

let currentService = null;
let selectedSlot = null;
let pendingService = null;
let bookingStep = 1;
let depositScreenshotData = null;
let bookingsCache = []; // fetched ONCE per openBooking() call, reused for every slot check

function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }

function toggleMobileNav(){
  const nav = document.getElementById('mobileNav');
  nav.style.display = (nav.style.display === 'flex') ? 'none' : 'flex';
}

function sendCode(){
  const phone = document.getElementById('phoneInput').value.trim();
  if(phone.length < 8){
    showToast('يرجى إدخال رقم هاتف صحيح');
    return;
  }
  localStorage.setItem('q_customer_name', document.getElementById('nameInput').value || 'زبون');
  localStorage.setItem('q_customer_phone', phone);
  closeModal('loginModal');
  showToast('تم تسجيل الدخول برقم ' + phone);

  if(pendingService){
    const resumeService = pendingService;
    pendingService = null;
    openBooking(resumeService);
  }
}

async function loadBookings(){
  const snapshot = await getDocs(collection(db, "bookings"));
  // spread doc.data() FIRST, then doc.id — so the real Firestore ID always wins
  // over any stray "id" field that might exist inside the saved data.
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
  }));
}

async function saveBookingRecord(b){
  await addDoc(collection(db, "bookings"), {
    ...b,
    createdAt: Date.now(),
  });
}

function generateSlots(service){
  // stays sync — it never touches Firestore, no reason to await it
  const slots = [];
  const startMin = 10 * 60; // 10:00
  const endMin = 23 * 60;   // 23:00
  for(let t = startMin; t + service.duration <= endMin; t += service.interval){
    const h = Math.floor(t / 60), m = t % 60;
    slots.push(h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0'));
  }
  return slots;
}

function countBookings(serviceKey, slot){
  // reads from the cache fetched once in openBooking() — no per-slot Firestore hit
  return bookingsCache.filter(b => b.service === serviceKey && b.slot === slot).length;
}

async function openBooking(serviceKey){
  if(!localStorage.getItem('q_customer_phone')){
    pendingService = serviceKey;
    openModal('loginModal');
    showToast('سجّل دخولك أولًا لإكمال الحجز');
    return;
  }

  currentService = serviceKey;
  selectedSlot = null;
  bookingStep = 1;
  const s = SERVICES[serviceKey];

  document.getElementById('bookingTitle').textContent = 'حجز: ' + s.name;
  document.getElementById('bookingSub').textContent = 'جاري تحميل الأوقات المتاحة...';
  openModal('bookingModal');

  const container = document.getElementById('slotsContainer');
  container.style.display = 'block';
  container.innerHTML = '';

  try{
    bookingsCache = await loadBookings(); // ONE Firestore read for the whole modal
  }catch(err){
    console.error('Firestore load failed', err);
    bookingsCache = [];
    showToast('تعذّر تحميل الأوقات، حاول مجددًا');
  }

  document.getElementById('bookingSub').textContent =
    'السعر ' + s.price + ' دينار — اختر الوقت المناسب لك من 10 صباحًا حتى 11 مساءً.';

  const slots = generateSlots(s);
  container.innerHTML = '<div class="slots-grid" id="slotsGrid"></div>';
  const grid = document.getElementById('slotsGrid');

  slots.forEach(slot => {
    const taken = countBookings(serviceKey, slot); // sync now, reads the cache
    const full = taken >= s.capacity;
    const btn = document.createElement('button');
    btn.className = 'slot-btn' + (full ? ' full' : '');
    btn.textContent = slot;
    btn.disabled = full;
    btn.onclick = () => {
      document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSlot = slot;
      document.getElementById('confirmBookingBtn').disabled = false;
    };
    grid.appendChild(btn);
  });

  document.getElementById('depositStep').style.display = 'none';
  document.getElementById('depositScreenshot').value = '';
  document.getElementById('screenshotPreview').style.display = 'none';
  depositScreenshotData = null;
  const btn = document.getElementById('confirmBookingBtn');
  btn.textContent = 'متابعة: تأكيد العربون';
  btn.disabled = true;
}

function proceedBooking(){
  if(bookingStep === 1){
    if(!currentService || !selectedSlot) return;
    bookingStep = 2;
    document.getElementById('slotsContainer').style.display = 'none';
    document.getElementById('depositStep').style.display = 'block';
    const btn = document.getElementById('confirmBookingBtn');
    btn.textContent = 'تأكيد الحجز';
    btn.disabled = true;
  } else {
    finalizeBooking();
  }
}

function backToSlots(){
  bookingStep = 1;
  document.getElementById('depositStep').style.display = 'none';
  document.getElementById('slotsContainer').style.display = 'block';
  document.getElementById('depositScreenshot').value = '';
  document.getElementById('screenshotPreview').style.display = 'none';
  depositScreenshotData = null;
  const btn = document.getElementById('confirmBookingBtn');
  btn.textContent = 'متابعة: تأكيد العربون';
  btn.disabled = !selectedSlot;
}

function handleScreenshotUpload(event){
  const file = event.target.files[0];
  const btn = document.getElementById('confirmBookingBtn');
  if(!file){
    depositScreenshotData = null;
    document.getElementById('screenshotPreview').style.display = 'none';
    btn.disabled = true;
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    depositScreenshotData = e.target.result;
    document.getElementById('screenshotImg').src = depositScreenshotData;
    document.getElementById('screenshotPreview').style.display = 'block';
    btn.disabled = false;
  };
  reader.readAsDataURL(file);
}

async function finalizeBooking(){
  if(!currentService || !selectedSlot) return;

  const phone = localStorage.getItem('q_customer_phone');
  if(!phone){
    pendingService = currentService;
    closeModal('bookingModal');
    showToast('يرجى تسجيل الدخول برقم هاتفك أولًا');
    openModal('loginModal');
    return;
  }
  if(!depositScreenshotData){
    showToast('يرجى إرفاق سكرين شوت التحويل أولًا');
    return;
  }

  const s = SERVICES[currentService];
  const confirmBtn = document.getElementById('confirmBookingBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'جاري التأكد من توفر الموعد...';

  // re-check against FRESH data right before writing — closes most of the
  // race window where two people book the same slot at nearly the same time.
  // (not 100% atomic — a true fix needs a Firestore transaction — but this
  // catches the vast majority of real-world double-booking cases for a
  // single-location shop like this.)
  let freshBookings = [];
  try{
    freshBookings = await loadBookings();
  }catch(err){
    console.error('Firestore re-check failed', err);
    showToast('تعذّر التأكد من توفر الموعد، حاول مرة ثانية');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'تأكيد الحجز';
    return;
  }
  const takenNow = freshBookings.filter(b => b.service === currentService && b.slot === selectedSlot).length;
  if(takenNow >= s.capacity){
    showToast('عذرًا، هذا الموعد امتلأ للتو — اختر وقتًا آخر');
    bookingsCache = freshBookings;
    backToSlots();
    openBooking(currentService); // re-render slots with the up-to-date counts
    return;
  }

  const booking = {
    service: currentService,
    serviceName: s.name,
    price: s.price,
    slot: selectedSlot,
    date: new Date().toLocaleDateString('ar-JO'),
    name: localStorage.getItem('q_customer_name') || 'زبون',
    phone: phone,
    depositProof: true,
  };

  confirmBtn.textContent = 'جاري الحجز...';

  try{
    await saveBookingRecord(booking);
    closeModal('bookingModal');
    showTicket(booking);
  }catch(err){
    console.error('Firestore save failed', err);
    showToast('صار خطأ أثناء الحجز، حاول مرة ثانية');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'تأكيد الحجز';
  }
}

function showTicket(b){
  document.getElementById('ticketBody').innerHTML = `
    <div class="big">Salon Q · تذكرة حجز</div>
    <div class="row"><span>الخدمة</span><b>${b.serviceName}</b></div>
    <div class="row"><span>الاسم</span><b>${b.name}</b></div>
    <div class="row"><span>الهاتف</span><b dir="ltr" style="unicode-bidi:plaintext;">${b.phone}</b></div>
    <div class="row"><span>الوقت</span><b>${b.slot} — ${b.date}</b></div>
    <div class="row"><span>السعر</span><b>${b.price} دينار</b></div>
    <div class="row"><span>العربون المطلوب</span><b>1 دينار عبر CliQ</b></div>
  `;
  openModal('ticketModal');
}

async function renderAdmin(){
  const el = document.getElementById('adminList');
  el.innerHTML = '<p style="color:var(--cream-dim);">جاري التحميل...</p>';

  let all = [];
  try{
    all = await loadBookings();
  }catch(err){
    console.error('Firestore admin load failed', err);
    el.innerHTML = '<p style="color:var(--cream-dim);">تعذّر تحميل الحجوزات.</p>';
    return;
  }

  all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if(all.length === 0){
    el.innerHTML = '<p style="color:var(--cream-dim);">لا توجد حجوزات مسجّلة بعد.</p>';
    return;
  }

  el.innerHTML = all.map(b => `
    <div style="display:flex; justify-content:space-between; gap:10px; padding:12px 0; border-bottom:1px solid rgba(237,230,214,0.1);">
      <div>
        <div style="font-weight:700; color:var(--cream);">${b.serviceName} — ${b.name} ${b.depositProof ? '<span style="color:var(--gold-light); font-size:0.78rem;">✓ سكرين مرفق</span>' : ''}</div>
        <div style="color:var(--cream-dim); font-size:0.85rem;" dir="ltr">${b.phone}</div>
      </div>
      <div style="text-align:end; color:var(--gold-light); font-weight:700;">${b.slot}<div style="color:var(--cream-dim); font-size:0.8rem;">${b.date}</div></div>
    </div>
  `).join('');
}

// FAQ accordion
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.classList.toggle('open');
  });
});

// Toast
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// Scroll reveal
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('in-view'); });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', (e) => { if(e.target === ov) ov.classList.remove('active'); });
});

// Expose to window — required for every inline onclick="..." in the HTML to find these
window.openBooking = openBooking;
window.sendCode = sendCode;
window.closeModal = closeModal;
window.openModal = openModal;
window.toggleMobileNav = toggleMobileNav;
window.proceedBooking = proceedBooking;
window.backToSlots = backToSlots;
window.handleScreenshotUpload = handleScreenshotUpload;
window.renderAdmin = renderAdmin;
