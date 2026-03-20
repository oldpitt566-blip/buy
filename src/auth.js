import { auth, provider } from './firebase-config';
import { signInWithRedirect, signOut, onAuthStateChanged, getRedirectResult } from "firebase/auth";

/**
 * 執行 Google 登入 (改用 Redirect 增加手機穩定度)
 */
export const loginWithGoogle = async () => {
  try {
    await signInWithRedirect(auth, provider);
  } catch (error) {
    console.error("Login Error:", error);
    alert("登入啟動失敗：" + error.message);
    throw error;
  }
};

/**
 * 處理跳轉回來的結果
 */
export const handleLoginRedirect = async () => {
  const result = await getRedirectResult(auth);
  if (result) {
    return result.user;
  }
  return null;
};

/**
 * 執行登出
 */
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
    throw error;
  }
};

/**
 * 監聽登入狀態變化
 */
export const observeAuthState = (callback) => {
  onAuthStateChanged(auth, callback);
};
