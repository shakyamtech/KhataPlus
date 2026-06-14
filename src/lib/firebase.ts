import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyADe52Ppu9O5rQ9HXFec96JEbx94elBxOU",
  authDomain: "khataplus-f13b1.firebaseapp.com",
  projectId: "khataplus-f13b1",
  storageBucket: "khataplus-f13b1.firebasestorage.app",
  messagingSenderId: "1012861495605",
  appId: "1:1012861495605:web:52aa4026034935458e847c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn("Multiple tabs open, offline persistence can only be enabled in one tab at a time.");
  } else if (err.code == 'unimplemented') {
    console.warn("The current browser does not support all of the features required to enable offline persistence.");
  }
});
