// Admin email listesi
const ADMIN_EMAILS = ['burakgolmusic@gmail.com'];

// DOM elementleri
const loginBtn = document.getElementById('loginBtn');
const adminLoginBtn = document.getElementById('adminLoginBtn');

// Normal kullanıcı girişi
loginBtn.addEventListener('click', async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        
        // Firestore'a kullanıcı bilgilerini kaydet
        const db = firebase.firestore();
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            await userRef.set({
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                balance: 100000,
                portfolio: {},
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await userRef.update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                displayName: user.displayName,
                photoURL: user.photoURL
            });
        }

        window.location.href = 'main.html';
    } catch (error) {
        console.error('Giriş hatası:', error);
        Swal.fire({
            icon: 'error',
            title: 'Giriş Başarısız',
            text: 'Giriş yapılırken bir hata oluştu.'
        });
    }
});

// Admin girişi
adminLoginBtn.addEventListener('click', async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        
        if (ADMIN_EMAILS.includes(user.email)) {
            window.location.href = 'admin.html';
        } else {
            await firebase.auth().signOut();
            Swal.fire({
                icon: 'error',
                title: 'Yetkisiz Erişim',
                text: 'Bu email adresi admin yetkisine sahip değil.'
            });
        }
    } catch (error) {
        console.error('Admin giriş hatası:', error);
        Swal.fire({
            icon: 'error',
            title: 'Giriş Başarısız',
            text: 'Admin girişi yapılırken bir hata oluştu.'
        });
    }
});

// Oturum kontrolü
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        if (ADMIN_EMAILS.includes(user.email)) {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'main.html';
        }
    }
}); 