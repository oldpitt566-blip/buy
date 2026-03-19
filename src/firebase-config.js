import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: 將下方的 Firebase 設定替換為您專案中的實際內容
const firebaseConfig = {
  apiKey: "AIzaSyAZQUdpEvJ26zn5rfIdQgcwCcQosg4PQok",
  authDomain: "buyalot-2e838.firebaseapp.com",
  projectId: "buyalot-2e838",
  storageBucket: "buyalot-2e838.firebasestorage.app",
  messagingSenderId: "113950833516",
  appId: "1:113950833516:web:e63d356afc2f8f152f9149",
  measurementId: "G-9PML3EZVPC"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, provider, db };
