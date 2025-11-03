// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// ⚠️ REPLACE THIS with your new Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsAiyiy-O83HiPKEr_p49GcLcoYAXuP5M",
  authDomain: "brainwave-a65dc.firebaseapp.com",
  projectId: "brainwave-a65dc",
  storageBucket: "brainwave-a65dc.firebasestorage.app",
  messagingSenderId: "110579847566",
  appId: "1:110579847566:web:0079cdf4287fc0599454df",
  measurementId: "G-E8BGS4D425"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Analytics (optional)
export const analytics = getAnalytics(app);

export default app;