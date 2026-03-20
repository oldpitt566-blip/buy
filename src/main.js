import './style.css';
import { observeAuthState, loginWithGoogle, logout, handleLoginRedirect } from './auth';
import { addPurchaseRecord } from './db';

const userInfo = document.querySelector('#user-info');
const mainContent = document.querySelector('#main-content');
const purchaseForm = document.querySelector('#purchase-form');
const cameraInput = document.querySelector('#camera-input');
const imagePreview = document.querySelector('#image-preview');
const imagePreviewContainer = document.querySelector('#image-preview-container');
const cameraLabel = document.querySelector('#camera-label');
const removeImageBtn = document.querySelector('#remove-image');
const dateInput = document.querySelector('#date');

// 建立一個除錯顯示區域（僅供開發排錯用）
const debugEl = document.createElement('div');
debugEl.className = 'fixed top-0 left-0 right-0 bg-black text-white text-[10px] p-1 z-[9999] opacity-70 pointer-events-none';
debugEl.id = 'debug-log';
document.body.appendChild(debugEl);

function log(msg) {
    console.log(msg);
    debugEl.innerText = `Log: ${msg} | ${debugEl.innerText}`.substring(0, 200);
}

let currentUser = null;
let selectedFile = null;

if (dateInput) dateInput.valueAsDate = new Date();

/**
 * 更新 UI 狀態
 */
function updateUI(user) {
  if (user) {
    log("UI: 使用者已登入 - " + user.email);
    currentUser = user;
    userInfo.innerHTML = `
      <div class="flex items-center gap-2">
        <img src="${user.photoURL}" class="w-8 h-8 rounded-full border">
        <button id="logout-btn" class="text-xs text-gray-500 underline">登出</button>
      </div>
    `;
    document.querySelector('#logout-btn')?.addEventListener('click', () => {
        log("執行登出...");
        logout();
    });
    mainContent.classList.remove('hidden');
  } else {
    log("UI: 未登入狀態");
    currentUser = null;
    userInfo.innerHTML = `<button id="login-btn" class="bg-blue-500 text-white px-4 py-2 rounded-lg shadow">Google 登入</button>`;
    document.querySelector('#login-btn')?.addEventListener('click', () => {
        log("點擊登入按鈕...");
        loginWithGoogle().catch(err => {
            log("登入啟動失敗: " + err.code);
            alert("登入失敗：" + err.message);
        });
    });
    mainContent.classList.add('hidden');
  }
}

// 核心初始化
async function initApp() {
    log("App 開始初始化...");
    userInfo.innerHTML = '<span class="text-xs text-gray-400">驗證中...</span>';
    
    // 1. 處理跳轉結果
    try {
        log("檢查 Redirect 結果...");
        const result = await handleLoginRedirect();
        if (result) {
            log("Redirect 成功取得使用者: " + result.email);
        } else {
            log("無 Redirect 資訊");
        }
    } catch (e) {
        log("Redirect 錯誤: " + e.code);
        alert("跳轉登入失敗：" + e.message);
    }

    // 2. 監聽狀態
    observeAuthState((user) => {
        log("Auth 狀態變更: " + (user ? "有人" : "無人"));
        updateUI(user);
    });
}

// 啟動
initApp();

// --- 圖片與表單邏輯 (略，保持原本功能) ---
cameraInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      imagePreview.src = ev.target.result;
      imagePreviewContainer.classList.remove('hidden');
      cameraLabel.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }
});
removeImageBtn?.addEventListener('click', () => {
  selectedFile = null;
  cameraInput.value = '';
  imagePreviewContainer.classList.add('hidden');
  cameraLabel.classList.remove('hidden');
});
purchaseForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return alert('請先登入');
  const submitBtn = document.querySelector('#submit-btn');
  const originalBtnText = submitBtn.innerText;
  try {
    submitBtn.disabled = true;
    submitBtn.innerText = '儲存中...';
    const data = {
      itemName: document.querySelector('#item-name').value,
      price: document.querySelector('#price').value,
      date: document.querySelector('#date').value,
    };
    const canvas = document.createElement('canvas');
    let base64Image = "";
    if (selectedFile) {
        const img = new Image();
        img.src = URL.createObjectURL(selectedFile);
        await new Promise(r => img.onload = r);
        const scale = Math.min(800 / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        base64Image = canvas.toDataURL('image/jpeg', 0.7);
    }
    await addPurchaseRecord(currentUser.uid, data, base64Image);
    alert('記錄成功！');
    purchaseForm.reset();
    dateInput.valueAsDate = new Date();
    removeImageBtn.click();
  } catch (error) {
    alert('儲存失敗：' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = originalBtnText;
  }
});
