// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCoArOmgALx8pQqVjP2JRK3LvLTfIRuYA",
  authDomain: "brainwave-8e103.firebaseapp.com",
  projectId: "brainwave-8e103",
  storageBucket: "brainwave-8e103.firebasestorage.app",
  messagingSenderId: "353877922717",
  appId: "1:353877922717:web:3592e0efff42a44f965574",
  measurementId: "G-Y24FF4K8FE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider for better UX
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Analytics (optional)
export const analytics = getAnalytics(app);

export default app;