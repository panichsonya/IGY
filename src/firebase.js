import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBW4VKoEVyQBLibWhUa52oe-0_ibjfmrZA",
  authDomain: "igy-app.firebaseapp.com",
  projectId: "igy-app",
  storageBucket: "igy-app.firebasestorage.app",
  messagingSenderId: "910915021445",
  appId: "1:910915021445:web:d193b2338510768b5c97ec"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
