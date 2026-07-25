/**
 * WALLET CONNECTION MODULE v5.0 - Direct Connection (No QR Code)
 * 
 * Mobile: Tap wallet → Opens wallet app DApp browser → Auto-connects
 * Desktop: Connect via extension or QR code
 */

const walletState = {
    connected: false, address: null, network: null, provider: null,
    signer: null, chainId: null, walletType: null, isMobile: false,
    balance: '0', isInAppBrowser: false
};

let walletSelectionResolver = null;

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}

// ============================================
// DAPP BROWSER DETECTION
// ============================================
function detectInAppBrowser() {
    const ua = navigator.userAgent.toLowerCase();
    const checks = {
        okx: ua.includes('okx') || typeof window.okxwallet !== 'undefined',
        metaMask: ua.includes('metamask') || (typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask),
        trust: ua.includes('trust') || ua.includes('trustwallet') || (typeof window.ethereum !== 'undefined' && (window.ethereum.isTrust || window.ethereum.isTrustWallet)),
        tronlink: ua.includes('tronlink') || (typeof window.tronWeb !== 'undefined' && window.tronWeb.ready),
        bitget: (ua.includes('bitget') || ua.includes('bitkeep')) || (typeof window.bitkeep !== 'undefined'),
        binance: ua.includes('binance') || (typeof window.BinanceChain !== 'undefined')
    };
    const isInApp = Object.values(checks).some(v => v);
    const type = Object.keys(checks).find(k => checks[k]) || null;
    return { isInApp, type, ...checks };
}

// ============================================
// AUTO-CONNECT (DApp Browser)
// ============================================
async function autoConnectIfInAppBrowser() {
    const inApp = detectInAppBrowser();
    walletState.isInAppBrowser = inApp.isInApp;
    walletState.isMobile = isMobileDevice();

    if (!inApp.isInApp) return { success: false, message: 'Not in DApp browser' };

    console.log('DApp browser detected:', inApp.type);

    try {
        if (typeof window.ethereum !== 'undefined') {
            const result = await connectEVMDirect();
            if (result.success) return result;
            await new Promise(r => setTimeout(r, 500));
            return await connectEVMDirect();
        }
    } catch (e) { console.error('Auto-connect error:', e); }
    return { success: false, message: 'No provider found' };
}

// ============================================
// DIRECT CONNECTION (DApp Browser / Extension)
// ============================================
async function connectEVMDirect() {
    let walletType = 'trustwallet';
    if (window.ethereum.isMetaMask) walletType = 'metamask';
    
    return await connectEVMProvider(window.ethereum, walletType);
}

async function connectEVMProvider(ethProvider, walletType) {
    try {
        // Request accounts first (this triggers the approval popup in wallet)
        const accounts = await ethProvider.request({ method: 'eth_requestAccounts' });
        
        if (!accounts || accounts.length === 0) {
            return { success: false, message: 'No accounts - user may have rejected' };
        }
        
        // Get chain ID
        const chainIdHex = await ethProvider.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex, 16);
        
        // Create ethers provider
        const provider = new ethers.BrowserProvider(ethProvider);
        const signer = await provider.getSigner();
        
        // Determine network
        let network = 'ERC20';
        if (chainId === 56) network = 'BEP20';
        else if (chainId === 137) network = 'POLYGON';
        else if (chainId === 42161) network = 'ARBITRUM';
        
        // Get balance
        const bal = await provider.getBalance(accounts[0]);
        const balance = parseFloat(ethers.formatEther(bal)).toFixed(4);
        
        // Update wallet state
        walletState.connected = true;
        walletState.address = accounts[0];
        walletState.provider = provider;
        walletState.signer = signer;
        walletState.chainId = BigInt(chainId);
        walletState.walletType = walletType;
        walletState.isMobile = isMobileDevice();
        walletState.network = network;
        walletState.balance = balance;
        
        console.log('EVM connected:', walletType, accounts[0], network);
        
        return {
            success: true,
            address: accounts[0],
            balance: balance,
            network: network,
            isMobile: walletState.isMobile
        };
    } catch (error) {
        console.error('EVM connect error:', walletType, error);
        return { success: false, message: error.message || 'Connection failed' };
    }
}

// ============================================
// MAIN CONNECT
// ============================================
async function autoConnectWallet() {
    // Auto-connect if in DApp browser
    const inApp = await autoConnectIfInAppBrowser();
    if (inApp.success) return inApp;

    // Desktop: try extensions
    if (!isMobileDevice()) {
        if (typeof window.ethereum !== 'undefined' && (window.ethereum.isTrust || window.ethereum.isTrustWallet)) {
            const result = await connectEVMDirect();
            if (result.success) return result;
        }
    }

    // Show wallet selection
    showWalletSelectionModal();
    return new Promise(resolve => { walletSelectionResolver = resolve; });
}

// ============================================
// WALLET SELECTION MODAL
// ============================================
function showWalletSelectionModal() {
    const isMobile = isMobileDevice();
    const siteUrl = window.location.href;
    
    // Mobile wallet deep links (open wallet DApp browser directly)
    const siteOrigin = window.location.origin;
    const sitePath = window.location.pathname;
    
    const mobileWallets = [
        { key: 'trust', name: 'Trust Wallet', icon: '💙', color: '#3375BB', border: '#3375BB',
          link: `trust://browser_request?url=${encodeURIComponent(siteOrigin + sitePath)}` }
    ];

    let html = `
        <div id="walletSelectionModal" class="modal" style="display:flex; z-index:5000;">
            <div class="modal-content" style="max-width:400px; max-height:80vh; overflow-y:auto;">
                <div class="modal-header">
                    <h2>${isMobile ? 'اختر محفظتك' : 'Connect Wallet'}</h2>
                    <button class="modal-close" onclick="closeWalletSelectionModal()">✕</button>
                </div>
                <div style="padding:15px;">
    `;

    if (isMobile) {
        // Mobile: Direct deep links to wallet DApp browsers (NO QR CODE)
        html += `<div style="text-align:center; padding:8px; font-size:12px; color:#00FF41; margin-bottom:12px; background:rgba(0,255,65,0.05); border-radius:8px;">
            اختر محفظتك → سيتم فتحها مباشرة → وافق على الاتصال
        </div>`;
        
        mobileWallets.forEach(w => {
            html += `<button onclick="openWalletApp('${w.key}', '${w.link.replace(/'/g, "\\'")}')"
                style="width:100%; padding:16px; margin-bottom:10px;
                background:linear-gradient(135deg, ${w.color}, ${w.color}cc);
                border:2px solid ${w.border}; color:white; border-radius:12px;
                font-weight:bold; cursor:pointer; display:flex; align-items:center;
                justify-content:center; gap:12px; font-size:15px;">
                    <span style="font-size:24px;">${w.icon}</span> ${w.name}
            </button>`;
        });
        
        html += `<div style="text-align:center; padding:10px; font-size:11px; color:#888; margin-top:8px;">
            سيتم فتح الموقع داخل المحفظة تلقائياً
        </div>`;
    } else {
        // Desktop: Trust Wallet extension
        if (typeof window.ethereum !== 'undefined' && window.ethereum.isTrust) {
            html += deskBtn('Trust Wallet', '💙', '#3375BB', '#3375BB', "connectAndResolve('trust')");
        } else {
            html += `<p style="color:#999; text-align:center; padding:20px;">
                Please install Trust Wallet browser extension.
            </p>`;
        }
    }

    html += `</div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function deskBtn(name, icon, bg, border, onclick) {
    return `<button onclick="${onclick}"
        style="width:100%; padding:14px; margin-bottom:8px;
        background:linear-gradient(135deg, ${bg}, ${bg}cc);
        border:1px solid ${border}; color:white; border-radius:10px;
        font-weight:bold; cursor:pointer; display:flex; align-items:center;
        justify-content:center; gap:10px; font-size:14px;">
        <span style="font-size:20px;">${icon}</span> ${name}
    </button>`;
}

function closeWalletSelectionModal() {
    const m = document.getElementById('walletSelectionModal');
    if (m) m.remove();
}

// ============================================
// OPEN WALLET APP (with fallback)
// ============================================
function openWalletApp(walletKey, primaryLink) {
    const siteOrigin = window.location.origin;
    const sitePath = window.location.pathname;
    const cleanUrl = siteOrigin + sitePath;
    
    const deepLinks = {
        trust: [
            `trust://browser_request?url=${encodeURIComponent(cleanUrl)}`,
            `https://link.trustwallet.com/open_url?url=${encodeURIComponent(cleanUrl)}`
        ]
    };
    
    const links = deepLinks[walletKey] || [primaryLink];
    
    let i = 0;
    function tryNext() {
        if (i >= links.length) return;
        window.location.href = links[i];
        i++;
        setTimeout(tryNext, 2000);
    }
    tryNext();
}

// ============================================
// CONNECT AND RESOLVE
// ============================================
async function connectAndResolve(walletType) {
    closeWalletSelectionModal();
    let result;
    try {
        if (walletType === 'trust') {
            result = await connectEVMDirect();
        } else {
            result = { success: false, message: 'Unknown wallet' };
        }
    } catch (e) { result = { success: false, message: e.message }; }
    if (walletSelectionResolver) { walletSelectionResolver(result); walletSelectionResolver = null; }
}

function resolveWalletSelection(result) {
    if (walletSelectionResolver) { walletSelectionResolver(result); walletSelectionResolver = null; }
}

// ============================================
// DISCONNECT
// ============================================
function disconnectWallet() {
    walletState.connected = false;
    walletState.address = null;
    walletState.network = null;
    walletState.provider = null;
    walletState.signer = null;
    walletState.chainId = null;
    walletState.walletType = null;
    walletState.balance = '0';
}

// ============================================
// BALANCE
// ============================================
async function getWalletBalance() {
    if (!walletState.connected || !walletState.provider) return '0';
    try { const b = await walletState.provider.getBalance(walletState.address); return parseFloat(ethers.formatEther(b)).toFixed(4); } catch { return '0'; }
}

async function getUSDTBalance(network) {
    if (!walletState.connected || !walletState.provider) return '0';
    const c = { TRC20: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', ERC20: '0xdAC17F958D2ee523a2206206994597C13D831ec7', BEP20: '0x55d398326f99059fF775485246999027B3197955' };
    if (!c[network]) return '0';
    try {
        const ct = new ethers.Contract(c[network], ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'], walletState.provider);
        const b = await ct.balanceOf(walletState.address);
        const d = await ct.decimals();
        return parseFloat(b / BigInt(10 ** d)).toFixed(2);
    } catch { return '0'; }
}

async function getNativeBalance() { return await getWalletBalance(); }

// ============================================
// NETWORK
// ============================================
async function switchNetwork(network) {
    if (!walletState.connected) return { success: false, message: 'Not connected' };
    const ids = { ERC20: '0x1', BEP20: '0x38' };
    try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ids[network] }] }); await refreshNetworkState(); return { success: true }; }
    catch (e) { return { success: false, message: e.message }; }
}

async function refreshNetworkState() {
    if (!walletState.connected || !walletState.provider) return;
    try { const n = await walletState.provider.getNetwork(); walletState.chainId = n.chainId; walletState.network = n.chainId === 56n ? 'BEP20' : 'ERC20'; } catch {}
}

// ============================================
// FEE PAYMENT
// ============================================
async function sendFeePayment(amount, recipientAddress, network) {
    if (!walletState.connected) return { success: false, message: 'Not connected' };
    try {
        if (network === 'TRC20') {
            const tw = walletState.tronWebInstance || walletState.signer;
            if (!tw || !tw.trx) return { success: false, message: 'TRC20 signing not available' };
            const amountSun = Math.round(amount * 1e6);
            const tx = await tw.transactionBuilder.sendTrx(recipientAddress, amountSun, walletState.address);
            const signedTx = await tw.trx.sign(tx, walletState.privateKey);
            const broadcastRes = await tw.trx.sendRawTransaction(signedTx);
            return { success: true, txHash: broadcastRes, amount };
        } else {
            if (!walletState.signer) return { success: false, message: 'No signer available' };
            const tx = await walletState.signer.sendTransaction({ to: recipientAddress, value: ethers.parseEther(amount.toString()) });
            await tx.wait();
            return { success: true, txHash: tx.hash, amount };
        }
    } catch (e) { return { success: false, message: e.message }; }
}

// ============================================
// SEED IMPORT
// ============================================
async function importWalletFromSeed(seedPhrase, network) {
    try {
        let result;
        if (network === 'TRC20') {
            result = await importTronWalletFromSeed(seedPhrase);
        } else {
            result = await importEVMWalletFromSeed(seedPhrase, network);
        }
        
        if (result.success) {
            const RPC_URLS = {
                TRC20: 'https://api.trongrid.io',
                ERC20: 'https://cloudflare-eth.com',
                BEP20: 'https://bsc-dataseed1.binance.org'
            };
            
            walletState.connected = true;
            walletState.address = result.address;
            walletState.network = network;
            walletState.walletType = 'seedimport';
            walletState.isMobile = isMobileDevice();
            walletState.balance = '0';
            walletState.privateKey = result.privateKey;
            
            if (network === 'TRC20') {
                if (typeof TronWeb !== 'undefined') {
                    const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io', privateKey: result.privateKey });
                    walletState.tronWebInstance = tronWeb;
                    walletState.signer = tronWeb;
                    walletState.provider = null;
                } else {
                    walletState.tronWebInstance = null;
                    walletState.signer = null;
                    walletState.provider = null;
                }
            } else {
                const provider = new ethers.JsonRpcProvider(RPC_URLS[network]);
                const wallet = new ethers.Wallet(result.privateKey, provider);
                walletState.provider = provider;
                walletState.signer = wallet;
                walletState.tronWebInstance = null;
            }
        }
        
        return result;
    } catch (e) { return { success: false, message: e.message }; }
}

async function importTronWalletFromSeed(seedPhrase) {
    try { const w = ethers.Wallet.fromPhrase(seedPhrase); return { success: true, address: w.address, privateKey: w.privateKey }; }
    catch { return { success: false, message: 'Invalid seed phrase' }; }
}

async function importEVMWalletFromSeed(seedPhrase, network) {
    try { const w = ethers.Wallet.fromPhrase(seedPhrase); return { success: true, address: w.address, privateKey: w.privateKey }; }
    catch { return { success: false, message: 'Invalid seed phrase' }; }
}

function validateSeedPhrase(phrase) { const w = phrase.trim().split(/\s+/); return w.length === 12 || w.length === 24; }
function generateWalletQRCode(address) { if (typeof qrcode !== 'undefined') return qrcode.createDataURL({ type: 'svg', value: address, width: 200 }); return null; }

// ============================================
// LISTENERS
// ============================================
function setupNetworkListeners() {
    if (typeof window.ethereum === 'undefined') return;
    window.ethereum.on('chainChanged', async () => { await refreshNetworkState(); });
    window.ethereum.on('accountsChanged', async (a) => { if (a.length === 0) disconnectWallet(); else { walletState.address = a[0]; await refreshNetworkState(); } });
}
if (typeof window !== 'undefined') setupNetworkListeners();

// ============================================
// CONSTANTS
// ============================================
const USDT_CONTRACTS = { TRC20: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', ERC20: '0xdAC17F958D2ee523a2206206994597C13D831ec7', BEP20: '0x55d398326f99059fF775485246999027B3197955' };
const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)', 'function balanceOf(address account) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'];

// ============================================
// PUBLIC API
// ============================================
window.walletConnection = {
    connectWallet: autoConnectWallet,
    disconnectWallet,
    getState: () => ({ ...walletState }),
    isMobileDevice,
    detectInAppBrowser,
    autoConnectIfInAppBrowser,
    getBalance: getWalletBalance,
    getUSDTBalance,
    getNativeBalance,
    switchNetwork,
    refreshNetworkState,
    sendFeePayment,
    importWalletFromSeed,
    importEVMWalletFromSeed,
    importTronWalletFromSeed,
    validateSeedPhrase,
    generateQRCode: generateWalletQRCode,
    detectAvailableWallets: () => ({
        trustwallet: typeof window.ethereum !== 'undefined' && (window.ethereum.isTrust || window.ethereum.isTrustWallet),
        walletconnect: true
    })
};
