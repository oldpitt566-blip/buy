import './style.css';
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";

// --- 1. Firebase 設定 (請填入您的資訊) ---
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
let activeApp = 'buy'; // 'buy' 或 'dinner'
let activeTab = 'add'; // 'add' 或 'history'
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
    // Containers
    containerBuy: document.querySelector('#container-buy'),
    containerDinner: document.querySelector('#container-dinner'),
    // Forms
    addFormBuy: document.querySelector('#add-form-buy'),
    addFormDinner: document.querySelector('#add-form-dinner'),
    // Modals
    modalImage: document.querySelector('#modal-image'),
    fullImg: document.querySelector('#full-img'),
    modalEdit: document.querySelector('#modal-edit')
};

// --- 4. 視圖切換核心邏輯 ---
function updateUI() {
    // 隱藏所有大區塊
    el.viewLogin.classList.add('hidden');
    el.containerBuy.classList.add('hidden');
    el.containerDinner.classList.add('hidden');
    el.appSwitcher.classList.add('hidden');
    el.bottomNav.classList.add('hidden');

    if (!currentUser) {
        el.viewLogin.classList.remove('hidden');
        return;
    }

    // 登入後顯示
    el.appSwitcher.classList.remove('hidden');
    el.bottomNav.classList.remove('hidden');

    // 根據 activeApp 切換
    if (activeApp === 'buy') {
        el.containerBuy.classList.remove('hidden');
        el.appTitle.innerText = "BuyLog 💰";
        el.appTitle.className = "text-2xl font-black text-blue-600 tracking-tight";
        // 切換 Buy 的子視圖
        document.querySelector('#view-buy-add').classList.toggle('hidden', activeTab !== 'add');
        document.querySelector('#view-buy-history').classList.toggle('hidden', activeTab !== 'history');
    } else {
        el.containerDinner.classList.remove('hidden');
        el.appTitle.innerText = "MyDinner 🥘";
        el.appTitle.className = "text-2xl font-black text-amber-600 tracking-tight";
        // 切換 Dinner 的子視圖
        document.querySelector('#view-dinner-add').classList.toggle('hidden', activeTab !== 'add');
        document.querySelector('#view-dinner-history').classList.toggle('hidden', activeTab !== 'history');
    }

    // 更新 Tab 樣式
    el.appTabs.forEach(btn => {
        const isActive = btn.dataset.app === activeApp;
        btn.classList.toggle('bg-white', isActive);
        btn.classList.toggle('shadow-sm', isActive);
        btn.classList.toggle('text-blue-600', isActive && activeApp === 'buy');
        btn.classList.toggle('text-amber-600', isActive && activeApp === 'dinner');
        btn.classList.toggle('text-gray-400', !isActive);
    });

    el.navTabs.forEach(btn => {
        const isActive = btn.dataset.view === activeTab;
        const colorClass = activeApp === 'buy' ? 'text-blue-600' : 'text-amber-600';
        btn.classList.toggle(colorClass, isActive);
        btn.classList.toggle('text-gray-300', !isActive);
    });

    if (activeTab === 'history') loadData();
}

// --- 5. 圖片壓縮 ---
async function compressImage(file) {
    return new Promise(r => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = Math.min(800 / img.width, 1);
                canvas.width = img.width * scale; canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                r(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- 6. 資料操作 ---
async function loadData() {
    const collectionName = activeApp === 'buy' ? 'purchases' : 'dinners';
    const containerId = activeApp === 'buy' ? '#history-container-buy' : '#history-container-dinner';
    const container = document.querySelector(containerId);
    container.innerHTML = '<p class="text-center text-gray-400 py-20">讀取中...</p>';

    try {
        const q = query(collection(db, collectionName), where("userId", "==", currentUser.uid), orderBy("date", "desc"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        records[activeApp] = [];
        snap.forEach(d => records[activeApp].push({ id: d.id, ...d.data() }));
        renderHistory(container);
    } catch (err) { container.innerHTML = `<p class="text-center text-red-400 py-20">錯誤: ${err.message}</p>`; }
}

function renderHistory(container) {
    const keywordId = activeApp === 'buy' ? '#search-keyword-buy' : '#search-keyword-dinner';
    const keyword = document.querySelector(keywordId).value.trim().toLowerCase();
    const filtered = records[activeApp].filter(r => r.itemName.toLowerCase().includes(keyword) || (r.remarks && r.remarks.toLowerCase().includes(keyword)));

    if (filtered.length === 0) { container.innerHTML = '<p class="text-center text-gray-400 py-20">沒有資料</p>'; return; }

    container.innerHTML = filtered.map(d => `
        <div class="bg-white p-4 rounded-[2rem] shadow-sm flex gap-4 items-center border border-gray-50">
            <div class="w-20 h-20 bg-gray-100 rounded-2xl overflow-hidden flex-shrink-0 cursor-zoom-in">
                ${d.imageUrl ? `<img src="${d.imageUrl}" class="w-full h-full object-cover img-trigger" data-url="${d.imageUrl}">` : `<div class="w-full h-full flex items-center justify-center text-gray-300"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`}
            </div>
            <div class="flex-grow">
                <h3 class="font-bold text-gray-800 text-lg leading-tight">${d.itemName}</h3>
                <p class="text-xs text-gray-400 font-bold">${d.date} ${d.remarks ? `| ${d.remarks}` : ''}</p>
            </div>
            <div class="text-right flex flex-col items-end gap-2">
                ${d.price ? `<p class="${activeApp === 'buy' ? 'text-blue-600' : 'text-amber-600'} font-black text-xl tracking-tighter">$${d.price}</p>` : ''}
                <button class="btn-edit-trigger text-xs font-bold bg-gray-50 text-gray-400 px-3 py-1.5 rounded-lg" data-id="${d.id}" data-name="${d.itemName}" data-price="${d.price || ''}" data-remarks="${d.remarks || ''}">修改</button>
            </div>
        </div>
    `).join('');

    // 綁定圖片放大
    container.querySelectorAll('.img-trigger').forEach(img => img.onclick = () => { el.fullImg.src = img.dataset.url; el.modalImage.classList.remove('hidden'); });
    // 綁定編輯
    container.querySelectorAll('.btn-edit-trigger').forEach(btn => btn.onclick = () => {
        document.querySelector('#edit-id').value = btn.dataset.id;
        document.querySelector('#edit-type').value = activeApp;
        document.querySelector('#edit-name').value = btn.dataset.name;
        document.querySelector('#edit-price').value = btn.dataset.price;
        document.querySelector('#edit-remarks').value = btn.dataset.remarks;
        document.querySelector('#edit-field-price').classList.toggle('hidden', activeApp !== 'buy');
        document.querySelector('#edit-field-remarks').classList.toggle('hidden', activeApp !== 'dinner');
        el.modalEdit.classList.remove('hidden');
    });
}

// --- 7. 事件監聽設定 ---
document.querySelector('#btn-login').onclick = () => signInWithPopup(auth, provider);
el.appTabs.forEach(btn => btn.onclick = () => { activeApp = btn.dataset.app; activeTab = 'add'; updateUI(); });
el.navTabs.forEach(btn => btn.onclick = () => { activeTab = btn.dataset.view; updateUI(); });

// 拍照處理 (Buy)
document.querySelector('#camera-box-buy').onclick = () => document.querySelector('#input-camera-buy').click();
document.querySelector('#input-camera-buy').onchange = async e => {
    const f = e.target.files[0]; if (f) { selectedBase64 = await compressImage(f); document.querySelector('#preview-img-buy').src = selectedBase64; document.querySelector('#preview-img-buy').classList.remove('hidden'); document.querySelector('#camera-placeholder-buy').classList.add('hidden'); document.querySelector('#btn-remove-img-buy').classList.remove('hidden'); }
};
document.querySelector('#btn-remove-img-buy').onclick = e => { e.stopPropagation(); selectedBase64 = ""; document.querySelector('#input-camera-buy').value = ""; document.querySelector('#preview-img-buy').classList.add('hidden'); document.querySelector('#camera-placeholder-buy').classList.remove('hidden'); document.querySelector('#btn-remove-img-buy').classList.add('hidden'); };

// 拍照處理 (Dinner)
document.querySelector('#camera-box-dinner').onclick = () => document.querySelector('#input-camera-dinner').click();
document.querySelector('#input-camera-dinner').onchange = async e => {
    const f = e.target.files[0]; if (f) { selectedBase64 = await compressImage(f); document.querySelector('#preview-img-dinner').src = selectedBase64; document.querySelector('#preview-img-dinner').classList.remove('hidden'); document.querySelector('#camera-placeholder-dinner').classList.add('hidden'); document.querySelector('#btn-remove-img-dinner').classList.remove('hidden'); }
};
document.querySelector('#btn-remove-img-dinner').onclick = e => { e.stopPropagation(); selectedBase64 = ""; document.querySelector('#input-camera-dinner').value = ""; document.querySelector('#preview-img-dinner').classList.add('hidden'); document.querySelector('#camera-placeholder-dinner').classList.remove('hidden'); document.querySelector('#btn-remove-img-dinner').classList.add('hidden'); };

// 搜尋
document.querySelector('#search-keyword-buy').oninput = () => renderHistory(document.querySelector('#history-container-buy'));
document.querySelector('#search-keyword-dinner').oninput = () => renderHistory(document.querySelector('#history-container-dinner'));

// 儲存 Buy
el.addFormBuy.onsubmit = async e => {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]');
    try {
        btn.disabled = true; btn.innerText = "儲存中...";
        await addDoc(collection(db, "purchases"), { userId: currentUser.uid, itemName: document.querySelector('#input-name-buy').value, price: Number(document.querySelector('#input-price-buy').value), date: document.querySelector('#input-date-buy').value, imageUrl: selectedBase64, createdAt: new Date() });
        alert("儲存成功！"); el.addFormBuy.reset(); document.querySelector('#input-date-buy').valueAsDate = new Date(); document.querySelector('#btn-remove-img-buy').click();
    } catch (err) { alert(err.message); } finally { btn.disabled = false; btn.innerText = "儲存紀錄"; }
};

// 儲存 Dinner
el.addFormDinner.onsubmit = async e => {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]');
    try {
        btn.disabled = true; btn.innerText = "紀錄中...";
        await addDoc(collection(db, "dinners"), { userId: currentUser.uid, itemName: document.querySelector('#input-name-dinner').value, date: document.querySelector('#input-date-dinner').value, remarks: document.querySelector('#input-remarks-dinner').value, imageUrl: selectedBase64, createdAt: new Date() });
        alert("晚餐紀錄成功！"); el.addFormDinner.reset(); document.querySelector('#input-date-dinner').valueAsDate = new Date(); document.querySelector('#btn-remove-img-dinner').click();
    } catch (err) { alert(err.message); } finally { btn.disabled = false; btn.innerText = "儲存紀錄"; }
};

// 修改/刪除
document.querySelector('#btn-close-img-modal').onclick = () => el.modalImage.classList.add('hidden');
document.querySelector('#btn-close-edit-modal').onclick = () => el.modalEdit.classList.add('hidden');
document.querySelector('#edit-form').onsubmit = async e => {
    e.preventDefault(); const type = document.querySelector('#edit-type').value; const id = document.querySelector('#edit-id').value;
    const col = type === 'buy' ? 'purchases' : 'dinners';
    const data = type === 'buy' ? { itemName: document.querySelector('#edit-name').value, price: Number(document.querySelector('#edit-price').value) } : { itemName: document.querySelector('#edit-name').value, remarks: document.querySelector('#edit-remarks').value };
    try { await updateDoc(doc(db, col, id), data); el.modalEdit.classList.add('hidden'); loadData(); } catch (err) { alert(err.message); }
};
document.querySelector('#btn-delete-record').onclick = async () => {
    if (!confirm("確定刪除？")) return;
    const type = document.querySelector('#edit-type').value; const id = document.querySelector('#edit-id').value;
    try { await deleteDoc(doc(db, type === 'buy' ? 'purchases' : 'dinners', id)); el.modalEdit.classList.add('hidden'); loadData(); } catch (err) { alert(err.message); }
};

// 初始化
onAuthStateChanged(auth, u => {
    currentUser = u;
    if (u) {
        el.userSection.innerHTML = `<img src="${u.photoURL}" class="w-10 h-10 rounded-full border shadow-sm"><button id="btn-logout" class="text-xs text-gray-400 font-bold underline">登出</button>`;
        document.querySelector('#btn-logout').onclick = () => signOut(auth);
    } else { el.userSection.innerHTML = ''; }
    updateUI();
});
document.querySelector('#input-date-buy').valueAsDate = new Date();
document.querySelector('#input-date-dinner').valueAsDate = new Date();
