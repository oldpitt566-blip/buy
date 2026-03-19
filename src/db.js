import { db } from './firebase-config';
import { collection, addDoc, query, where, orderBy, getDocs } from "firebase/firestore";

/**
 * 新增購物記錄 (直接將 Base64 存入 Firestore)
 */
export const addPurchaseRecord = async (userId, data, base64Image) => {
  try {
    const docRef = await addDoc(collection(db, "purchases"), {
      userId,
      itemName: data.itemName,
      price: Number(data.price),
      date: data.date,
      imageUrl: base64Image || "", // 這裡現在存的是 Base64 字串
      createdAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error("Add Record Error:", error);
    throw error;
  }
};

/**
 * 獲取使用者的所有購物記錄
 */
export const getUserPurchases = async (userId) => {
  try {
    const q = query(
      collection(db, "purchases"),
      where("userId", "==", userId),
      orderBy("date", "desc")
    );
    const querySnapshot = await getDocs(q);
    const records = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });
    return records;
  } catch (error) {
    console.error("Get Records Error:", error);
    throw error;
  }
};
