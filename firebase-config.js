// js/firebase-config.js

// Import Firebase SDKs using CDN approach
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js"; // Fixed version

// Your web app's Firebase configuration
// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDH3KD_6Qak4SLQlZcKaEvl9-wMX48WaQ4",
  authDomain: "trends-virals.firebaseapp.com",
  projectId: "trends-virals",
  storageBucket: "trends-virals.appspot.com",
  messagingSenderId: "704676896111",
  appId: "1:704676896111:web:cd1a8f526b7eb67c29dc9a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

// Export the Firebase services for use in other files
export { app, auth, db, storage, analytics };