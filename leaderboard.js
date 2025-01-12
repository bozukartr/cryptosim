// DOM elementleri
const userProfile = document.getElementById('userProfile');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
const leaderboard = document.getElementById('leaderboard');

// Para formatı için yardımcı fonksiyon
function formatCurrency(number) {
    return number.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// İsim formatı için yardımcı fonksiyon
function formatName(fullName) {
    const names = fullName.split(' ');
    if (names.length > 1) {
        const firstName = names.slice(0, -1).join(' ');
        const lastName = names[names.length - 1];
        return `${firstName} ${lastName.charAt(0)}.`;
    }
    return fullName;
}

// Toplam varlık hesaplama
async function calculateTotalAssets(userData) {
    let total = userData.balance || 0;
    const portfolio = userData.portfolio || {};
    
    try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/price');
        const prices = await response.json();
        const priceMap = {};
        
        prices.forEach(item => {
            if (item.symbol.endsWith('USDT')) {
                const coin = item.symbol.replace('USDT', '');
                priceMap[coin] = parseFloat(item.price);
            }
        });
        
        for (const [coin, data] of Object.entries(portfolio)) {
            if (priceMap[coin] && data.amount > 0) {
                total += data.amount * priceMap[coin];
            }
        }
    } catch (error) {
        console.error('Fiyat verisi alınamadı:', error);
    }
    
    return total;
}

// Liderlik tablosunu güncelle
async function updateLeaderboard() {
    try {
        const db = firebase.firestore();
        const usersSnapshot = await db.collection('users').get();
        const users = [];
        
        // Kullanıcı verilerini topla
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            
            // displayName kontrolü
            if (userData.displayName) {
                const totalAssets = await calculateTotalAssets(userData);
                const lastLogin = userData.lastLogin ? userData.lastLogin.toDate() : null;
                const isActive = lastLogin ? (new Date() - lastLogin) / (1000 * 60 * 60 * 24) < 7 : false;
                
                users.push({
                    name: userData.displayName,
                    totalAssets: totalAssets,
                    lastLogin: lastLogin,
                    isActive: isActive
                });
            }
        }
        
        // Toplam varlığa göre sırala ve ilk 10'u al
        users.sort((a, b) => b.totalAssets - a.totalAssets);
        const top10 = users.slice(0, 10);
        
        // HTML oluştur
        let leaderboardHTML = '';
        top10.forEach((user, index) => {
            const rank = index + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : '';
            const trophyIcon = rank <= 3 ? `<i class="bi bi-trophy-fill trophy-icon trophy-${rank}"></i>` : '';
            const activeStatus = user.isActive ? 
                '<span class="badge bg-success ms-2">Aktif</span>' : 
                '<span class="badge bg-secondary ms-2">Pasif</span>';
            const lastLoginText = user.lastLogin ? 
                `<small class="text-muted">Son giriş: ${user.lastLogin.toLocaleDateString('tr-TR')}</small>` : '';
            
            leaderboardHTML += `
                <div class="leaderboard-item ${rankClass}">
                    <div class="leaderboard-rank">${trophyIcon}${rank}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">
                            ${formatName(user.name)}
                            ${activeStatus}
                        </div>
                        ${lastLoginText}
                    </div>
                    <div class="leaderboard-value">${formatCurrency(user.totalAssets)} USD</div>
                </div>
            `;
        });
        
        if (users.length === 0) {
            leaderboardHTML = '<div class="p-3 text-center">Henüz veri yok.</div>';
        }
        
        leaderboard.innerHTML = leaderboardHTML;
        
    } catch (error) {
        console.error('Liderlik tablosu güncellenirken hata:', error);
        leaderboard.innerHTML = '<div class="p-3 text-center text-danger">Veriler yüklenirken bir hata oluştu: ' + error.message + '</div>';
    }
}

// Çıkış butonu işlemleri
logoutBtn.addEventListener('click', () => {
    Swal.fire({
        title: 'Çıkış yapmak istediğinize emin misiniz?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Evet, çıkış yap',
        cancelButtonText: 'İptal',
        confirmButtonColor: '#e53e3e',
        cancelButtonColor: '#718096'
    }).then((result) => {
        if (result.isConfirmed) {
            firebase.auth().signOut().then(() => {
                window.location.href = 'index.html';
            });
        }
    });
});

// Oturum kontrolü
firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    userProfile.classList.remove('d-none');
    userPhoto.src = user.photoURL;
    userName.textContent = user.displayName;
    
    // Liderlik tablosunu güncelle
    updateLeaderboard();
});

// Her 30 saniyede bir liderlik tablosunu güncelle
setInterval(updateLeaderboard, 30000); 