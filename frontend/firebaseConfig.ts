// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";

// Your friends' exact Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCdliv4S59iCknXSYsEy2L6F672RHixrBY",
  authDomain: "mindsync-a34e3.firebaseapp.com",
  projectId: "mindsync-a34e3",
  storageBucket: "mindsync-a34e3.firebasestorage.app",
  messagingSenderId: "503344530777",
  appId: "1:503344530777:web:a6d468aca0d498c6c0f848"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let authInstance;
try {
  authInstance = initializeAuth(app);
} catch {
  // Falls back when Auth is already initialized during Fast Refresh.
  authInstance = getAuth(app);
}

export const auth = authInstance;
