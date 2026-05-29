import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDHBbirAI6JYhUf055o8XR6tXN4WQN5xYE",
  authDomain: "ramko-training-system.firebaseapp.com",
  projectId: "ramko-training-system",
  storageBucket: "ramko-training-system.firebasestorage.app",
  messagingSenderId: "206865013817",
  appId: "1:206865013817:web:bb71dc180bc29ca62801e8",
  measurementId: "G-XD2JHZ7LPQ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
