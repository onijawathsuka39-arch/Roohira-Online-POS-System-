// Firebase Configuration and Initialization for Roohira POS
const firebaseConfig = {
  apiKey: "AIzaSyBJd5125JiDfhcohhuESazeX__uFEzN2bM",
  authDomain: "roohiracollectionpos.firebaseapp.com",
  projectId: "roohiracollectionpos",
  storageBucket: "roohiracollectionpos.firebasestorage.app",
  messagingSenderId: "1005033893757",
  appId: "1:1005033893757:web:4a2da4bf0679276c9ee614"
};

// Initialize Firebase SDK (Compat mode for browser & seamless integration)
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    window.firestoreDb = firebase.firestore();
    console.log("🔥 Firebase Firestore connected successfully to RoohiraCollectionPOS!");
}
