import { db, storage } from './firebase-config';
import { collection, addDoc, query, where, orderBy, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * 上傳圖片到 Firebase Storage
 */
const uploadImage = async (file, userId) => {
  if (!file) return null;
  const storageRef = ref(storage, `receipts/${userId}/${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
};

/**
 * 新增購物記錄
 */
export const addPurchaseRecord = async (userId, data, imageFile) => {
  try {
    let imageUrl = "";
    if (imageFile) {
      imageUrl = await uploadImage(imageFile, userId);
    }

    const docRef = await addDoc(collection(db, "purchases"), {
      userId,
      itemName: data.itemName,
      price: Number(data.price),
      date: data.date,
      imageUrl,
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
