import './style.css';
import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged, 
    setPersistence, 
    browserLocalPersistence 
} from "firebase/auth";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    getDocs 
} from "firebase/firestore";

// --- 1. Firebase 設定 ---
// TODO: 請將此處替換為您的真實 Firebase Config
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
let currentView = 'add'; // 'add' 或 'history'
let selectedBase64 = "";

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
    inputDate: document.querySelector('#input-date')
};

// --- 4. 核心功能：圖片處理 ---
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scale = Math.min(MAX_WIDTH / img.width, 1);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- 5. 核心功能：視圖切換 ---
function switchView(viewName) {
    currentView = viewName;
    
    // 隱藏所有視圖
    el.viewLogin.classList.add('hidden');
    el.viewAdd.classList.add('hidden');
    el.viewHistory.classList.add('hidden');

    if (!currentUser) {
        el.viewLogin.classList.remove('hidden');
        el.bottomNav.classList.add('hidden');
        return;
    }

    el.bottomNav.classList.remove('hidden');
    
    if (viewName === 'add') {
        el.viewAdd.classList.remove('hidden');
    } else {
        el.viewHistory.classList.remove('hidden');
        loadHistory();
    }

    // 更新導航欄顏色
    el.navTabs.forEach(tab => {
        const isActive = tab.dataset.view === viewName;
        tab.classList.toggle('text-blue-600', isActive);
        tab.classList.toggle('text-gray-400', !isActive);
    });
}

// --- 6. 核心功能：資料操作 ---
async function loadHistory() {
    if (!currentUser) return;
    el.historyContainer.innerHTML = '<p class="text-center text-gray-400 py-10">載入中...</p>';
    
    try {
        const q = query(
            collection(db, "purchases"),
            where("userId", "==", currentUser.uid),
            orderBy("date", "desc")
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
            el.historyContainer.innerHTML = '<p class="text-center text-gray-400 py-10">尚無紀錄</p>';
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const d = doc.data();
            html += `
                <div class="bg-white p-3 rounded-xl shadow-sm flex gap-3 items-center border border-gray-50">
                    <div class="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        ${d.imageUrl ? `<img src="${d.imageUrl}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-gray-300"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`}
                    </div>
                    <div class="flex-grow">
                        <h3 class="font-bold text-gray-800 text-sm">${d.itemName}</h3>
                        <p class="text-[10px] text-gray-400">${d.date}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-blue-600 font-extrabold text-sm">$${d.price}</p>
                    </div>
                </div>
            `;
        });
        el.historyContainer.innerHTML = html;
    } catch (err) {
        el.historyContainer.innerHTML = `<p class="text-center text-red-400 py-10 text-xs">載入出錯: ${err.message}</p>`;
    }
}

// --- 7. 事件監聽 ---

// 登入按鈕
el.btnLogin.onclick = async () => {
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, provider);
    } catch (err) {
        alert("登入失敗: " + err.message);
    }
};

// 底部選單切換
el.navTabs.forEach(tab => {
    tab.onclick = () => switchView(tab.dataset.view);
});

// 相機點擊
el.cameraBox.onclick = () => el.inputCamera.click();

// 圖片選擇後預覽
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

// 移除圖片
el.btnRemoveImg.onclick = (e) => {
    e.stopPropagation();
    selectedBase64 = "";
    el.inputCamera.value = "";
    el.previewImg.classList.add('hidden');
    el.cameraPlaceholder.classList.remove('hidden');
    el.btnRemoveImg.classList.add('hidden');
};

// 儲存表單
el.addForm.onsubmit = async (e) => {
    e.preventDefault();
    const btnSave = document.querySelector('#btn-save');
    const originalText = btnSave.innerText;

    try {
        btnSave.disabled = true;
        btnSave.innerText = "儲存中...";

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
    } catch (err) {
        alert("儲存失敗: " + err.message);
    } finally {
        btnSave.disabled = false;
        btnSave.innerText = originalText;
    }
};

// --- 8. 初始化啟動 ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        el.userSection.innerHTML = `
            <img src="${user.photoURL}" class="w-8 h-8 rounded-full border shadow-sm">
            <button id="btn-logout" class="text-[10px] text-gray-400 underline">登出</button>
        `;
        document.querySelector('#btn-logout').onclick = () => signOut(auth);
        switchView('add');
    } else {
        el.userSection.innerHTML = '';
        switchView('login');
    }
});

// 設定今日日期
el.inputDate.valueAsDate = new Date();
