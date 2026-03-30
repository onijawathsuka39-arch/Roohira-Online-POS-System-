// Firebase configuration
// Get these from: Firebase Console > Project Settings > General > Your apps
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase only if the SDK is loaded
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    
    // Enable offline persistence
    firebase.firestore().enablePersistence().catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.warn('The current browser does not support all of the features required to enable persistence');
        }
    });
}

const fdb = (typeof firebase !== 'undefined') ? firebase.firestore() : null;
