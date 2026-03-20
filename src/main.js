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

// --- 2. 狀態變數 ---
let currentUser = null;
let currentView = 'add';
let selectedBase64 = "";
let allRecords = []; // 存放所有抓下來的原始紀錄

// --- 3. DOM 元素 ---
const el = {
    userSection: document.querySelector('#user-section'),
    viewLogin: document.querySelector('#view-login'),
    viewAdd: document.querySelector('#view-add'),
    viewHistory: document.querySelector('#view-history'),
    historyContainer: document.querySelector('#history-container'),
    bottomNav: document.querySelector('#bottom-nav'),
    navTabs: document.querySelectorAll('.nav-tab'),
    btnLogin: document.querySelector('#btn-login'),
    addForm: document.querySelector('#add-form'),
    inputCamera: document.querySelector('#input-camera'),
    cameraBox: document.querySelector('#camera-box'),
    previewImg: document.querySelector('#preview-img'),
    cameraPlaceholder: document.querySelector('#camera-placeholder'),
    btnRemoveImg: document.querySelector('#btn-remove-img'),
    inputDate: document.querySelector('#input-date'),
    // Search & Filter
    searchKeyword: document.querySelector('#search-keyword'),
    btnToggleFilter: document.querySelector('#btn-toggle-filter'),
    filterDateRange: document.querySelector('#filter-date-range'),
    filterStart: document.querySelector('#filter-start'),
    filterEnd: document.querySelector('#filter-end'),
    btnClearFilter: document.querySelector('#btn-clear-filter'),
    // Modals
    modalImage: document.querySelector('#modal-image'),
    fullImg: document.querySelector('#full-img'),
    btnCloseImgModal: document.querySelector('#btn-close-img-modal'),
    modalEdit: document.querySelector('#modal-edit'),
    editForm: document.querySelector('#edit-form'),
    btnCloseEditModal: document.querySelector('#btn-close-edit-modal'),
    btnDeleteRecord: document.querySelector('#btn-delete-record')
};

// --- 4. 視圖切換與資料讀取 ---
function switchView(viewName) {
    currentView = viewName;
    el.viewLogin.classList.add('hidden');
    el.viewAdd.classList.add('hidden');
    el.viewHistory.classList.add('hidden');

    if (!currentUser) {
        el.viewLogin.classList.remove('hidden');
        el.bottomNav.classList.add('hidden');
        return;
    }

    el.bottomNav.classList.remove('hidden');
    if (viewName === 'add') el.viewAdd.classList.remove('hidden');
    else {
        el.viewHistory.classList.remove('hidden');
        loadHistory();
    }

    el.navTabs.forEach(tab => {
        const isActive = tab.dataset.view === viewName;
        tab.classList.toggle('text-blue-600', isActive);
        tab.classList.toggle('text-gray-400', !isActive);
    });
}

async function loadHistory() {
    if (!currentUser) return;
    el.historyContainer.innerHTML = '<p class="text-center text-gray-400 py-10">載入中...</p>';
    try {
        const q = query(
            collection(db, "purchases"),
            where("userId", "==", currentUser.uid),
            orderBy("date", "desc"),
            orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        allRecords = [];
        snap.forEach(docSnap => {
            allRecords.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderHistory();
    } catch (err) {
        el.historyContainer.innerHTML = `<p class="text-center text-red-400 py-10 text-xs">載入失敗: ${err.message}</p>`;
    }
}

/**
 * 根據搜尋與過濾條件渲染清單
 */
function renderHistory() {
    const keyword = el.searchKeyword.value.trim().toLowerCase();
    const start = el.filterStart.value;
    const end = el.filterEnd.value;

    const filtered = allRecords.filter(r => {
        // 文字搜尋
        const matchKeyword = r.itemName.toLowerCase().includes(keyword);
        // 日期過濾
        const matchStart = start ? r.date >= start : true;
        const matchEnd = end ? r.date <= end : true;
        return matchKeyword && matchStart && matchEnd;
    });

    if (filtered.length === 0) {
        el.historyContainer.innerHTML = '<p class="text-center text-gray-400 py-10">找不到相符的紀錄</p>';
        return;
    }

    el.historyContainer.innerHTML = '';
    filtered.forEach(d => {
        const itemEl = document.createElement('div');
        itemEl.className = "bg-white p-3 rounded-2xl shadow-sm flex gap-3 items-center border border-gray-50";
        itemEl.innerHTML = `
            <div class="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 cursor-zoom-in">
                ${d.imageUrl ? `<img src="${d.imageUrl}" class="w-full h-full object-cover img-trigger">` : `<div class="w-full h-full flex items-center justify-center text-gray-300"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`}
            </div>
            <div class="flex-grow">
                <h3 class="font-bold text-gray-800 text-sm">${d.itemName}</h3>
                <p class="text-[10px] text-gray-400 font-medium">${d.date}</p>
            </div>
            <div class="text-right flex flex-col items-end gap-1">
                <p class="text-blue-600 font-black text-base">$${d.price}</p>
                <button class="btn-edit text-[10px] bg-gray-50 text-gray-400 px-2 py-1 rounded-md" data-id="${d.id}" data-name="${d.itemName}" data-price="${d.price}">修改</button>
            </div>
        `;
        
        itemEl.querySelector('.img-trigger')?.addEventListener('click', () => {
            el.fullImg.src = d.imageUrl;
            el.modalImage.classList.remove('hidden');
        });

        itemEl.querySelector('.btn-edit').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            document.querySelector('#edit-id').value = btn.dataset.id;
            document.querySelector('#edit-name').value = btn.dataset.name;
            document.querySelector('#edit-price').value = btn.dataset.price;
            el.modalEdit.classList.remove('hidden');
        });

        el.historyContainer.appendChild(itemEl);
    });
}

// --- 5. 事件監聽 (過濾相關) ---

// 關鍵字輸入時立即過濾
el.searchKeyword.oninput = () => renderHistory();
el.filterStart.onchange = () => renderHistory();
el.filterEnd.onchange = () => renderHistory();

// 切換日期過濾器顯示
el.btnToggleFilter.onclick = () => el.filterDateRange.classList.toggle('hidden');

// 清除過濾
el.btnClearFilter.onclick = () => {
    el.searchKeyword.value = "";
    el.filterStart.value = "";
    el.filterEnd.value = "";
    renderHistory();
};

// --- 6. 其他基礎邏輯 (略) ---

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = Math.min(800 / img.width, 1);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

el.btnLogin.onclick = () => signInWithPopup(auth, provider);
el.navTabs.forEach(tab => tab.onclick = () => switchView(tab.dataset.view));
el.cameraBox.onclick = () => el.inputCamera.click();
el.inputCamera.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedBase64 = await compressImage(file);
        el.previewImg.src = selectedBase64;
        el.previewImg.classList.remove('hidden');
        el.cameraPlaceholder.classList.add('hidden');
        el.btnRemoveImg.classList.remove('hidden');
    }
};
el.btnRemoveImg.onclick = (e) => {
    e.stopPropagation();
    selectedBase64 = ""; el.inputCamera.value = "";
    el.previewImg.classList.add('hidden');
    el.cameraPlaceholder.classList.remove('hidden');
    el.btnRemoveImg.classList.add('hidden');
};

el.addForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.querySelector('#btn-save');
    try {
        btn.disabled = true;
        btn.innerText = "儲存中...";
        await addDoc(collection(db, "purchases"), {
            userId: currentUser.uid,
            itemName: document.querySelector('#input-name').value,
            price: Number(document.querySelector('#input-price').value),
            date: document.querySelector('#input-date').value,
            imageUrl: selectedBase64,
            createdAt: new Date()
        });
        alert("儲存成功！");
        el.addForm.reset();
        el.inputDate.valueAsDate = new Date();
        el.btnRemoveImg.click();
    } catch (err) { alert("儲存失敗: " + err.message); }
    finally { btn.disabled = false; btn.innerText = "儲存紀錄"; }
};

el.btnCloseImgModal.onclick = () => el.modalImage.classList.add('hidden');
el.btnCloseEditModal.onclick = () => el.modalEdit.classList.add('hidden');
el.editForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.querySelector('#edit-id').value;
    try {
        await updateDoc(doc(db, "purchases", id), {
            itemName: document.querySelector('#edit-name').value,
            price: Number(document.querySelector('#edit-price').value)
        });
        el.modalEdit.classList.add('hidden');
        loadHistory();
    } catch (err) { alert("更新失敗: " + err.message); }
};
el.btnDeleteRecord.onclick = async () => {
    if (!confirm("確定要刪除這條紀錄嗎？")) return;
    const id = document.querySelector('#edit-id').value;
    try {
        await deleteDoc(doc(db, "purchases", id));
        el.modalEdit.classList.add('hidden');
        loadHistory();
    } catch (err) { alert("刪除失敗: " + err.message); }
};

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        el.userSection.innerHTML = `<img src="${user.photoURL}" class="w-8 h-8 rounded-full border shadow-sm"><button id="btn-logout" class="text-[10px] text-gray-400 underline">登出</button>`;
        document.querySelector('#btn-logout').onclick = () => signOut(auth);
        switchView('add');
    } else {
        el.userSection.innerHTML = '';
        switchView('login');
    }
});
el.inputDate.valueAsDate = new Date();
