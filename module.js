
    // Import the functions you need from the SDKs you need
    import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
    import { getDatabase, ref, set, get, update, remove, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

    // Your web app's Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyCHFUx3Y1L3mvyLyDMHVKQE6eXi50_fewE",
      authDomain: "buyzocart.firebaseapp.com",
      databaseURL: "https://buyzocart-default-rtdb.firebaseio.com",
      projectId: "buyzocart",
      storageBucket: "buyzocart.firebasestorage.app",
      messagingSenderId: "640560737762",
      appId: "1:640560737762:web:7fe368df6486d6da759dbb"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    const auth = getAuth(app);
    
    // Make Firebase available globally
    window.firebase = { app, database, auth, ref, set, get, update, remove, onValue, query, orderByChild, equalTo, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup };
    
    // Initialize the app when Firebase is ready
    document.addEventListener('DOMContentLoaded', function() {
      initApp();
    });
  