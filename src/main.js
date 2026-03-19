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

// 設定預設日期為今天
if (dateInput) {
  dateInput.valueAsDate = new Date();
}

/**
 * 壓縮圖片並轉換為 Base64 (JPG 0.7 質量)
 */
async function compressImage(file, maxWidth = 800) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
}

// 監聽登入狀態並處理 Redirect 結果
observeAuthState(async (user) => {
  // 先處理可能剛跳轉回來的登入結果
  if (!user) {
    user = await handleLoginRedirect();
  }

  currentUser = user;
  if (user) {
    // 已登入
    userInfo.innerHTML = `
      <div class="flex items-center gap-2">
        <img src="${user.photoURL}" class="w-8 h-8 rounded-full border">
        <button id="logout-btn" class="text-sm text-gray-500 underline">登出</button>
      </div>
    `;
    document.querySelector('#logout-btn')?.addEventListener('click', logout);
    mainContent.classList.remove('hidden');
  } else {
    // 未登入
    userInfo.innerHTML = `<button id="login-btn" class="bg-blue-500 text-white px-4 py-2 rounded-lg shadow">Google 登入</button>`;
    document.querySelector('#login-btn')?.addEventListener('click', async () => {
        try {
            await loginWithGoogle();
        } catch (e) {
            alert("點擊登入發生錯誤：" + e.message);
        }
    });
    mainContent.classList.add('hidden');
  }
});

// 圖片預覽處理 (與之前相同)
cameraInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      imagePreviewContainer.classList.remove('hidden');
      cameraLabel.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }
});

// 移除圖片 (與之前相同)
removeImageBtn?.addEventListener('click', () => {
  selectedFile = null;
  cameraInput.value = '';
  imagePreviewContainer.classList.add('hidden');
  cameraLabel.classList.remove('hidden');
});

// 表單提交 (與之前相同)
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
    if (selectedFile) {
        base64Image = await compressImage(selectedFile);
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
