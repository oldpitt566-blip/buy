import { auth, provider } from './firebase-config';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

/**
 * 執行 Google 登入
 */
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
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
