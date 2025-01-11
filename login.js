// DOM elementleri
const loginBtn = document.getElementById('loginBtn');

// Google ile giriş işlemi
loginBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        
        // Başarılı giriş
        Swal.fire({
            icon: 'success',
            title: 'Giriş Başarılı!',
            text: 'Dashboard\'a yönlendiriliyorsunuz...',
            timer: 2000,
            showConfirmButton: false,
            timerProgressBar: true
        }).then(() => {
            window.location.href = 'main.html';
        });
    } catch (error) {
        console.error('Giriş hatası:', error);
        Swal.fire({
            icon: 'error',
            title: 'Giriş Başarısız',
            text: 'Bir hata oluştu. Lütfen tekrar deneyin.',
        });
    }
});

// Kullanıcı oturum durumunu kontrol et
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        window.location.href = 'main.html';
    }
}); 