import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCuN1XmoD7kyRYQyna_bJ0WetZK19Ig_PU",
    authDomain: "qsalon-80cea.firebaseapp.com",
    databaseURL: "https://qsalon-80cea-default-rtdb.firebaseio.com",
    projectId: "qsalon-80cea",
    storageBucket: "qsalon-80cea.firebasestorage.app",
    messagingSenderId: "1074927060991",
    appId: "1:1074927060991:web:70c7180e5c16a0c92d49ca",
    measurementId: "G-83V4LN9WDX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
