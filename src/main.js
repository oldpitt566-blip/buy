import './style.css';
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";

// --- 1. Firebase 設定 ---
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
let displayMode = { buy: 'list', dinner: 'grid' }; // 預設顯示模式
let selectedBase64 = "";
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
    modalEdit: document.querySelector('#modal-edit')
};

// --- 4. 核心邏輯 ---
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
        el.appTitle.className = "text-2xl font-black text-blue-600";
        document.querySelector('#view-buy-add').classList.toggle('hidden', activeTab !== 'add');
        document.querySelector('#view-buy-history').classList.toggle('hidden', activeTab !== 'history');
    } else {
        el.containerDinner.classList.remove('hidden');
        el.appTitle.innerText = "MyDinner 🥘";
        el.appTitle.className = "text-2xl font-black text-amber-600";
        document.querySelector('#view-dinner-add').classList.toggle('hidden', activeTab !== 'add');
        document.querySelector('#view-dinner-history').classList.toggle('hidden', activeTab !== 'history');
    }

    // 更新 Tab 狀態顏色
    updateTabStyles();
    if (activeTab === 'history') loadData();
}

function updateTabStyles() {
    el.appTabs.forEach(btn => {
        const isActive = btn.dataset.app === activeApp;
        btn.classList.toggle('bg-white', isActive);
        btn.classList.toggle('shadow-sm', isActive);
        btn.classList.toggle(activeApp === 'buy' ? 'text-blue-600' : 'text-amber-600', isActive);
        btn.classList.toggle('text-gray-400', !isActive);
    });
    el.navTabs.forEach(btn => {
        const isActive = btn.dataset.view === activeTab;
        btn.classList.toggle(activeApp === 'buy' ? 'text-blue-600' : 'text-amber-600', isActive);
        btn.classList.toggle('text-gray-300', !isActive);
    });
    // 更新顯示模式按鈕樣式
    document.querySelectorAll('.btn-display-mode').forEach(btn => {
        const isCurrent = btn.dataset.mode === displayMode[btn.dataset.app];
        const activeColor = btn.dataset.app === 'buy' ? 'text-blue-600' : 'text-amber-600';
        const activeBg = btn.dataset.app === 'buy' ? 'bg-blue-50' : 'bg-amber-50';
        btn.classList.toggle(activeColor, isCurrent);
        btn.classList.toggle(activeBg, isCurrent);
        btn.classList.toggle('text-gray-400', !isCurrent);
        btn.classList.toggle('bg-transparent', !isCurrent);
    });
}

// --- 5. 資料讀取與渲染 ---
async function loadData() {
    const col = activeApp === 'buy' ? 'purchases' : 'dinners';
    const container = document.querySelector(activeApp === 'buy' ? '#history-container-buy' : '#history-container-dinner');
    container.innerHTML = '<p class="text-center text-gray-400 py-20">讀取中...</p>';
    try {
        const q = query(collection(db, col), where("userId", "==", currentUser.uid), orderBy("date", "desc"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        records[activeApp] = [];
        snap.forEach(d => records[activeApp].push({ id: d.id, ...d.data() }));
        renderHistory(container);
    } catch (err) { container.innerHTML = `<p class="text-center text-red-400 py-20">${err.message}</p>`; }
}

function renderHistory(container) {
    const keyword = document.querySelector(activeApp === 'buy' ? '#search-keyword-buy' : '#search-keyword-dinner').value.trim().toLowerCase();
    const filtered = records[activeApp].filter(r => r.itemName.toLowerCase().includes(keyword) || (r.remarks && r.remarks.toLowerCase().includes(keyword)));
    const mode = displayMode[activeApp];

    if (filtered.length === 0) { container.innerHTML = '<p class="text-center text-gray-400 py-20">沒有資料</p>'; return; }

    if (mode === 'list') {
        container.className = "space-y-4";
        container.innerHTML = filtered.map(d => `
            <div class="bg-white p-4 rounded-[1.5rem] shadow-sm flex gap-4 items-center border border-gray-50">
                <div class="w-20 h-20 bg-gray-100 rounded-2xl overflow-hidden flex-shrink-0 cursor-zoom-in">
                    ${d.imageUrl ? `<img src="${d.imageUrl}" class="w-full h-full object-cover img-trigger" data-url="${d.imageUrl}">` : `<div class="w-full h-full flex items-center justify-center text-gray-300"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`}
                </div>
                <div class="flex-grow">
                    <h3 class="font-bold text-gray-800 text-lg leading-tight">${d.itemName}</h3>
                    <p class="text-xs text-gray-400 font-bold">${d.date} ${d.remarks ? `| ${d.remarks}` : ''}</p>
                </div>
                <div class="text-right flex flex-col items-end gap-2">
                    ${d.price ? `<p class="text-blue-600 font-black text-xl tracking-tighter">$${d.price}</p>` : ''}
                    <button class="btn-edit-trigger text-xs font-bold bg-gray-50 text-gray-400 px-3 py-1.5 rounded-lg" data-id="${d.id}" data-name="${d.itemName}" data-price="${d.price || ''}" data-remarks="${d.remarks || ''}">修改</button>
                </div>
            </div>
        `).join('');
    } else {
        // Grid 模式：每排兩張
        container.className = "grid grid-cols-2 gap-4";
        container.innerHTML = filtered.map(d => `
            <div class="bg-white rounded-[1.5rem] shadow-sm overflow-hidden border border-gray-50 relative group">
                <div class="aspect-square bg-gray-100 overflow-hidden cursor-zoom-in">
                    ${d.imageUrl ? `<img src="${d.imageUrl}" class="w-full h-full object-cover img-trigger" data-url="${d.imageUrl}">` : `<div class="w-full h-full flex items-center justify-center text-gray-300"><svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`}
                </div>
                <div class="p-3">
                    <h3 class="font-bold text-gray-800 text-sm truncate">${d.itemName}</h3>
                    <div class="flex justify-between items-center mt-1">
                        <p class="text-[10px] text-gray-400 font-bold">${d.date}</p>
                        ${d.price ? `<p class="text-blue-600 font-black text-sm">$${d.price}</p>` : ''}
                    </div>
                    <button class="btn-edit-trigger w-full mt-2 text-[10px] font-bold bg-gray-50 text-gray-400 py-1 rounded-md" data-id="${d.id}" data-name="${d.itemName}" data-price="${d.price || ''}" data-remarks="${d.remarks || ''}">修改</button>
                </div>
            </div>
        `).join('');
    }

    container.querySelectorAll('.img-trigger').forEach(img => img.onclick = () => { el.fullImg.src = img.dataset.url; el.modalImage.classList.remove('hidden'); });
    container.querySelectorAll('.btn-edit-trigger').forEach(btn => btn.onclick = () => {
        document.querySelector('#edit-id').value = btn.dataset.id; document.querySelector('#edit-type').value = activeApp;
        document.querySelector('#edit-name').value = btn.dataset.name; document.querySelector('#edit-price').value = btn.dataset.price; document.querySelector('#edit-remarks').value = btn.dataset.remarks;
        document.querySelector('#edit-field-price').classList.toggle('hidden', activeApp !== 'buy');
        document.querySelector('#edit-field-remarks').classList.toggle('hidden', activeApp !== 'dinner');
        el.modalEdit.classList.remove('hidden');
    });
}

// --- 6. 事件綁定 ---
document.querySelector('#btn-login').onclick = () => signInWithPopup(auth, provider);
el.appTabs.forEach(btn => btn.onclick = () => { activeApp = btn.dataset.app; activeTab = 'add'; updateUI(); });
el.navTabs.forEach(btn => btn.onclick = () => { activeTab = btn.dataset.view; updateUI(); });

// 顯示模式切換綁定
document.querySelectorAll('.btn-display-mode').forEach(btn => {
    btn.onclick = () => { displayMode[btn.dataset.app] = btn.dataset.mode; updateUI(); };
});

// 拍照與儲存邏輯 (壓縮代碼以節省空間)
const setupCamera = (id) => {
    document.querySelector(`#camera-box-${id}`).onclick = () => document.querySelector(`#input-camera-${id}`).click();
    document.querySelector(`#input-camera-${id}`).onchange = async e => {
        const f = e.target.files[0]; if (f) { selectedBase64 = await compressImage(f); const p = document.querySelector(`#preview-img-${id}`); p.src = selectedBase64; p.classList.remove('hidden'); document.querySelector(`#camera-placeholder-${id}`).classList.add('hidden'); document.querySelector(`#btn-remove-img-${id}`).classList.remove('hidden'); }
    };
    document.querySelector(`#btn-remove-img-${id}`).onclick = e => { e.stopPropagation(); selectedBase64 = ""; document.querySelector(`#input-camera-${id}`).value = ""; document.querySelector(`#preview-img-${id}`).classList.add('hidden'); document.querySelector(`#camera-placeholder-${id}`).classList.remove('hidden'); e.target.classList.add('hidden'); };
};
setupCamera('buy'); setupCamera('dinner');

document.querySelector('#search-keyword-buy').oninput = () => renderHistory(document.querySelector('#history-container-buy'));
document.querySelector('#search-keyword-dinner').oninput = () => renderHistory(document.querySelector('#history-container-dinner'));

const handleSubmit = async (id, col, dataFn) => {
    const btn = document.querySelector(`#add-form-${id} button[type="submit"]`);
    try {
        btn.disabled = true; btn.innerText = "儲存中...";
        await addDoc(collection(db, col), { userId: currentUser.uid, ...dataFn(), imageUrl: selectedBase64, createdAt: new Date() });
        alert("儲存成功！"); document.querySelector(`#add-form-${id}`).reset(); document.querySelector(`#input-date-${id}`).valueAsDate = new Date(); document.querySelector(`#btn-remove-img-${id}`).click();
    } catch (err) { alert(err.message); } finally { btn.disabled = false; btn.innerText = "儲存紀錄"; }
};
document.querySelector('#add-form-buy').onsubmit = e => { e.preventDefault(); handleSubmit('buy', 'purchases', () => ({ itemName: document.querySelector('#input-name-buy').value, price: Number(document.querySelector('#input-price-buy').value), date: document.querySelector('#input-date-buy').value })); };
document.querySelector('#add-form-dinner').onsubmit = e => { e.preventDefault(); handleSubmit('dinner', 'dinners', () => ({ itemName: document.querySelector('#input-name-dinner').value, date: document.querySelector('#input-date-dinner').value, remarks: document.querySelector('#input-remarks-dinner').value })); };

document.querySelector('#btn-close-img-modal').onclick = () => el.modalImage.classList.add('hidden');
document.querySelector('#btn-close-edit-modal').onclick = () => el.modalEdit.classList.add('hidden');
document.querySelector('#edit-form').onsubmit = async e => {
    e.preventDefault(); const t = document.querySelector('#edit-type').value; const id = document.querySelector('#edit-id').value;
    const data = t === 'buy' ? { itemName: document.querySelector('#edit-name').value, price: Number(document.querySelector('#edit-price').value) } : { itemName: document.querySelector('#edit-name').value, remarks: document.querySelector('#edit-remarks').value };
    try { await updateDoc(doc(db, t === 'buy' ? 'purchases' : 'dinners', id), data); el.modalEdit.classList.add('hidden'); loadData(); } catch (err) { alert(err.message); }
};
document.querySelector('#btn-delete-record').onclick = async () => {
    if (!confirm("確定刪除？")) return;
    const t = document.querySelector('#edit-type').value; const id = document.querySelector('#edit-id').value;
    try { await deleteDoc(doc(db, t === 'buy' ? 'purchases' : 'dinners', id)); el.modalEdit.classList.add('hidden'); loadData(); } catch (err) { alert(err.message); }
};

onAuthStateChanged(auth, u => {
    currentUser = u;
    if (u) el.userSection.innerHTML = `<img src="${u.photoURL}" class="w-10 h-10 rounded-full border shadow-sm"><button id="btn-logout" class="text-xs text-gray-400 font-bold underline">登出</button>`;
    else el.userSection.innerHTML = '';
    document.querySelector('#btn-logout')?.addEventListener('click', () => signOut(auth));
    updateUI();
});
document.querySelector('#input-date-buy').valueAsDate = new Date();
document.querySelector('#input-date-dinner').valueAsDate = new Date();
