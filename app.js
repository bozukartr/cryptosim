// DOM elementleri
const userProfile = document.getElementById('userProfile');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');
const userBalance = document.getElementById('userBalance');
const resetBtn = document.getElementById('resetBtn');
const marketOverview = document.getElementById('marketOverview');
const portfolio = document.getElementById('portfolio');
const tradingChart = document.getElementById('tradingChart');
const buyForm = document.getElementById('buyForm');
const sellForm = document.getElementById('sellForm');
const logoutBtn = document.getElementById('logoutBtn');
const selectedCoinTitle = document.getElementById('selectedCoinTitle');

// Binance API endpoint'i
const BINANCE_API = 'https://api.binance.com/api/v3';

// Takip edilecek çiftler
const TRACKED_PAIRS = [
    'BTCUSDT',
    'ETHUSDT',
    'BNBUSDT',
    'XRPUSDT',
    'ADAUSDT',
    'SOLUSDT',
    'DOTUSDT',
    'DOGEUSDT',
    'AVAXUSDT',
    'TRXUSDT'
];

// Trading pair'leri sembollere eşleştirme
const PAIR_SYMBOLS = {
    'BTCUSDT': 'BTC',
    'ETHUSDT': 'ETH',
    'BNBUSDT': 'BNB',
    'XRPUSDT': 'XRP',
    'ADAUSDT': 'ADA',
    'SOLUSDT': 'SOL',
    'DOTUSDT': 'DOT',
    'DOGEUSDT': 'DOGE',
    'AVAXUSDT': 'AVAX',
    'TRXUSDT': 'TRX'
};

// Coin isimlerini tutacak obje
const COIN_NAMES = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'BNB': 'Binance Coin',
    'XRP': 'Ripple',
    'ADA': 'Cardano',
    'SOL': 'Solana',
    'DOT': 'Polkadot',
    'DOGE': 'Dogecoin',
    'AVAX': 'Avalanche',
    'TRX': 'TRON'
};

// Kullanıcı verilerini tutacak değişkenler
let currentUser = null;
let userPortfolio = {};
let currentPrices = {}; // Tüm coinlerin fiyatları
let currentPrice = 0;   // Seçili coinin fiyatı
let currentChart = null;
let selectedCoin = 'BTC';
let selectedPair = 'BTCUSDT';

// Input elementleri
const buyUSDT = document.getElementById('buyUSDT');
const buyCoin = document.getElementById('buyCoin');
const sellUSDT = document.getElementById('sellUSDT');
const sellCoin = document.getElementById('sellCoin');
const coinSymbolElements = document.querySelectorAll('.coin-symbol');

// Para formatı için yardımcı fonksiyon
function formatCurrency(number) {
    return number.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Reset butonu işlemleri
resetBtn.addEventListener('click', async () => {
    Swal.fire({
        title: 'Bakiyeyi sıfırlamak istediğinize emin misiniz?',
        text: 'Bu işlem bakiyenizi 100.000 USDT yapacak ve portföyünüzü temizleyecektir.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Evet, sıfırla',
        cancelButtonText: 'İptal',
        confirmButtonColor: '#f3ba2f',
        cancelButtonColor: '#718096'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const db = firebase.firestore();
                await db.collection('users').doc(currentUser.uid).set({
                    balance: 100000,
                    portfolio: {},
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                Swal.fire({
                    icon: 'success',
                    title: 'Bakiye Sıfırlandı',
                    text: 'Bakiyeniz 100.000 USDT olarak güncellendi.',
                    timer: 2000,
                    showConfirmButton: false
                });
                
                loadUserPortfolio();
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Hata',
                    text: 'Bakiye sıfırlanırken bir hata oluştu.'
                });
            }
        }
    });
});

// Kullanıcı portföyünü yükle
async function loadUserPortfolio() {
    const db = firebase.firestore();
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    
    if (!userDoc.exists) {
        await db.collection('users').doc(currentUser.uid).set({
            balance: 100000,
            portfolio: {},
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        userPortfolio = {};
    } else {
        const userData = userDoc.data();
        userPortfolio = userData.portfolio || {};
        userBalance.textContent = `${formatCurrency(userData.balance)} USD`;
    }
    updatePortfolioDisplay();
}

// Kripto fiyatlarını güncelle
async function updatePrices() {
    try {
        const response = await fetch(`${BINANCE_API}/ticker/24hr?symbols=${JSON.stringify(TRACKED_PAIRS)}`);
        const data = await response.json();
        
        let marketOverviewHTML = '';
        
        for (const pair of data) {
            const symbol = PAIR_SYMBOLS[pair.symbol];
            const price = parseFloat(pair.lastPrice);
            const change = parseFloat(pair.priceChangePercent);
            
            currentPrices[symbol] = price;
            
            if (pair.symbol === selectedPair) {
                currentPrice = price;
            }
            
            marketOverviewHTML += `
                <div class="crypto-item ${symbol === selectedCoin ? 'active' : ''}" data-symbol="${symbol}" data-pair="${pair.symbol}">
                    <span>${COIN_NAMES[symbol]} (${symbol})</span>
                    <div class="text-end">
                        <div>${formatCurrency(price)} USD</div>
                        <div class="${change >= 0 ? 'price-up' : 'price-down'}">
                            ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
                        </div>
                    </div>
                </div>
            `;
        }
        
        marketOverview.innerHTML = marketOverviewHTML;
        updatePortfolioDisplay();
        
        addMarketItemListeners();
    } catch (error) {
        console.error('Fiyat güncellenirken hata:', error);
    }
}

// Portföy görüntüsünü güncelle
function updatePortfolioDisplay() {
    if (!currentUser) return;
    
    let portfolioHTML = '';
    let totalValue = 0;
    
    for (const [coin, amount] of Object.entries(userPortfolio)) {
        if (amount > 0) {
            const value = amount * (currentPrices[coin] || 0);
            totalValue += value;
            
            portfolioHTML += `
                <div class="crypto-item ${coin === selectedCoin ? 'active' : ''}" data-symbol="${coin}" data-pair="${coin}USDT">
                    <span>${COIN_NAMES[coin]} (${coin})</span>
                    <div class="text-end">
                        <div>${amount.toFixed(8)}</div>
                        <div>${formatCurrency(value)} USD</div>
                    </div>
                </div>
            `;
        }
    }
    
    portfolio.innerHTML = portfolioHTML || '<div class="p-3 text-center">Henüz coin almadınız.</div>';
    
    addPortfolioItemListeners();
}

// Market öğelerine tıklama olayı ekle
function addMarketItemListeners() {
    const items = marketOverview.querySelectorAll('.crypto-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            selectCoin(item.dataset.symbol, item.dataset.pair);
        });
    });
}

// Portföy öğelerine tıklama olayı ekle
function addPortfolioItemListeners() {
    const items = portfolio.querySelectorAll('.crypto-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            selectCoin(item.dataset.symbol, item.dataset.pair);
        });
    });
}

// Coin seçimi
function selectCoin(symbol, pair) {
    selectedCoin = symbol;
    selectedPair = pair;
    selectedCoinTitle.textContent = `${COIN_NAMES[symbol]} (${symbol}) Grafiği`;
    
    // Seçili coin için güncel fiyatı ayarla
    currentPrice = currentPrices[symbol];
    
    // Coin sembollerini güncelle
    updateCoinSymbol();
    
    // Aktif sınıfını güncelle
    document.querySelectorAll('.crypto-item').forEach(item => {
        if (item.dataset.symbol === symbol) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Grafiği güncelle
    createChart(pair);
}

// Grafik verilerini al
async function getChartData(symbol = 'BTCUSDT', interval = '1h', limit = 24) {
    try {
        const response = await fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        const data = await response.json();
        return data.map(d => [d[0], parseFloat(d[4])]); // Zaman ve kapanış fiyatı
    } catch (error) {
        console.error('Grafik veri hatası:', error);
        return [];
    }
}

// Grafik oluşturma
async function createChart(pair = 'BTCUSDT') {
    try {
        const chartData = await getChartData(pair);
        
        // Veri kontrolü
        if (!chartData || chartData.length === 0) {
            console.error('Grafik verisi alınamadı');
            return;
        }
        
        // Eğer önceki grafik varsa yok et
        if (currentChart) {
            currentChart.destroy();
        }
        
        const ctx = document.getElementById('tradingChart').getContext('2d');
        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.map(d => {
                    const date = new Date(d[0]);
                    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                }),
                datasets: [{
                    label: `${selectedCoin} / USD`,
                    data: chartData.map(d => d[1]),
                    borderColor: '#f3ba2f',
                    backgroundColor: 'rgba(243, 186, 47, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHitRadius: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#ffffff'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ffffff',
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    } catch (error) {
        console.error('Grafik oluşturma hatası:', error);
    }
}

// Alım işlemi güncelleme
buyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        Swal.fire({
            icon: 'warning',
            title: 'Oturum Gerekli',
            text: 'Lütfen önce giriş yapın.'
        });
        return;
    }
    
    const usdtAmount = parseFloat(buyUSDT.value);
    const coinAmount = parseFloat(buyCoin.value);
    
    if (isNaN(usdtAmount) || usdtAmount <= 0) {
        Swal.fire({
            icon: 'error',
            title: 'Geçersiz Miktar',
            text: 'Lütfen geçerli bir USDT miktarı girin.'
        });
        return;
    }
    
    const db = firebase.firestore();
    const userRef = db.collection('users').doc(currentUser.uid);
    
    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const userData = userDoc.data();
            const currentBalance = parseFloat(userData.balance);
            
            if (currentBalance < usdtAmount) {
                throw new Error('Yetersiz bakiye');
            }
            
            const newBalance = currentBalance - usdtAmount;
            const newAmount = (userData.portfolio[selectedCoin] || 0) + coinAmount;
            
            transaction.update(userRef, {
                balance: newBalance,
                [`portfolio.${selectedCoin}`]: newAmount
            });
        });
        
        Swal.fire({
            icon: 'success',
            title: 'İşlem Başarılı',
            text: `${coinAmount.toFixed(8)} ${selectedCoin} başarıyla satın alındı.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        loadUserPortfolio();
        buyUSDT.value = '';
        buyCoin.value = '';
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'İşlem Hatası',
            text: error.message
        });
    }
});

// Satış işlemi güncelleme
sellForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        Swal.fire({
            icon: 'warning',
            title: 'Oturum Gerekli',
            text: 'Lütfen önce giriş yapın.'
        });
        return;
    }
    
    const coinAmount = parseFloat(sellCoin.value);
    const usdtAmount = parseFloat(sellUSDT.value);
    
    if (isNaN(coinAmount) || coinAmount <= 0) {
        Swal.fire({
            icon: 'error',
            title: 'Geçersiz Miktar',
            text: 'Lütfen geçerli bir coin miktarı girin.'
        });
        return;
    }
    
    const db = firebase.firestore();
    const userRef = db.collection('users').doc(currentUser.uid);
    
    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const userData = userDoc.data();
            const currentBalance = parseFloat(userData.balance);
            const currentCoinAmount = userData.portfolio[selectedCoin] || 0;
            
            if (currentCoinAmount < coinAmount) {
                throw new Error('Yetersiz coin miktarı');
            }
            
            const newBalance = currentBalance + usdtAmount;
            const newAmount = currentCoinAmount - coinAmount;
            
            transaction.update(userRef, {
                balance: newBalance,
                [`portfolio.${selectedCoin}`]: newAmount
            });
        });
        
        Swal.fire({
            icon: 'success',
            title: 'İşlem Başarılı',
            text: `${coinAmount.toFixed(8)} ${selectedCoin} başarıyla satıldı.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        loadUserPortfolio();
        sellCoin.value = '';
        sellUSDT.value = '';
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'İşlem Hatası',
            text: error.message
        });
    }
});

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
    loadUserPortfolio();
});

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    // İlk veri yüklemesi
    updatePrices();
    createChart();
    
    // 5 saniyede bir fiyatları güncelle
    setInterval(updatePrices, 5000);
});

// Input event listeners
buyUSDT.addEventListener('input', () => {
    if (buyUSDT.value && currentPrice > 0) {
        const coinAmount = parseFloat(buyUSDT.value) / currentPrice;
        buyCoin.value = coinAmount.toFixed(8);
    } else {
        buyCoin.value = '';
    }
});

buyCoin.addEventListener('input', () => {
    if (buyCoin.value && currentPrice > 0) {
        const usdtAmount = parseFloat(buyCoin.value) * currentPrice;
        buyUSDT.value = usdtAmount.toFixed(2);
    } else {
        buyUSDT.value = '';
    }
});

sellCoin.addEventListener('input', () => {
    if (sellCoin.value && currentPrice > 0) {
        const usdtAmount = parseFloat(sellCoin.value) * currentPrice;
        sellUSDT.value = usdtAmount.toFixed(2);
    } else {
        sellUSDT.value = '';
    }
});

sellUSDT.addEventListener('input', () => {
    if (sellUSDT.value && currentPrice > 0) {
        const coinAmount = parseFloat(sellUSDT.value) / currentPrice;
        sellCoin.value = coinAmount.toFixed(8);
    } else {
        sellCoin.value = '';
    }
});

// Coin sembolünü güncelleme fonksiyonu
function updateCoinSymbol() {
    coinSymbolElements.forEach(element => {
        element.textContent = selectedCoin;
    });
}

// Coin seçildiğinde sembolü güncelle
marketOverview.addEventListener('click', async (e) => {
    const item = e.target.closest('.crypto-item');
    if (item) {
        // ... mevcut kod ...
        updateCoinSymbol(); // Coin sembolünü güncelle
    }
});

portfolio.addEventListener('click', async (e) => {
    const item = e.target.closest('.crypto-item');
    if (item) {
        // ... mevcut kod ...
        updateCoinSymbol(); // Coin sembolünü güncelle
    }
}); 