import * as Firestore from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC7UP4SRbE8P4nIloyMpWR2cVjmg63IOOo",
  authDomain: "learnthatopen.firebaseapp.com",
  projectId: "learnthatopen",
  storageBucket: "learnthatopen.firebasestorage.app",
  messagingSenderId: "900451903426",
  appId: "1:900451903426:web:abbb2f323084cc78eb985b",
  measurementId: "G-9WRW42TERS",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const firestoreDB = Firestore.initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const storage = getStorage(app);
export const auth = getAuth(app);

// if (window.location.hostname === "localhost") {
//   connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
// }


export function getCollection<T>(path: string) {
  return Firestore.collection(
    firestoreDB,
    path,
  ) as Firestore.CollectionReference<T>;
}

export async function deleteDocument(path: string, id: string) {
  const doc = Firestore.doc(firestoreDB, `${path}/${id}`);
  await Firestore.deleteDoc(doc);
}

export async function updateDocument<T extends Record<string, any>>(
  path: string,
  id: string,
  data: T,
) {
  const doc = Firestore.doc(firestoreDB, `${path}/${id}`);
  await Firestore.updateDoc(doc, data);
}

const localConfig = { ...firebaseConfig, projectId: "learnthatopen" };
const app2 = initializeApp(localConfig, "local-function");
const functions = getFunctions(app2);

// if (window.location.hostname === "localhost") {
//   connectFunctionsEmulator(functions, "localhost", 5001);
// }

export { functions };
