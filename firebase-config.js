// Configuration Firebase Cloud pour EduPocket
const firebaseConfig = {
  projectId: "mailpocket-pro",
  appId: "1:591085378822:web:e3e976d491fbe360725287",
  storageBucket: "mailpocket-pro.firebasestorage.app",
  apiKey: "AIzaSyAkS-bahvF3m0KPXgvhZ2bleHv8h3lCEp8",
  authDomain: "mailpocket-pro.firebaseapp.com",
  messagingSenderId: "591085378822",
  projectNumber: "591085378822"
};

let db = null;
let isFirebaseOnline = false;

if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      if (err.code === 'failed-precondition') {
        console.warn('Persistance Firestore : plusieurs onglets ouverts.');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistance Firestore non supportée par le navigateur.');
      }
    });
    isFirebaseOnline = true;
    console.log("Firebase Firestore connecté avec succès !");
  } catch (e) {
    console.warn("Initialisation Firebase en mode secours/hors-ligne :", e);
  }
}
