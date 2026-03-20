import './style.css';
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";

// --- 1. Firebase 設定 (略) ---
const firebaseConfig = {
  apiKey: "AIzaSyAZQUdpEvJ26zn5rfIdQgcwCcQosg4PQok",
  authDomain: "buyalot-2e838.firebaseapp.com",
  projectId: "buyalot-2e838",
  storageBucket: "buyalot-2e838.firebasestorage.app",
  messagingSenderId: "113950833516",
  appId: "1:113950833516:web:e63d356afc2f8f152f9149",
  measurementId: "G-9PML3EZVPC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- 2. 全域狀態 ---
let currentUser = null;
let activeApp = 'buy';
let activeTab = 'add';
let displayMode = { buy: 'list', dinner: 'grid' };
let selectedFile = null;
let records = { buy: [], dinner: [] };

// --- 3. DOM 元素 ---
const el = {
    appTitle: document.querySelector('#app-title'),
    userSection: document.querySelector('#user-section'),
    appSwitcher: document.querySelector('#app-switcher'),
    appTabs: document.querySelectorAll('.app-tab'),
    bottomNav: document.querySelector('#bottom-nav'),
    navTabs: document.querySelectorAll('.nav-tab'),
    viewLogin: document.querySelector('#view-login'),
    containerBuy: document.querySelector('#container-buy'),
    containerDinner: document.querySelector('#container-dinner'),
    modalImage: document.querySelector('#modal-image'),
    fullImg: document.querySelector('#full-img'),
    modalImgTitle: document.querySelector('#modal-img-title'),
    modalImgInfo: document.querySelector('#modal-img-info'),
    modalEdit: document.querySelector('#modal-edit'),
    appAlert: document.querySelector('#app-alert'),
    alertIcon: document.querySelector('#alert-icon'),
    alertMessage: document.querySelector('#alert-message'),
    btnAlertOk: document.querySelector('#btn-alert-ok')
};

function showAlert(msg, icon = '✅') {
    el.alertIcon.innerText = icon;
    el.alertMessage.innerText = msg;
    el.appAlert.classList.remove('hidden');
}
el.btnAlertOk.onclick = () => el.appAlert.classList.add('hidden');

// --- 4. 視圖切換 (略) ---
function updateUI() {
    el.viewLogin.classList.add('hidden');
    el.containerBuy.classList.add('hidden');
    el.containerDinner.classList.add('hidden');
    el.appSwitcher.classList.add('hidden');
    el.bottomNav.classList.add('hidden');
    if (!currentUser) { el.viewLogin.classList.remove('hidden'); return; }
    el.appSwitcher.classList.remove('hidden');
    el.bottomNav.classList.remove('hidden');
    if (activeApp === 'buy') {
        el.containerBuy.classList.remove('hidden');
        el.appTitle.innerText = "BuyLog 💰";
        el.appTitle.className = "text-3xl font-black text-blue-600 tracking-tighter";
        document.querySelector('#view-buy-add').classList.toggle('hidden', activeTab !== 'add');
        document.querySelector('#view-buy-history').classList.toggle('hidden', activeTab !== 'history');
    } else {
        el.containerDinner.classList.remove('hidden');
        el.appTitle.innerText = "MyDinner 🥘";
        el.appTitle.className = "text-3xl font-black text-amber-600 tracking-tighter";
        document.querySelector('#view-dinner-add').classList.toggle('hidden', activeTab !== 'add');
        document.querySelector('#view-dinner-history').classList.toggle('hidden', activeTab !== 'history');
    }
    updateTabStyles();
    if (activeTab === 'history') loadData();
}

function updateTabStyles() {
    const activeColor = activeApp === 'buy' ? 'text-blue-600' : 'text-amber-600';
    const activeBg = activeApp === 'buy' ? 'bg-blue-50' : 'bg-amber-50';
    el.appTabs.forEach(btn => {
        const isActive = btn.dataset.app === activeApp;
        btn.classList.toggle('bg-white', isActive);
        btn.classList.toggle('shadow-md', isActive);
        btn.classList.toggle(activeColor, isActive);
        btn.classList.toggle('text-gray-400', !isActive);
    });
    el.navTabs.forEach(btn => {
        const isActive = btn.dataset.view === activeTab;
        btn.classList.toggle(activeColor, isActive);
        btn.classList.toggle('text-gray-300', !isActive);
        btn.classList.toggle('scale-110', isActive);
    });
    document.querySelectorAll('.btn-display-mode').forEach(btn => {
        const isCurrent = btn.dataset.mode === displayMode[btn.dataset.app];
        btn.classList.toggle(activeColor, isCurrent); btn.classList.toggle(activeBg, isCurrent); btn.classList.toggle('text-gray-300', !isCurrent);
    });
}

// --- 5. 資料讀取與渲染 ---
async function loadData() {
    const col = activeApp === 'buy' ? 'purchases' : 'dinners';
    const container = document.querySelector(activeApp === 'buy' ? '#history-container-buy' : '#history-container-dinner');
    container.innerHTML = '<p class="text-center text-gray-400 py-32 text-xl font-bold animate-pulse italic">讀取紀錄中...</p>';
    try {
        const q = query(collection(db, col), where("userId", "==", currentUser.uid), orderBy("date", "desc"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        records[activeApp] = []; snap.forEach(d => records[activeApp].push({ id: d.id, ...d.data() }));
        renderHistory(container);
    } catch (err) { container.innerHTML = `<p class="text-center text-red-400 py-20">${err.message}</p>`; }
}

function renderHistory(container) {
    const keyword = document.querySelector(activeApp === 'buy' ? '#search-keyword-buy' : '#search-keyword-dinner').value.trim().toLowerCase();
    const filtered = records[activeApp].filter(r => r.itemName.toLowerCase().includes(keyword) || (r.remarks && r.remarks.toLowerCase().includes(keyword)));
    const mode = displayMode[activeApp];
    if (filtered.length === 0) { container.innerHTML = '<p class="text-center text-gray-400 py-32 text-xl font-black">查無紀錄 🔍</p>'; return; }
    
    let html = "";
    if (mode === 'list') {
        container.className = "space-y-5";
        html = filtered.map(d => `
            <div class="bg-white p-5 rounded-[2rem] shadow-sm flex gap-5 items-center border border-gray-50 active:bg-gray-50 transition-colors">
                <div class="w-24 h-24 bg-gray-100 rounded-2xl overflow-hidden flex-shrink-0 cursor-zoom-in border border-gray-100 shadow-inner">
                    ${d.imageUrl ? `<img src="${d.imageUrl}" class="w-full h-full object-cover img-trigger" data-id="${d.id}">` : `<div class="w-full h-full flex items-center justify-center text-gray-300"><svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`}
                </div>
                <div class="flex-grow"><h3 class="font-black text-gray-800 text-xl leading-tight mb-1">${d.itemName}</h3><p class="text-sm text-gray-400 font-bold tracking-wider">${d.date}</p></div>
                <div class="text-right flex flex-col items-end gap-3">${d.price ? `<p class="${activeApp === 'buy' ? 'text-blue-600' : 'text-amber-600'} font-black text-2xl tracking-tighter">$${d.price}</p>` : ''}<button class="btn-edit-trigger text-sm font-black bg-gray-100 text-gray-500 px-4 py-2 rounded-xl" data-id="${d.id}">修改</button></div>
            </div>
        `).join('');
    } else {
        container.className = "grid grid-cols-2 gap-5";
        html = filtered.map(d => `
            <div class="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-gray-50 relative active:scale-95 transition-transform">
                <div class="aspect-square bg-gray-100 overflow-hidden cursor-zoom-in shadow-inner">
                    ${d.imageUrl ? `<img src="${d.imageUrl}" class="w-full h-full object-cover img-trigger" data-id="${d.id}">` : `<div class="w-full h-full flex items-center justify-center text-gray-300"><svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`}
                </div>
                <div class="p-4"><h3 class="font-black text-gray-800 text-lg truncate mb-1">${d.itemName}</h3><div class="flex justify-between items-center mb-3"><p class="text-xs text-gray-400 font-bold">${d.date.substring(5)}</p>${d.price ? `<p class="${activeApp === 'buy' ? 'text-blue-600' : 'text-amber-600'} font-black text-lg">$${d.price}</p>` : ''}</div><button class="btn-edit-trigger w-full text-sm font-black bg-gray-100 text-gray-500 py-2.5 rounded-xl" data-id="${d.id}">修改</button></div>
            </div>
        `).join('');
    }
    container.innerHTML = html;

    // 重新綁定事件
    container.querySelectorAll('.img-trigger').forEach(img => {
        img.onclick = () => {
            const data = records[activeApp].find(r => r.id === img.dataset.id);
            el.fullImg.src = data.imageUrl;
            el.modalImgTitle.innerText = data.itemName;
            // 關鍵：根據 App 切換大圖顯示的內容
            if (activeApp === 'buy') {
                el.modalImgInfo.innerText = `金額：$${data.price}`;
                el.modalImgInfo.className = "text-2xl font-black text-blue-400";
            } else {
                el.modalImgInfo.innerText = data.remarks || "（無備註）";
                el.modalImgInfo.className = "text-xl font-bold text-amber-400 italic leading-relaxed";
            }
            el.modalImage.classList.remove('hidden');
        };
    });

    container.querySelectorAll('.btn-edit-trigger').forEach(btn => {
        btn.onclick = () => {
            const data = records[activeApp].find(r => r.id === btn.dataset.id);
            document.querySelector('#edit-id').value = data.id;
            document.querySelector('#edit-type').value = activeApp;
            document.querySelector('#edit-name').value = data.itemName;
            document.querySelector('#edit-price').value = data.price || '';
            document.querySelector('#edit-remarks').value = data.remarks || '';
            document.querySelector('#edit-field-price').classList.toggle('hidden', activeApp !== 'buy');
            document.querySelector('#edit-field-remarks').classList.toggle('hidden', activeApp !== 'dinner');
            el.modalEdit.classList.remove('hidden');
        };
    });
}

// --- 6. 剩下的邏輯 (保持不變) ---
document.querySelector('#btn-login').onclick = () => signInWithPopup(auth, provider);
el.appTabs.forEach(btn => btn.onclick = () => { activeApp = btn.dataset.app; activeTab = 'add'; updateUI(); });
el.navTabs.forEach(btn => btn.onclick = () => { activeTab = btn.dataset.view; updateUI(); });
document.querySelectorAll('.btn-display-mode').forEach(btn => { btn.onclick = () => { displayMode[btn.dataset.app] = btn.dataset.mode; updateUI(); }; });

const setupCamera = (id) => {
    document.querySelector(`#camera-box-${id}`).onclick = () => document.querySelector(`#input-camera-${id}`).click();
    document.querySelector(`#input-camera-${id}`).onchange = e => {
        const f = e.target.files[0]; if (f) { document.querySelector(`#preview-img-${id}`).src = URL.createObjectURL(f); document.querySelector(`#preview-img-${id}`).classList.remove('hidden'); document.querySelector(`#camera-placeholder-${id}`).classList.add('hidden'); document.querySelector(`#btn-remove-img-${id}`).classList.remove('hidden'); selectedFile = f; }
    };
    document.querySelector(`#btn-remove-img-${id}`).onclick = e => { e.stopPropagation(); selectedFile = null; document.querySelector(`#input-camera-${id}`).value = ""; document.querySelector(`#preview-img-${id}`).classList.add('hidden'); document.querySelector(`#camera-placeholder-${id}`).classList.remove('hidden'); e.target.classList.add('hidden'); };
};
setupCamera('buy'); setupCamera('dinner');

document.querySelector('#search-keyword-buy').oninput = () => renderHistory(document.querySelector('#history-container-buy'));
document.querySelector('#search-keyword-dinner').oninput = () => renderHistory(document.querySelector('#history-container-dinner'));

async function compressImage(file) {
    return new Promise(r => {
        const img = new Image(); img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1000 / img.width, 1);
            canvas.width = img.width * scale; canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            r(canvas.toDataURL('image/jpeg', 0.8)); URL.revokeObjectURL(img.src);
        };
    });
}

const handleSubmit = async (id, col, dataFn) => {
    const btn = document.querySelector(`#add-form-${id} button[type="submit"]`);
    try {
        btn.disabled = true; btn.innerText = "⚡ 壓縮中...";
        let b64 = selectedFile ? await compressImage(selectedFile) : "";
        btn.innerText = "☁️ 儲存中...";
        await addDoc(collection(db, col), { userId: currentUser.uid, ...dataFn(), imageUrl: b64, createdAt: new Date() });
        showAlert("紀錄成功！✅");
        document.querySelector(`#add-form-${id}`).reset(); document.querySelector(`#input-date-${id}`).valueAsDate = new Date(); document.querySelector(`#btn-remove-img-${id}`).click();
    } catch (err) { showAlert(err.message, '❌'); } finally { btn.disabled = false; btn.innerText = "儲存紀錄"; }
};
document.querySelector('#add-form-buy').onsubmit = e => { e.preventDefault(); handleSubmit('buy', 'purchases', () => ({ itemName: document.querySelector('#input-name-buy').value, price: Number(document.querySelector('#input-price-buy').value), date: document.querySelector('#input-date-buy').value })); };
document.querySelector('#add-form-dinner').onsubmit = e => { e.preventDefault(); handleSubmit('dinner', 'dinners', () => ({ itemName: document.querySelector('#input-name-dinner').value, date: document.querySelector('#input-date-dinner').value, remarks: document.querySelector('#input-remarks-dinner').value })); };

document.querySelector('#btn-close-img-modal').onclick = () => el.modalImage.classList.add('hidden');
document.querySelector('#btn-close-edit-modal').onclick = () => el.modalEdit.classList.add('hidden');
document.querySelector('#edit-form').onsubmit = async e => {
    e.preventDefault(); const t = document.querySelector('#edit-type').value; const id = document.querySelector('#edit-id').value;
    const col = t === 'buy' ? 'purchases' : 'dinners';
    const data = t === 'buy' ? { itemName: document.querySelector('#edit-name').value, price: Number(document.querySelector('#edit-price').value) } : { itemName: document.querySelector('#edit-name').value, remarks: document.querySelector('#edit-remarks').value };
    try { await updateDoc(doc(db, col, id), data); el.modalEdit.classList.add('hidden'); showAlert("已更新！✨"); loadData(); } catch (err) { showAlert(err.message, '❌'); }
};
document.querySelector('#btn-delete-record').onclick = async () => {
    el.modalEdit.classList.add('hidden');
    if (!confirm("確定刪除？")) return;
    const t = document.querySelector('#edit-type').value; const id = document.querySelector('#edit-id').value;
    try { await deleteDoc(doc(db, t === 'buy' ? 'purchases' : 'dinners', id)); showAlert("已刪除！🗑️"); loadData(); } catch (err) { showAlert(err.message, '❌'); }
};

onAuthStateChanged(auth, u => {
    currentUser = u;
    if (u) el.userSection.innerHTML = `<img src="${u.photoURL}" class="w-12 h-12 rounded-full border-2 border-white shadow-md">`;
    else el.userSection.innerHTML = '';
    updateUI();
});
document.querySelector('#input-date-buy').valueAsDate = new Date();
document.querySelector('#input-date-dinner').valueAsDate = new Date();
