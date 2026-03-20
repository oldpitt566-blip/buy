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

let currentUser = null;
let selectedFile = null;

if (dateInput) dateInput.valueAsDate = new Date();

/**
 * 壓縮圖片並轉換為 Base64
 */
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

/**
 * 更新 UI 狀態
 */
function updateUI(user) {
  if (user) {
    currentUser = user;
    userInfo.innerHTML = `
      <div class="flex items-center gap-2">
        <img src="${user.photoURL}" class="w-8 h-8 rounded-full border">
        <button id="logout-btn" class="text-xs text-gray-500 underline">登出</button>
      </div>
    `;
    document.querySelector('#logout-btn')?.addEventListener('click', logout);
    mainContent.classList.remove('hidden');
  } else {
    currentUser = null;
    userInfo.innerHTML = `<button id="login-btn" class="bg-blue-500 text-white px-4 py-2 rounded-lg shadow">Google 登入</button>`;
    document.querySelector('#login-btn')?.addEventListener('click', () => {
        loginWithGoogle().catch(err => alert("登入失敗：" + err.message));
    });
    mainContent.classList.add('hidden');
  }
}

// 核心初始化邏輯
async function initApp() {
    userInfo.innerHTML = '<span class="text-xs text-gray-400">驗證中...</span>';
    
    // 1. 先檢查是不是剛從跳轉回來 (處理登入結果)
    try {
        await handleLoginRedirect();
    } catch (e) {
        console.error("Redirect handler error", e);
        alert("跳轉登入失敗：" + e.message);
    }

    // 2. 監聽長期登入狀態
    observeAuthState((user) => {
        updateUI(user);
    });
}

initApp();

// --- 圖片與表單邏輯 (不變) ---
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
    let base64Image = "";
    if (selectedFile) base64Image = await compressImage(selectedFile);
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
