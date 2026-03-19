import './style.css';
import { observeAuthState, loginWithGoogle, logout, handleLoginRedirect } from './auth';
import { getUserPurchases } from './db';

const userInfo = document.querySelector('#user-info');
const mainContent = document.querySelector('#main-content');
const historyList = document.querySelector('#history-list');

let currentUser = null;

// 監聽登入狀態
observeAuthState(async (user) => {
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
    loadHistory(user.uid);
  } else {
    // 未登入
    userInfo.innerHTML = `<button id="login-btn" class="bg-blue-500 text-white px-4 py-2 rounded-lg shadow">Google 登入</button>`;
    document.querySelector('#login-btn')?.addEventListener('click', loginWithGoogle);
    mainContent.classList.add('hidden');
    historyList.innerHTML = '<p class="text-gray-500 text-center py-10">請先登入以查看紀錄</p>';
  }
});

/**
 * 載入歷史紀錄並渲染
 */
async function loadHistory(userId) {
  try {
    historyList.innerHTML = '<p class="text-gray-500 text-center py-10">載入中...</p>';
    const records = await getUserPurchases(userId);

    if (records.length === 0) {
      historyList.innerHTML = '<p class="text-gray-500 text-center py-10">尚無任何購物記錄</p>';
      return;
    }

    historyList.innerHTML = records.map(record => `
      <div class="bg-white p-4 rounded-xl shadow-sm flex gap-4 items-center">
        ${record.imageUrl ? `
          <div class="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
            <img src="${record.imageUrl}" class="w-full h-full object-cover">
          </div>
        ` : `
          <div class="w-16 h-16 bg-blue-50 rounded-lg flex items-center justify-center text-blue-300 flex-shrink-0">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </div>
        `}
        <div class="flex-grow">
          <h3 class="font-bold text-gray-800">${record.itemName}</h3>
          <p class="text-sm text-gray-500">${record.date}</p>
        </div>
        <div class="text-right">
          <p class="text-blue-600 font-bold">$${record.price}</p>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error("Load History Error:", error);
    historyList.innerHTML = `
      <div class="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
        載入失敗：${error.message}<br>
        <small class="block mt-2 font-mono">如果是索引錯誤，請查看開發者工具 (F12) 中的連結</small>
      </div>
    `;
  }
}
