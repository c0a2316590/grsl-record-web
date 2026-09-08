import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";


const firebaseConfig = {

  apiKey: "AIzaSyC6gfA_qLjX26C_t5cfV7kz1KsoxPWvmxM",

  authDomain: "grsl-record.firebaseapp.com",

  projectId: "grsl-record",

  storageBucket: "grsl-record.firebasestorage.app",

  messagingSenderId: "80117436841",

  appId: "1:80117436841:web:5e91e599e5e0f183eb74b8",

  measurementId: "G-8JXDL3JQQE",

};


const app =
  initializeApp(firebaseConfig);


export const db =
  getFirestore(app);


export const auth =
  getAuth(app);