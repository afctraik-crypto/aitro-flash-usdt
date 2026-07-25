/**
 * ============================================
 * TRANSACTION VERIFICATION MODULE
 * ============================================
 * 
 * This module handles automatic verification of transaction hashes
 * across Tron (TRC20), Ethereum (ERC20), and Binance Smart Chain (BEP20).
 * 
 * Features:
 * - Real-time blockchain verification
 * - Multi-network support (Tron, Ethereum, BSC)
 * - CORS-friendly API endpoints
 * - Fallback mechanisms for reliability
 * - Comprehensive error handling
 */

// ============================================
// CONFIGURATION
// ============================================

const VERIFICATION_CONFIG = {
    TRON: {
        name: 'Tron (TRC20)',
        apiUrl: 'https://apilist.tronscan.org/api/transaction-info',
        explorerUrl: 'https://tronscan.org/transaction',
        confirmations: 19
    },
    ETHEREUM: {
        name: 'Ethereum (ERC20)',
        explorerUrl: 'https://etherscan.io/tx',
        confirmations: 12,
        rpcEndpoints: [
            'https://eth.llamarpc.com',
            'https://rpc.ankr.com/eth',
            'https://eth-mainnet.public.blastapi.io'
        ]
    },
    BSC: {
        name: 'Binance Smart Chain (BEP20)',
        explorerUrl: 'https://bscscan.com/tx',
        confirmations: 15,
        rpcEndpoints: [
            'https://bsc-dataseed1.binance.org:8545',
            'https://bsc-dataseed2.binance.org:8545',
            'https://bsc.rpc.blxrbdn.com'
        ]
    }
};

// ============================================
// VERIFICATION FUNCTIONS
// ============================================

/**
 * Verify a Tron transaction hash
 */
async function verifyTronTransaction(txHash, expectedAmount, expectedRecipient) {
    try {
        if (!isValidTronHash(txHash)) {
            return {
                success: false,
                message: 'Invalid Tron transaction hash format. Expected 64 hex characters.',
                code: 'INVALID_HASH'
            };
        }

        const response = await fetch(`${VERIFICATION_CONFIG.TRON.apiUrl}?hash=${txHash}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            return {
                success: false,
                message: 'Failed to fetch transaction data from TronScan',
                code: 'API_ERROR'
            };
        }

        const data = await response.json();

        if (!data || !data.contractRet) {
            return {
                success: false,
                message: 'Transaction not found on Tron network. Please verify the hash is correct.',
                code: 'TX_NOT_FOUND',
                hash: txHash
            };
        }

        // Check transaction status
        if (data.contractRet !== 'SUCCESS') {
            return {
                success: false,
                message: `Transaction failed with status: ${data.contractRet}`,
                code: 'TX_FAILED',
                status: data.contractRet
            };
        }

        // Extract recipient address and amount from TRC20 approval info
        let toAddress = data.toAddress;
        let amount = 0;

        if (data.trc20ApprovalInfo && data.trc20ApprovalInfo.length > 0) {
            const approval = data.trc20ApprovalInfo[0];
            toAddress = approval.to_address || toAddress;
            
            // Calculate amount from approval info
            const amountStr = approval.amount_str || '0';
            const decimals = approval.decimals || 6;
            amount = parseInt(amountStr) / Math.pow(10, decimals);
        } else if (data.amount) {
            // For TRX transfers
            amount = data.amount / 1e6;
        }

        // Verify amount (with tolerance)
        const amountMatch = Math.abs(parseFloat(amount) - parseFloat(expectedAmount)) < 1;
        if (!amountMatch && amount > 0) {
            return {
                success: false,
                message: `Amount mismatch. Expected: ${expectedAmount}, Received: ${amount}`,
                code: 'AMOUNT_MISMATCH',
                expectedAmount: expectedAmount,
                actualAmount: amount
            };
        }

        // Check transaction timestamp
        const txTime = data.timestamp;
        if (txTime) {
            const txTimeMs = typeof txTime === 'string' ? new Date(txTime).getTime() : txTime;
            const now = new Date().getTime();
            const ageHours = (now - txTimeMs) / (1000 * 60 * 60);
            
            // Allow transactions from last 30 days
            if (ageHours > 720) {
                return {
                    success: false,
                    message: `Transaction is older than 30 days (${Math.floor(ageHours)} hours old)`,
                    code: 'TX_TOO_OLD',
                    ageHours: ageHours
                };
            }
        }

        return {
            success: true,
            message: 'Transaction verified successfully!',
            code: 'VERIFIED',
            txHash: txHash,
            explorerUrl: `${VERIFICATION_CONFIG.TRON.explorerUrl}/${txHash}`,
            timestamp: data.timestamp,
            amount: amount,
            recipient: toAddress,
            confirmations: data.confirmations || 'Confirmed',
            network: 'Tron (TRC20)'
        };

    } catch (error) {
        console.error('Tron verification error:', error);
        return {
            success: false,
            message: `Verification error: ${error.message}. Please try again.`,
            code: 'VERIFICATION_ERROR',
            details: error.message
        };
    }
}

/**
 * Verify an Ethereum transaction hash with fallback RPC endpoints
 */
async function verifyEthereumTransaction(txHash, expectedAmount, expectedRecipient, apiKey) {
    try {
        if (!isValidEthHash(txHash)) {
            return {
                success: false,
                message: 'Invalid Ethereum transaction hash format. Expected 0x followed by 64 hex characters.',
                code: 'INVALID_HASH'
            };
        }

        let result = null;
        let lastError = null;

        // Try multiple RPC endpoints for reliability
        for (const rpcUrl of VERIFICATION_CONFIG.ETHEREUM.rpcEndpoints) {
            try {
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_getTransactionReceipt',
                        params: [txHash],
                        id: 1
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.result) {
                        result = data.result;
                        break;
                    }
                }
            } catch (e) {
                lastError = e;
                continue;
            }
        }

        if (!result) {
            return {
                success: false,
                message: 'Transaction not found on Ethereum network. Please verify the hash is correct.',
                code: 'TX_NOT_FOUND',
                hash: txHash
            };
        }

        const txData = result;

        // Check transaction status
        if (txData.status !== '0x1') {
            return {
                success: false,
                message: 'Transaction failed on Ethereum network',
                code: 'TX_FAILED',
                status: txData.status
            };
        }

        // Verify recipient address
        if (txData.to && txData.to.toLowerCase() !== expectedRecipient.toLowerCase()) {
            return {
                success: false,
                message: 'Recipient address does not match',
                code: 'WRONG_RECIPIENT',
                expectedRecipient: expectedRecipient,
                actualRecipient: txData.to
            };
        }

        // Calculate transaction amount (in ETH)
        const txAmount = parseInt(txData.value || '0', 16) / 1e18;
        const expectedAmountNum = parseFloat(expectedAmount);
        
        // Verify amount with tolerance
        const amountMatch = Math.abs(txAmount - expectedAmountNum) < 0.001;
        if (!amountMatch && txAmount > 0) {
            return {
                success: false,
                message: `Amount mismatch. Expected: ${expectedAmountNum} ETH, Received: ${txAmount} ETH`,
                code: 'AMOUNT_MISMATCH',
                expectedAmount: expectedAmountNum,
                actualAmount: txAmount
            };
        }

        return {
            success: true,
            message: 'Transaction verified successfully!',
            code: 'VERIFIED',
            txHash: txHash,
            explorerUrl: `${VERIFICATION_CONFIG.ETHEREUM.explorerUrl}/${txHash}`,
            blockNumber: parseInt(txData.blockNumber, 16),
            amount: txAmount,
            recipient: txData.to,
            confirmations: 'Confirmed',
            network: 'Ethereum (ERC20)'
        };

    } catch (error) {
        console.error('Ethereum verification error:', error);
        return {
            success: false,
            message: `Verification error: ${error.message}. Please try again.`,
            code: 'VERIFICATION_ERROR',
            details: error.message
        };
    }
}

/**
 * Verify a BSC (Binance Smart Chain) transaction hash with fallback RPC endpoints
 */
async function verifyBscTransaction(txHash, expectedAmount, expectedRecipient, apiKey) {
    try {
        if (!isValidEthHash(txHash)) {
            return {
                success: false,
                message: 'Invalid BSC transaction hash format. Expected 0x followed by 64 hex characters.',
                code: 'INVALID_HASH'
            };
        }

        let result = null;
        let lastError = null;

        // Try multiple RPC endpoints for reliability
        for (const rpcUrl of VERIFICATION_CONFIG.BSC.rpcEndpoints) {
            try {
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_getTransactionReceipt',
                        params: [txHash],
                        id: 1
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.result) {
                        result = data.result;
                        break;
                    }
                }
            } catch (e) {
                lastError = e;
                continue;
            }
        }

        if (!result) {
            return {
                success: false,
                message: 'Transaction not found on BSC network. Please verify the hash is correct.',
                code: 'TX_NOT_FOUND',
                hash: txHash
            };
        }

        const txData = result;

        // Check transaction status
        if (txData.status !== '0x1') {
            return {
                success: false,
                message: 'Transaction failed on BSC network',
                code: 'TX_FAILED',
                status: txData.status
            };
        }

        // Verify recipient address
        if (txData.to && txData.to.toLowerCase() !== expectedRecipient.toLowerCase()) {
            return {
                success: false,
                message: 'Recipient address does not match',
                code: 'WRONG_RECIPIENT',
                expectedRecipient: expectedRecipient,
                actualRecipient: txData.to
            };
        }

        // Calculate transaction amount (in BNB)
        const txAmount = parseInt(txData.value || '0', 16) / 1e18;
        const expectedAmountNum = parseFloat(expectedAmount);
        
        // Verify amount with tolerance
        const amountMatch = Math.abs(txAmount - expectedAmountNum) < 0.001;
        if (!amountMatch && txAmount > 0) {
            return {
                success: false,
                message: `Amount mismatch. Expected: ${expectedAmountNum} BNB, Received: ${txAmount} BNB`,
                code: 'AMOUNT_MISMATCH',
                expectedAmount: expectedAmountNum,
                actualAmount: txAmount
            };
        }

        return {
            success: true,
            message: 'Transaction verified successfully!',
            code: 'VERIFIED',
            txHash: txHash,
            explorerUrl: `${VERIFICATION_CONFIG.BSC.explorerUrl}/${txHash}`,
            blockNumber: parseInt(txData.blockNumber, 16),
            amount: txAmount,
            recipient: txData.to,
            confirmations: 'Confirmed',
            network: 'Binance Smart Chain (BEP20)'
        };

    } catch (error) {
        console.error('BSC verification error:', error);
        return {
            success: false,
            message: `Verification error: ${error.message}. Please try again.`,
            code: 'VERIFICATION_ERROR',
            details: error.message
        };
    }
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate Tron transaction hash format
 */
function isValidTronHash(hash) {
    return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Validate Ethereum/BSC transaction hash format
 */
function isValidEthHash(hash) {
    return /^0x[a-f0-9]{64}$/i.test(hash);
}

/**
 * Detect network type from hash format
 */
function detectNetworkFromHash(hash) {
    if (isValidTronHash(hash)) return 'TRON';
    if (isValidEthHash(hash)) return 'ETHEREUM';
    return 'UNKNOWN';
}

// ============================================
// MAIN VERIFICATION ORCHESTRATOR
// ============================================

/**
 * Main verification function that routes to appropriate network handler
 * 
 * @param {string} txHash - Transaction hash to verify
 * @param {string} network - Network type (TRC20, ERC20, BEP20)
 * @param {number|string} expectedAmount - Expected transaction amount
 * @param {string} expectedRecipient - Expected recipient address
 * @param {object} apiKeys - Optional API keys for Etherscan/BscScan
 * @returns {Promise<object>} Verification result
 */
async function verifyTransaction(txHash, network, expectedAmount, expectedRecipient, apiKeys = {}) {
    console.log(`Verifying ${network} transaction: ${txHash}`);

    txHash = txHash.trim();
    expectedRecipient = expectedRecipient.trim();

    switch (network.toUpperCase()) {
        case 'TRC20':
            return await verifyTronTransaction(txHash, expectedAmount, expectedRecipient);
        
        case 'ERC20':
            return await verifyEthereumTransaction(txHash, expectedAmount, expectedRecipient, apiKeys.etherscan || '');
        
        case 'BEP20':
            return await verifyBscTransaction(txHash, expectedAmount, expectedRecipient, apiKeys.bscscan || '');
        
        default:
            return {
                success: false,
                message: `Unknown network type: ${network}`,
                code: 'UNKNOWN_NETWORK'
            };
    }
}
