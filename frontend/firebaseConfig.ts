// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

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
  // Use ReactNativeAsyncStorage for persistence in React Native
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch {
  // Falls back when Auth is already initialized during Fast Refresh.
  authInstance = getAuth(app);
}

export const auth = authInstance;
