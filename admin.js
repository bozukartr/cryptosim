// Admin yetkilendirmesi
const ADMIN_EMAILS = ['burakgolmusic@gmail.com'];

// DOM elementleri
const adminName = document.getElementById('adminName');
const resetAllBtn = document.getElementById('resetAllBtn');
const deleteInactiveBtn = document.getElementById('deleteInactiveBtn');
const clearPortfoliosBtn = document.getElementById('clearPortfoliosBtn');
const backupDataBtn = document.getElementById('backupDataBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userList = document.getElementById('userList');
const searchUser = document.getElementById('searchUser');
const transactionList = document.getElementById('transactionList');

// İstatistik elementleri
const totalUsers = document.getElementById('totalUsers');
const activeUsers = document.getElementById('activeUsers');
const totalTransactions = document.getElementById('totalTransactions');
const totalBalance = document.getElementById('totalBalance');
const topUsersList = document.getElementById('topUsersList');

// API Kontrol Elementleri
const priceUpdateInterval = document.getElementById('priceUpdateInterval');
const chartUpdateInterval = document.getElementById('chartUpdateInterval');
const maxRequestsPerMinute = document.getElementById('maxRequestsPerMinute');
const requestInterval = document.getElementById('requestInterval');
const apiStatusList = document.getElementById('apiStatusList');
const saveApiSettings = document.getElementById('saveApiSettings');
const resetApiSettings = document.getElementById('resetApiSettings');

// API Endpoints
const API_ENDPOINTS = {
    prices: '/api/v3/ticker/price'
};

// Varsayılan API Ayarları
const DEFAULT_API_SETTINGS = {
    priceUpdateInterval: 10000,
    chartUpdateInterval: 60000,
    maxRequestsPerMinute: 30,
    requestInterval: 500
};

// API İstatistikleri
let apiStats = {
    prices: { lastRequest: null, successRate: 100, avgResponseTime: 0, status: 'active', totalRequests: 0, successfulRequests: 0 },
    klines: { lastRequest: null, successRate: 100, avgResponseTime: 0, status: 'active', totalRequests: 0, successfulRequests: 0 },
    depth: { lastRequest: null, successRate: 100, avgResponseTime: 0, status: 'active', totalRequests: 0, successfulRequests: 0 }
};

// Para formatı
function formatCurrency(amount) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Tarih formatı
function formatDate(date) {
    return new Date(date).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Kullanıcı listesini yükle
async function loadUserList() {
    try {
        const db = firebase.firestore();
        const usersSnapshot = await db.collection('users').get();
        
        let html = '';
        usersSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            const lastLogin = userData.lastLogin ? userData.lastLogin.toDate() : null;
            const isActive = lastLogin ? (new Date() - lastLogin) / (1000 * 60 * 60 * 24) < 7 : false;
            
            html += `
                <tr>
                    <td>${userData.displayName || 'İsimsiz'}</td>
                    <td>${userData.email || '-'}</td>
                    <td>${formatCurrency(userData.balance || 0)} USD</td>
                    <td>${lastLogin ? formatDate(lastLogin) : '-'}</td>
                    <td>
                        <span class="badge bg-${isActive ? 'success' : 'secondary'}">
                            ${isActive ? 'Aktif' : 'Pasif'}
                        </span>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-warning" onclick="editBalance('${doc.id}', ${userData.balance})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-info" onclick="viewPortfolio('${doc.id}')">
                                <i class="bi bi-wallet2"></i>
                            </button>
                            <button class="btn btn-danger" onclick="deleteUser('${doc.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        userList.innerHTML = html || '<tr><td colspan="6" class="text-center">Kullanıcı bulunamadı.</td></tr>';
    } catch (error) {
        console.error('Kullanıcı listesi yükleme hatası:', error);
        userList.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Hata oluştu!</td></tr>';
    }
}

// Bakiye düzenleme
async function editBalance(userId, currentBalance) {
    const { value: newBalance } = await Swal.fire({
        title: 'Bakiye Düzenle',
        input: 'number',
        inputLabel: 'Yeni bakiye (USD)',
        inputValue: currentBalance,
        showCancelButton: true,
        confirmButtonText: 'Kaydet',
        cancelButtonText: 'İptal',
        inputValidator: (value) => {
            if (!value) return 'Bakiye boş olamaz!';
            if (value < 0) return 'Bakiye negatif olamaz!';
        }
    });

    if (newBalance) {
        try {
            const db = firebase.firestore();
            await db.collection('users').doc(userId).update({
                balance: parseFloat(newBalance)
            });
            
            await logTransaction('balance_update', userId, parseFloat(newBalance));
            
            Swal.fire({
                icon: 'success',
                title: 'Başarılı!',
                text: 'Bakiye güncellendi.',
                timer: 1500,
                showConfirmButton: false
            });
            
            loadUserList();
            loadStatistics();
        } catch (error) {
            console.error('Bakiye güncelleme hatası:', error);
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: 'Bakiye güncellenirken bir hata oluştu.'
            });
        }
    }
}

// Portföy görüntüleme
async function viewPortfolio(userId) {
    try {
        const db = firebase.firestore();
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        let portfolioHtml = '';
        if (userData.portfolio) {
            for (const [coin, data] of Object.entries(userData.portfolio)) {
                portfolioHtml += `
                    <tr>
                        <td>${coin}</td>
                        <td>${data.amount}</td>
                        <td>${formatCurrency(data.avgPrice)} USD</td>
                    </tr>
                `;
            }
        }
        
        Swal.fire({
            title: `${userData.displayName || 'Kullanıcı'} Portföyü`,
            html: `
                <div class="table-responsive">
                    <table class="table table-dark table-sm">
                        <thead>
                            <tr>
                                <th>Coin</th>
                                <th>Miktar</th>
                                <th>Ort. Alış</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${portfolioHtml || '<tr><td colspan="3" class="text-center">Portföy boş</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `,
            width: '600px'
        });
    } catch (error) {
        console.error('Portföy görüntüleme hatası:', error);
        Swal.fire({
            icon: 'error',
            title: 'Hata!',
            text: 'Portföy görüntülenirken bir hata oluştu.'
        });
    }
}

// Kullanıcı silme
async function deleteUser(userId) {
    const result = await Swal.fire({
        title: 'Emin misiniz?',
        text: "Bu kullanıcı kalıcı olarak silinecek!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Evet, sil!',
        cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
        try {
            const db = firebase.firestore();
            await db.collection('users').doc(userId).delete();
            
            await logTransaction('user_delete', userId);
            
            Swal.fire({
                icon: 'success',
                title: 'Başarılı!',
                text: 'Kullanıcı silindi.',
                timer: 1500,
                showConfirmButton: false
            });
            
            loadUserList();
            loadStatistics();
        } catch (error) {
            console.error('Kullanıcı silme hatası:', error);
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: 'Kullanıcı silinirken bir hata oluştu.'
            });
        }
    }
}

// İşlem kaydı
async function logTransaction(type, userId, amount = null) {
    try {
        const db = firebase.firestore();
        await db.collection('admin_logs').add({
            type,
            userId,
            amount,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            adminEmail: firebase.auth().currentUser.email
        });
    } catch (error) {
        console.error('İşlem kaydı hatası:', error);
    }
}

// İşlem geçmişini yükle
async function loadTransactions() {
    try {
        const db = firebase.firestore();
        const logsSnapshot = await db.collection('admin_logs')
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
        
        let html = '';
        for (const doc of logsSnapshot.docs) {
            const log = doc.data();
            const user = await db.collection('users').doc(log.userId).get();
            const userData = user.exists ? user.data() : null;
            
            html += `
                <tr>
                    <td>${formatDate(log.timestamp.toDate())}</td>
                    <td>${userData ? userData.displayName : 'Silinmiş Kullanıcı'}</td>
                    <td>${getTransactionType(log.type)}</td>
                    <td>${log.amount ? formatCurrency(log.amount) + ' USD' : '-'}</td>
                    <td>
                        <span class="badge bg-${getTransactionStatus(log.type)}">
                            ${getTransactionStatusText(log.type)}
                        </span>
                    </td>
                </tr>
            `;
        }
        
        transactionList.innerHTML = html || '<tr><td colspan="5" class="text-center">İşlem kaydı bulunamadı.</td></tr>';
    } catch (error) {
        console.error('İşlem geçmişi yükleme hatası:', error);
        transactionList.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Hata oluştu!</td></tr>';
    }
}

// İşlem tipi metni
function getTransactionType(type) {
    const types = {
        'balance_update': 'Bakiye Güncelleme',
        'user_delete': 'Kullanıcı Silme',
        'portfolio_clear': 'Portföy Temizleme',
        'balance_reset': 'Bakiye Sıfırlama'
    };
    return types[type] || type;
}

// İşlem durumu
function getTransactionStatus(type) {
    const status = {
        'balance_update': 'warning',
        'user_delete': 'danger',
        'portfolio_clear': 'info',
        'balance_reset': 'warning'
    };
    return status[type] || 'secondary';
}

// İşlem durumu metni
function getTransactionStatusText(type) {
    const status = {
        'balance_update': 'Güncellendi',
        'user_delete': 'Silindi',
        'portfolio_clear': 'Temizlendi',
        'balance_reset': 'Sıfırlandı'
    };
    return status[type] || 'Bilinmiyor';
}

// İstatistikleri yükle
async function loadStatistics() {
    try {
        const db = firebase.firestore();
        const usersSnapshot = await db.collection('users').get();
        
        // Toplam kullanıcı sayısı
        const userCount = usersSnapshot.size;
        totalUsers.textContent = userCount;
        
        // Aktif kullanıcı sayısı (son 7 gün)
        let activeCount = 0;
        let totalBalanceSum = 0;
        const users = [];
        
        usersSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            const lastLogin = userData.lastLogin ? userData.lastLogin.toDate() : null;
            const isActive = lastLogin ? (new Date() - lastLogin) / (1000 * 60 * 60 * 24) < 7 : false;
            
            if (isActive) activeCount++;
            totalBalanceSum += userData.balance || 0;
            
            users.push({
                displayName: userData.displayName || 'İsimsiz',
                email: userData.email || '-',
                balance: userData.balance || 0,
                lastLogin: lastLogin
            });
        });
        
        activeUsers.textContent = activeCount;
        totalBalance.textContent = formatCurrency(totalBalanceSum) + ' USD';
        
        // En yüksek bakiyeli kullanıcılar
        users.sort((a, b) => b.balance - a.balance);
        const topUsers = users.slice(0, 5);
        
        let topUsersHtml = '';
        topUsers.forEach((user, index) => {
            topUsersHtml += `
                <tr>
                    <td>
                        <i class="bi bi-trophy-fill me-2 ${index < 3 ? 'text-warning' : ''}"></i>
                        ${index + 1}
                    </td>
                    <td>${user.displayName}</td>
                    <td>${user.email}</td>
                    <td>${formatCurrency(user.balance)} USD</td>
                    <td>${user.lastLogin ? formatDate(user.lastLogin) : '-'}</td>
                </tr>
            `;
        });
        
        topUsersList.innerHTML = topUsersHtml || '<tr><td colspan="5" class="text-center">Veri bulunamadı.</td></tr>';
        
        // Toplam işlem sayısı
        const logsSnapshot = await db.collection('admin_logs').get();
        totalTransactions.textContent = logsSnapshot.size;
        
    } catch (error) {
        console.error('İstatistik yükleme hatası:', error);
        Swal.fire({
            icon: 'error',
            title: 'Hata!',
            text: 'İstatistikler yüklenirken bir hata oluştu.'
        });
    }
}

// Kullanıcı arama
searchUser.addEventListener('input', (e) => {
    const searchText = e.target.value.toLowerCase();
    const rows = userList.getElementsByTagName('tr');
    
    Array.from(rows).forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchText) ? '' : 'none';
    });
});

// Tüm kullanıcıların bakiyelerini sıfırla
resetAllBtn.addEventListener('click', async () => {
    const result = await Swal.fire({
        title: 'Emin misiniz?',
        text: "Tüm kullanıcıların bakiyeleri 100,000 USD'ye sıfırlanacak!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Evet, sıfırla!',
        cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
        try {
            const db = firebase.firestore();
            const usersSnapshot = await db.collection('users').get();
            
            const batch = db.batch();
            
            usersSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, {
                    balance: 100000
                });
            });
            
            await batch.commit();
            await logTransaction('balance_reset', 'all', 100000);
            
            Swal.fire({
                icon: 'success',
                title: 'Başarılı!',
                text: 'Tüm kullanıcıların bakiyeleri sıfırlandı.',
                timer: 1500,
                showConfirmButton: false
            });
            
            loadUserList();
            loadStatistics();
            loadTransactions();
        } catch (error) {
            console.error('Sıfırlama hatası:', error);
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: 'İşlem sırasında bir hata oluştu.'
            });
        }
    }
});

// Tüm portföyleri temizle
clearPortfoliosBtn.addEventListener('click', async () => {
    const result = await Swal.fire({
        title: 'Emin misiniz?',
        text: "Tüm kullanıcıların portföyleri temizlenecek!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Evet, temizle!',
        cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
        try {
            const db = firebase.firestore();
            const usersSnapshot = await db.collection('users').get();
            
            const batch = db.batch();
            
            usersSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, {
                    portfolio: {}
                });
            });
            
            await batch.commit();
            await logTransaction('portfolio_clear', 'all');
            
            Swal.fire({
                icon: 'success',
                title: 'Başarılı!',
                text: 'Tüm portföyler temizlendi.',
                timer: 1500,
                showConfirmButton: false
            });
            
            loadUserList();
            loadStatistics();
            loadTransactions();
        } catch (error) {
            console.error('Portföy temizleme hatası:', error);
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: 'İşlem sırasında bir hata oluştu.'
            });
        }
    }
});

// İnaktif kullanıcıları sil
deleteInactiveBtn.addEventListener('click', async () => {
    const result = await Swal.fire({
        title: 'Emin misiniz?',
        text: "30 günden fazla giriş yapmayan kullanıcılar silinecek!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Evet, sil!',
        cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
        try {
            const db = firebase.firestore();
            const usersSnapshot = await db.collection('users').get();
            
            const batch = db.batch();
            let deletedCount = 0;
            
            usersSnapshot.docs.forEach(doc => {
                const userData = doc.data();
                const lastLogin = userData.lastLogin ? userData.lastLogin.toDate() : null;
                
                if (!lastLogin || (new Date() - lastLogin) / (1000 * 60 * 60 * 24) > 30) {
                    batch.delete(doc.ref);
                    deletedCount++;
                }
            });
            
            if (deletedCount > 0) {
                await batch.commit();
                await logTransaction('inactive_delete', 'multiple', deletedCount);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Başarılı!',
                    text: `${deletedCount} inaktif kullanıcı silindi.`,
                    timer: 1500,
                    showConfirmButton: false
                });
                
                loadUserList();
                loadStatistics();
                loadTransactions();
            } else {
                Swal.fire({
                    icon: 'info',
                    title: 'Bilgi',
                    text: 'Silinecek inaktif kullanıcı bulunamadı.'
                });
            }
        } catch (error) {
            console.error('İnaktif kullanıcı silme hatası:', error);
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: 'İşlem sırasında bir hata oluştu.'
            });
        }
    }
});

// Veritabanı yedeği al
backupDataBtn.addEventListener('click', async () => {
    try {
        const db = firebase.firestore();
        const usersSnapshot = await db.collection('users').get();
        const logsSnapshot = await db.collection('admin_logs').get();
        
        const backup = {
            users: {},
            logs: {},
            timestamp: new Date().toISOString()
        };
        
        usersSnapshot.docs.forEach(doc => {
            backup.users[doc.id] = doc.data();
        });
        
        logsSnapshot.docs.forEach(doc => {
            backup.logs[doc.id] = doc.data();
        });
        
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `cryptosimulator_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        await logTransaction('backup_create', 'system');
        
        Swal.fire({
            icon: 'success',
            title: 'Başarılı!',
            text: 'Veritabanı yedeği indirildi.',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('Yedekleme hatası:', error);
        Swal.fire({
            icon: 'error',
            title: 'Hata!',
            text: 'Yedek oluşturulurken bir hata oluştu.'
        });
    }
});

// Çıkış yap
logoutBtn.addEventListener('click', async () => {
    const result = await Swal.fire({
        title: 'Çıkış yapmak istiyor musunuz?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Evet',
        cancelButtonText: 'Hayır'
    });

    if (result.isConfirmed) {
        try {
            await firebase.auth().signOut();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Çıkış hatası:', error);
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: 'Çıkış yapılırken bir hata oluştu.'
            });
        }
    }
});

// Oturum kontrolü
firebase.auth().onAuthStateChanged(async user => {
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
        window.location.href = 'index.html';
        return;
    }
    
    // Admin adını göster
    adminName.textContent = user.displayName || user.email;
    
    // Verileri yükle
    loadUserList();
    loadStatistics();
    loadTransactions();
    
    // Her 30 saniyede bir verileri güncelle
    setInterval(() => {
        loadUserList();
        loadStatistics();
        loadTransactions();
    }, 30000);
});

// API Ayarlarını Yükle
async function loadApiSettings() {
    try {
        const db = firebase.firestore();
        const settingsDoc = await db.collection('admin').doc('api_settings').get();
        
        if (settingsDoc.exists) {
            const settings = settingsDoc.data();
            priceUpdateInterval.value = settings.priceUpdateInterval;
            chartUpdateInterval.value = settings.chartUpdateInterval;
            maxRequestsPerMinute.value = settings.maxRequestsPerMinute;
            requestInterval.value = settings.requestInterval;
        } else {
            resetToDefaultSettings();
        }
    } catch (error) {
        console.error('API ayarları yüklenirken hata:', error);
        Swal.fire({
            icon: 'error',
            title: 'Hata',
            text: 'API ayarları yüklenirken bir hata oluştu.'
        });
    }
}

// API Ayarlarını Kaydet
async function handleSaveApiSettings() {
    try {
        const db = firebase.firestore();
        await db.collection('admin').doc('api_settings').set({
            priceUpdateInterval: parseInt(priceUpdateInterval.value),
            chartUpdateInterval: parseInt(chartUpdateInterval.value),
            maxRequestsPerMinute: parseInt(maxRequestsPerMinute.value),
            requestInterval: parseInt(requestInterval.value),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        Swal.fire({
            icon: 'success',
            title: 'Başarılı',
            text: 'API ayarları başarıyla kaydedildi.'
        });

        // API durumunu güncelle
        updateApiStatus();
    } catch (error) {
        console.error('API ayarları kaydedilirken hata:', error);
        Swal.fire({
            icon: 'error',
            title: 'Hata',
            text: 'API ayarları kaydedilirken bir hata oluştu.'
        });
    }
}

// Varsayılan Ayarlara Döndür
function resetToDefaultSettings() {
    priceUpdateInterval.value = DEFAULT_API_SETTINGS.priceUpdateInterval;
    chartUpdateInterval.value = DEFAULT_API_SETTINGS.chartUpdateInterval;
    maxRequestsPerMinute.value = DEFAULT_API_SETTINGS.maxRequestsPerMinute;
    requestInterval.value = DEFAULT_API_SETTINGS.requestInterval;
}

// API Durumunu Güncelle
async function updateApiStatus() {
    const now = new Date();
    let statusHTML = '';

    for (const [endpoint, path] of Object.entries(API_ENDPOINTS)) {
        const stats = apiStats[endpoint];
        const lastRequestTime = stats.lastRequest ? new Date(stats.lastRequest) : null;
        const timeDiff = lastRequestTime ? Math.floor((now - lastRequestTime) / 1000) : null;
        
        let statusClass = 'success';
        let statusText = 'Aktif';
        
        if (stats.successRate < 90) {
            statusClass = 'warning';
            statusText = 'Uyarı';
        }
        if (stats.successRate < 70) {
            statusClass = 'danger';
            statusText = 'Kritik';
        }

        statusHTML += `
            <tr>
                <td>${path}</td>
                <td>${lastRequestTime ? `${timeDiff} saniye önce` : 'Henüz istek yok'}</td>
                <td>${stats.successRate.toFixed(1)}%</td>
                <td>${stats.avgResponseTime.toFixed(0)} ms</td>
                <td><span class="badge bg-${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }

    apiStatusList.innerHTML = statusHTML;
}

// API İsteği Simülasyonu (Test için)
async function simulateApiRequest(endpoint) {
    const stats = apiStats[endpoint];
    stats.totalRequests++;
    
    const startTime = Date.now();
    try {
        const response = await fetch(`https://api.binance.com${API_ENDPOINTS[endpoint]}`);
        if (response.ok) {
            stats.successfulRequests++;
        }
    } catch (error) {
        console.error(`API isteği başarısız (${endpoint}):`, error);
    }
    
    const endTime = Date.now();
    stats.lastRequest = new Date();
    stats.avgResponseTime = ((stats.avgResponseTime * (stats.totalRequests - 1)) + (endTime - startTime)) / stats.totalRequests;
    stats.successRate = (stats.successfulRequests / stats.totalRequests) * 100;
    
    updateApiStatus();
}

// Event Listeners
document.getElementById('saveApiSettings').addEventListener('click', handleSaveApiSettings);
resetApiSettings.addEventListener('click', async () => {
    const result = await Swal.fire({
        icon: 'warning',
        title: 'Emin misiniz?',
        text: 'API ayarları varsayılan değerlere döndürülecek.',
        showCancelButton: true,
        confirmButtonText: 'Evet',
        cancelButtonText: 'İptal'
    });

    if (result.isConfirmed) {
        resetToDefaultSettings();
        await handleSaveApiSettings();
    }
});

// Bakım modu kontrolü
let maintenanceMode = false;

// Bakım modu butonu işlemleri
maintenanceModeBtn.addEventListener('click', async () => {
    try {
        const db = firebase.firestore();
        maintenanceMode = !maintenanceMode;
        
        await db.collection('admin').doc('settings').set({
            maintenanceMode: maintenanceMode,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        maintenanceModeBtn.classList.toggle('active');
        maintenanceModeBtn.innerHTML = maintenanceMode ? 
            '<i class="bi bi-tools"></i> Bakım Modunu Kapat' : 
            '<i class="bi bi-tools"></i> Bakım Modu';
            
        Swal.fire({
            icon: 'success',
            title: maintenanceMode ? 'Bakım Modu Aktif' : 'Bakım Modu Kapalı',
            text: maintenanceMode ? 'Kullanıcılar sisteme giriş yapamayacak.' : 'Sistem normal çalışmaya devam ediyor.',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('Bakım modu hatası:', error);
        Swal.fire({
            icon: 'error',
            title: 'Hata!',
            text: 'Bakım modu değiştirilirken bir hata oluştu.'
        });
    }
});

// Admin ekleme
addAdminBtn.addEventListener('click', async () => {
    const email = newAdminEmail.value.trim();
    if (!email) {
        Swal.fire({
            icon: 'warning',
            title: 'Uyarı',
            text: 'Lütfen bir e-posta adresi girin.'
        });
        return;
    }
    
    try {
        const db = firebase.firestore();
        const adminDoc = await db.collection('admin').doc('settings').get();
        const currentAdmins = adminDoc.exists ? (adminDoc.data().admins || []) : [];
        
        if (currentAdmins.includes(email)) {
            Swal.fire({
                icon: 'warning',
                title: 'Uyarı',
                text: 'Bu e-posta zaten admin listesinde.'
            });
            return;
        }
        
        await db.collection('admin').doc('settings').set({
            admins: [...currentAdmins, email],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        newAdminEmail.value = '';
        loadAdminList();
        
        Swal.fire({
            icon: 'success',
            title: 'Başarılı',
            text: 'Admin başarıyla eklendi.',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('Admin ekleme hatası:', error);
        Swal.fire({
            icon: 'error',
            title: 'Hata!',
            text: 'Admin eklenirken bir hata oluştu.'
        });
    }
});

// Admin listesini yükle
async function loadAdminList() {
    try {
        const db = firebase.firestore();
        const adminDoc = await db.collection('admin').doc('settings').get();
        const admins = adminDoc.exists ? (adminDoc.data().admins || []) : [];
        
        let html = '';
        admins.forEach(email => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <i class="bi bi-person-badge me-2"></i>
                        ${email}
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="removeAdmin('${email}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
        });
        
        adminList.innerHTML = html || '<div class="list-group-item text-center">Admin bulunamadı.</div>';
    } catch (error) {
        console.error('Admin listesi yükleme hatası:', error);
        adminList.innerHTML = '<div class="list-group-item text-center text-danger">Hata oluştu!</div>';
    }
}

// Admin silme
async function removeAdmin(email) {
    if (email === firebase.auth().currentUser.email) {
        Swal.fire({
            icon: 'error',
            title: 'Hata!',
            text: 'Kendinizi admin listesinden çıkaramazsınız.'
        });
        return;
    }
    
    const result = await Swal.fire({
        title: 'Emin misiniz?',
        text: `${email} admin listesinden çıkarılacak.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Evet, çıkar',
        cancelButtonText: 'İptal'
    });
    
    if (result.isConfirmed) {
        try {
            const db = firebase.firestore();
            const adminDoc = await db.collection('admin').doc('settings').get();
            const currentAdmins = adminDoc.exists ? (adminDoc.data().admins || []) : [];
            
            await db.collection('admin').doc('settings').set({
                admins: currentAdmins.filter(e => e !== email),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            loadAdminList();
            
            Swal.fire({
                icon: 'success',
                title: 'Başarılı',
                text: 'Admin başarıyla çıkarıldı.',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Admin silme hatası:', error);
            Swal.fire({
                icon: 'error',
                title: 'Hata!',
                text: 'Admin çıkarılırken bir hata oluştu.'
            });
        }
    }
}

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', async () => {
    // Bakım modu durumunu kontrol et
    try {
        const db = firebase.firestore();
        const settingsDoc = await db.collection('admin').doc('settings').get();
        if (settingsDoc.exists) {
            maintenanceMode = settingsDoc.data().maintenanceMode || false;
            maintenanceModeBtn.classList.toggle('active', maintenanceMode);
            maintenanceModeBtn.innerHTML = maintenanceMode ? 
                '<i class="bi bi-tools"></i> Bakım Modunu Kapat' : 
                '<i class="bi bi-tools"></i> Bakım Modu';
        }
    } catch (error) {
        console.error('Bakım modu kontrolü hatası:', error);
    }
    
    // Admin listesini yükle
    loadAdminList();
    
    // Diğer yüklemeler
    loadUserList();
    loadStatistics();
    loadTransactions();
    loadApiSettings();
    
    // Her 30 saniyede bir verileri güncelle
    setInterval(() => {
        loadUserList();
        loadStatistics();
        loadTransactions();
        updateApiStatus();
    }, 30000);
}); 