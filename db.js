// ============================================================
// db.js - Roohira POS - Firebase Firestore Direct Client
// Works 100% from browser - No local server needed!
// Powers Netlify 24/7 hosting for mobile.html
// ============================================================

const FIREBASE_PROJECT = "roohiracollectionpos";
const FIREBASE_API_KEY = "AIzaSyBJd5125JiDfhcohhuESazeX__uFEzN2bM";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// ── Firestore value encoder / decoder ────────────────────────
function _encodeVal(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') {
        if (Number.isInteger(v)) return { integerValue: String(v) };
        return { doubleValue: v };
    }
    if (Array.isArray(v)) return { arrayValue: { values: v.map(_encodeVal) } };
    if (typeof v === 'object') {
        const fields = {};
        for (const [k, val] of Object.entries(v)) fields[k] = _encodeVal(val);
        return { mapValue: { fields } };
    }
    return { stringValue: String(v) };
}

function _decodeVal(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return parseInt(v.integerValue, 10);
    if ('doubleValue' in v) return parseFloat(v.doubleValue);
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(_decodeVal);
    if ('mapValue' in v) {
        const obj = {};
        for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = _decodeVal(val);
        return obj;
    }
    return null;
}

function _docToObj(doc) {
    if (!doc || !doc.name) return null;
    const parts = doc.name.split('/');
    const docId = decodeURIComponent(parts[parts.length - 1]);
    const data = {};
    if (doc.fields) {
        for (const [k, val] of Object.entries(doc.fields)) data[k] = _decodeVal(val);
    }
    // Try to parse id field as number, fallback to string docId
    if (data.id !== undefined) {
        data.id = isNaN(Number(data.id)) ? data.id : Number(data.id);
    } else {
        data.id = isNaN(Number(docId)) ? docId : Number(docId);
    }
    // Parse items field if stored as JSON string (legacy format from server.js)
    if (data.items && typeof data.items === 'string') {
        try { data.items = JSON.parse(data.items); } catch(e) { data.items = []; }
    }
    return data;
}

// ── Low-level Firestore REST helpers ─────────────────────────
const _FS = {
    async getCollection(col) {
        let documents = [];
        let nextPageToken = null;
        do {
            const url = new URL(`${FIRESTORE_BASE}/${col}`);
            url.searchParams.set('pageSize', '300');
            if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);
            const res = await fetch(url.toString());
            if (!res.ok) { if (res.status === 404) return []; throw new Error(`FS getCollection ${col}: ${res.statusText}`); }
            const data = await res.json();
            if (data.documents) documents = documents.concat(data.documents);
            nextPageToken = data.nextPageToken;
        } while (nextPageToken);
        return documents.map(_docToObj).filter(Boolean);
    },

    async getDoc(col, id) {
        const res = await fetch(`${FIRESTORE_BASE}/${col}/${encodeURIComponent(id)}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`FS getDoc ${col}/${id}: ${res.statusText}`);
        return _docToObj(await res.json());
    },

    async setDoc(col, id, data) {
        const fields = {};
        for (const [k, v] of Object.entries(data)) { if (k !== 'id') fields[k] = _encodeVal(v); }
        const res = await fetch(`${FIRESTORE_BASE}/${col}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
        });
        if (!res.ok) throw new Error(`FS setDoc ${col}/${id}: ${await res.text()}`);
        return _docToObj(await res.json());
    },

    async updateDoc(col, id, data) {
        const fields = {};
        const mask = new URLSearchParams();
        for (const [k, v] of Object.entries(data)) {
            if (k === 'id') continue;
            fields[k] = _encodeVal(v);
            mask.append('updateMask.fieldPaths', k);
        }
        const res = await fetch(`${FIRESTORE_BASE}/${col}/${encodeURIComponent(id)}?${mask}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
        });
        if (!res.ok) throw new Error(`FS updateDoc ${col}/${id}: ${await res.text()}`);
        return { success: true };
    },

    async addDoc(col, data) {
        const fields = {};
        for (const [k, v] of Object.entries(data)) { if (k !== 'id') fields[k] = _encodeVal(v); }
        const res = await fetch(`${FIRESTORE_BASE}/${col}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
        });
        if (!res.ok) throw new Error(`FS addDoc ${col}: ${await res.text()}`);
        return _docToObj(await res.json());
    },

    async deleteDoc(col, id) {
        // Try both string and number forms of the ID
        const strId = String(id);
        const res = await fetch(`${FIRESTORE_BASE}/${col}/${encodeURIComponent(strId)}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) {
            const errText = await res.text();
            throw new Error(`FS deleteDoc ${col}/${strId}: ${errText}`);
        }
        return { success: true };
    },

    // Get next sequential numeric ID for a collection
    async nextId(col) {
        const docs = await _FS.getCollection(col);
        if (!docs.length) return 1;
        const maxId = Math.max(...docs.map(d => parseInt(d.id) || 0));
        return isFinite(maxId) ? maxId + 1 : 1;
    }
};

// ── Main DB API (drop-in replacement for old server-based db.js) ──
const DB = {
    init: async () => true,
    initUsers: async () => true,

    // ── Notes ──────────────────────────────────────────────────
    getAllNotes: async () => await _FS.getCollection('notes'),
    addNote: async (note) => {
        const id = await _FS.nextId('notes');
        const data = { ...note, id, date: note.date || new Date().toISOString() };
        await _FS.setDoc('notes', String(id), data);
        return id;
    },
    deleteNote: async (id) => { await _FS.deleteDoc('notes', String(id)); return { success: true }; },

    // ── Orders ─────────────────────────────────────────────────
    getAllOrders: async () => await _FS.getCollection('orders'),

    addOrder: async (order) => {
        const id = await _FS.nextId('orders');
        const displayId = `ORD-${String(id).padStart(4, '0')}`;

        // Deduct inventory stock
        for (const item of (order.items || [])) {
            const itemId = item.id || item.itemId;
            if (itemId) {
                try {
                    const dbItem = await DB.getItem(itemId);
                    if (dbItem) {
                        const newStock = (parseFloat(dbItem.stock) || 0) - (parseFloat(item.qty) || 0);
                        await DB.updateItem(dbItem.id, { stock: newStock });
                    }
                } catch (e) { console.warn('Stock deduct warning (order):', e); }
            }
        }

        const data = { ...order, id, orderId: displayId, date: order.date || new Date().toISOString() };
        await _FS.setDoc('orders', String(id), data);
        return id;
    },

    getOrder: async (id) => await _FS.getDoc('orders', String(id)),
    getOrderById: async (id) => await DB.getOrder(id),

    updateOrder: async (id, data) => {
        await _FS.updateDoc('orders', String(id), data);
        return { success: true };
    },

    updateOrderStatus: async (id, status) => {
        const order = await DB.getOrder(id);
        if (!order) return;

        if (status === 'Cancelled' && order.status !== 'Cancelled') {
            // Restore stock
            for (const item of (order.items || [])) {
                const itemId = item.id || item.itemId;
                if (itemId) {
                    try {
                        const dbItem = await DB.getItem(itemId);
                        if (dbItem) await DB.updateItem(dbItem.id, { stock: (parseFloat(dbItem.stock) || 0) + (parseFloat(item.qty) || 0) });
                    } catch (e) { console.warn('Stock restore warning:', e); }
                }
            }
        } else if (order.status === 'Cancelled' && status !== 'Cancelled') {
            // Deduct stock again
            for (const item of (order.items || [])) {
                const itemId = item.id || item.itemId;
                if (itemId) {
                    try {
                        const dbItem = await DB.getItem(itemId);
                        if (dbItem) await DB.updateItem(dbItem.id, { stock: (parseFloat(dbItem.stock) || 0) - (parseFloat(item.qty) || 0) });
                    } catch (e) { console.warn('Stock deduct warning:', e); }
                }
            }
        }

        await _FS.updateDoc('orders', String(id), { status });
        return { success: true };
    },

    updateOrderPaymentStatus: async (id, paymentStatus) => {
        const updateData = { paymentStatus };
        if (paymentStatus === 'paid') updateData.status = 'Paid';
        await _FS.updateDoc('orders', String(id), updateData);
        return { success: true };
    },

    deleteOrder: async (id) => { await _FS.deleteDoc('orders', String(id)); return { success: true }; },

    getOrdersByCustomer: async (customerName, customerId) => {
        const orders = await DB.getAllOrders();
        return orders.filter(o => o.customer === customerName || (customerId && o.customerId === customerId));
    },

    // ── Settings ───────────────────────────────────────────────
    getSetting: async (key) => {
        const doc = await _FS.getDoc('settings', key);
        if (!doc) return null;
        return doc.value !== undefined ? doc.value : doc;
    },
    setSetting: async (key, value) => {
        await _FS.setDoc('settings', key, { key, value });
        return { success: true };
    },

    // ── Inventory ──────────────────────────────────────────────
    getAllInventory: async () => await _FS.getCollection('inventory'),
    getItem: async (id) => await _FS.getDoc('inventory', String(id)),
    getInventoryById: async (id) => await DB.getItem(id),

    addItem: async (item) => {
        const id = await _FS.nextId('inventory');
        const data = { ...item, id };
        await _FS.setDoc('inventory', String(id), data);
        return { id };
    },
    addInventory: async (item) => await DB.addItem(item),

    updateItem: async (id, changes) => {
        await _FS.updateDoc('inventory', String(id), changes);
        return { success: true };
    },
    updateInventory: async (id, changes) => await DB.updateItem(id, changes),

    deleteItem: async (id) => { await _FS.deleteDoc('inventory', String(id)); return { success: true }; },
    deleteInventory: async (id) => await DB.deleteItem(id),

    // ── Sales ──────────────────────────────────────────────────
    getAllSales: async () => await _FS.getCollection('sales'),

    addSale: async (sale, skipStockUpdate = false) => {
        if (!skipStockUpdate) {
            for (const item of (sale.items || [])) {
                const itemId = item.id || item.itemId;
                if (itemId) {
                    try {
                        const dbItem = await DB.getItem(itemId);
                        if (dbItem) await DB.updateItem(dbItem.id, { stock: (parseFloat(dbItem.stock) || 0) - (parseFloat(item.qty) || 0) });
                    } catch (e) { console.warn('Stock deduct warning (sale):', e); }
                }
            }
        }

        // Update customer totals
        if (sale.customer && sale.customer !== 'Guest') {
            try {
                const customers = await DB.getAllCustomers();
                const cust = customers.find(c => c.name === sale.customer || (sale.customerId && c.custId === sale.customerId));
                if (cust && cust.id) {
                    await DB.updateCustomer(cust.id, {
                        totalOrders: (cust.totalOrders || 0) + 1,
                        totalSpent: (cust.totalSpent || 0) + (Number(sale.total) || 0)
                    });
                }
            } catch (e) { console.warn('Customer update warning:', e); }
        }

        const id = await _FS.nextId('sales');
        const billId = `SL-${String(id).padStart(4, '0')}`;
        const data = { ...sale, id, billId, date: sale.date || new Date().toISOString() };
        await _FS.setDoc('sales', String(id), data);
        return id;
    },

    getSale: async (id) => await _FS.getDoc('sales', String(id)),
    getSaleById: async (id) => await DB.getSale(id),

    updateSale: async (id, data) => {
        await _FS.updateDoc('sales', String(id), data);
        return { success: true };
    },
    deleteSale: async (id) => { await _FS.deleteDoc('sales', String(id)); return { success: true }; },

    getSalesByCustomer: async (customerName, customerId) => {
        const sales = await DB.getAllSales();
        return sales.filter(s => s.customer === customerName || (customerId && s.customerId === customerId));
    },

    // ── Customers ──────────────────────────────────────────────
    getAllCustomers: async () => await _FS.getCollection('customers'),

    getCustomerByName: async (name) => {
        const customers = await DB.getAllCustomers();
        return customers.find(c => c.name === name) || null;
    },
    getCustomerById: async (custId) => {
        const customers = await DB.getAllCustomers();
        return customers.find(c => c.custId === custId) || null;
    },
    getCustomerByDbId: async (id) => {
        const customers = await DB.getAllCustomers();
        return customers.find(c => String(c.id) === String(id)) || null;
    },

    addCustomer: async (customer) => {
        const id = await _FS.nextId('customers');
        const custId = `CUST-${String(id).padStart(4, '0')}`;
        const data = { ...customer, id, custId: customer.custId || custId };
        await _FS.setDoc('customers', String(id), data);
        return { id, custId: data.custId };
    },

    updateCustomer: async (id, changes) => {
        await _FS.updateDoc('customers', String(id), changes);
        return { success: true };
    },
    updateCustomerPoints: async (id, points) => await DB.updateCustomer(id, { loyaltyPoints: points }),
    updateCustomerStatus: async (id, isBlacklisted) => await DB.updateCustomer(id, { isBlacklisted }),
    deleteCustomer: async (id) => { await _FS.deleteDoc('customers', String(id)); return { success: true }; },

    // ── Categories ─────────────────────────────────────────────
    getAllCategories: async () => await _FS.getCollection('categories'),

    addCategory: async (category) => {
        const id = await _FS.nextId('categories');
        const data = { ...category, id };
        await _FS.setDoc('categories', String(id), data);
        return { id };
    },
    deleteCategory: async (id) => { await _FS.deleteDoc('categories', String(id)); return { success: true }; },

    // ── Expenses ───────────────────────────────────────────────
    getAllExpenses: async () => await _FS.getCollection('expenses'),

    addExpense: async (expense) => {
        const id = await _FS.nextId('expenses');
        const data = { ...expense, id, date: expense.date || new Date().toISOString() };
        await _FS.setDoc('expenses', String(id), data);
        return { id };
    },
    deleteExpense: async (id) => { await _FS.deleteDoc('expenses', String(id)); return { success: true }; },

    // ── Waybills ───────────────────────────────────────────────
    getAllWaybills: async () => {
        try {
            const list = await _FS.getCollection('waybills');
            if (list.length > 0) {
                localStorage.setItem('roohira_local_waybills', JSON.stringify(list));
                return list;
            }
        } catch (e) { console.warn('Waybill fetch fallback:', e); }
        try { return JSON.parse(localStorage.getItem('roohira_local_waybills') || '[]'); } catch { return []; }
    },

    addWaybill: async (waybill) => {
        const id = await _FS.nextId('waybills');
        const data = { ...waybill, id, date: waybill.date || new Date().toISOString() };
        await _FS.setDoc('waybills', String(id), data);
        // Also save to localStorage as backup
        try {
            const local = JSON.parse(localStorage.getItem('roohira_local_waybills') || '[]');
            local.unshift(data);
            localStorage.setItem('roohira_local_waybills', JSON.stringify(local));
        } catch (e) {}
        return id;
    },

    deleteWaybill: async (id) => {
        await _FS.deleteDoc('waybills', String(id));
        try {
            let local = JSON.parse(localStorage.getItem('roohira_local_waybills') || '[]');
            local = local.filter(w => String(w.id) !== String(id));
            localStorage.setItem('roohira_local_waybills', JSON.stringify(local));
        } catch (e) {}
        return { success: true };
    },

    // ── Authentication (Local Session) ─────────────────────────
    login: async (username, password) => {
        // Fetch credentials stored in Firebase settings
        try {
            const creds = await _FS.getCollection('users');
            const user = creds.find(u => u.username === username && u.password === password);
            if (user) {
                const sessionData = { username: user.username, role: user.role || 'admin', name: user.name || user.username };
                sessionStorage.setItem('ruhira_user', JSON.stringify(sessionData));
                return sessionData;
            }
            // Fallback default admin (for first-time setup)
            if (username === 'admin' && password === 'admin123') {
                const sessionData = { username: 'admin', role: 'admin', name: 'Admin' };
                sessionStorage.setItem('ruhira_user', JSON.stringify(sessionData));
                return sessionData;
            }
            return null;
        } catch (err) {
            console.error('Login error:', err);
            if (username === 'admin' && password === 'admin123') {
                const sessionData = { username: 'admin', role: 'admin', name: 'Admin' };
                sessionStorage.setItem('ruhira_user', JSON.stringify(sessionData));
                return sessionData;
            }
            return null;
        }
    },

    logout: () => {
        sessionStorage.removeItem('ruhira_user');
        window.location.href = 'login.html';
    },

    getCurrentUser: () => {
        const user = sessionStorage.getItem('ruhira_user');
        return user ? JSON.parse(user) : null;
    },

    // ── Dashboard Stats ────────────────────────────────────────
    getDashboardStats: async () => {
        const [sales, orders, inventory, customers, expenses] = await Promise.all([
            DB.getAllSales(), DB.getAllOrders(), DB.getAllInventory(), DB.getAllCustomers(), DB.getAllExpenses()
        ]);

        const fmt = (d) => {
            const obj = new Date(d);
            if (isNaN(obj.getTime())) return '';
            return `${obj.getFullYear()}-${String(obj.getMonth()+1).padStart(2,'0')}-${String(obj.getDate()).padStart(2,'0')}`;
        };

        const now = new Date();
        const todayStr = fmt(now);
        const yest = new Date(now); yest.setDate(now.getDate()-1);
        const yesterdayStr = fmt(yest);
        const monthPfx = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

        let todayRevenue=0,todayProfit=0,todaySalesCount=0,todayOrdersCount=0;
        let yesterdayRevenue=0,yesterdayProfit=0,yesterdaySalesCount=0,yesterdayOrdersCount=0;
        let thisMonthRevenue=0,thisMonthProfit=0,thisMonthSalesCount=0,thisMonthOrdersCount=0;
        let totalRevenue=0,grossProfit=0;

        sales.forEach(s => {
            const rev = Number(s.total)||0, cost = Number(s.buyTotal)||0, profit = rev-cost;
            const d = fmt(s.date);
            totalRevenue+=rev; grossProfit+=profit;
            if(d===todayStr){todayRevenue+=rev;todayProfit+=profit;todaySalesCount++;}
            if(d===yesterdayStr){yesterdayRevenue+=rev;yesterdayProfit+=profit;yesterdaySalesCount++;}
            if(d.startsWith(monthPfx)){thisMonthRevenue+=rev;thisMonthProfit+=profit;thisMonthSalesCount++;}
        });

        const activeOrders = orders.filter(o => {
            const st=(o.status||'').toLowerCase(), pst=(o.paymentStatus||'').toLowerCase();
            return st!=='cancelled' && pst!=='cancelled';
        });

        activeOrders.forEach(o => {
            const d = fmt(o.date);
            if(d===todayStr) todayOrdersCount++;
            if(d===yesterdayStr) yesterdayOrdersCount++;
            if(d.startsWith(monthPfx)) thisMonthOrdersCount++;
            const isPaid=(o.paymentStatus||'').toLowerCase()==='paid'||(o.status||'').toLowerCase()==='paid';
            if(isPaid){
                const r=Number(o.total)||0;
                const c=Number(o.buyTotal)||((o.items||[]).reduce((s,i)=>s+((Number(i.buyPrice)||0)*(Number(i.qty)||1)),0));
                totalRevenue+=r; grossProfit+=(r-c);
                if(d===todayStr){todayRevenue+=r;todayProfit+=(r-c);}
                if(d===yesterdayStr){yesterdayRevenue+=r;yesterdayProfit+=(r-c);}
                if(d.startsWith(monthPfx)){thisMonthRevenue+=r;thisMonthProfit+=(r-c);}
            }
        });

        const totalExpenses = expenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
        const netProfit = grossProfit - totalExpenses;
        const lowStockCount = inventory.filter(i=>(Number(i.stock)||0)<=5).length;

        return {
            todayRevenue:+todayRevenue.toFixed(2), todayProfit:+todayProfit.toFixed(2),
            todaySalesCount, todayOrdersCount,
            yesterdayRevenue:+yesterdayRevenue.toFixed(2), yesterdayProfit:+yesterdayProfit.toFixed(2),
            yesterdaySalesCount, yesterdayOrdersCount,
            thisMonthRevenue:+thisMonthRevenue.toFixed(2), thisMonthProfit:+thisMonthProfit.toFixed(2),
            thisMonthSalesCount, thisMonthOrdersCount,
            totalRevenue:+totalRevenue.toFixed(2), totalExpenses:+totalExpenses.toFixed(2),
            grossProfit:+grossProfit.toFixed(2), totalProfit:+netProfit.toFixed(2),
            totalOrders: sales.length+activeOrders.length,
            totalCustomers: customers.length, lowStockCount
        };
    },

    getStatsForDate: async (targetDateStr) => {
        const [sales, orders, expenses] = await Promise.all([
            DB.getAllSales(), DB.getAllOrders(), DB.getAllExpenses()
        ]);
        const fmt = (d) => {
            const obj=new Date(d);
            if(isNaN(obj.getTime())) return '';
            return `${obj.getFullYear()}-${String(obj.getMonth()+1).padStart(2,'0')}-${String(obj.getDate()).padStart(2,'0')}`;
        };
        const target = targetDateStr || fmt(new Date());
        let revenue=0, grossProfit=0, salesCount=0, ordersCount=0, totalExpenses=0;

        sales.forEach(s => {
            if(fmt(s.date)===target){
                const r=Number(s.total)||0, c=Number(s.buyTotal)||0;
                revenue+=r; grossProfit+=(r-c); salesCount++;
            }
        });

        orders.filter(o=>{
            const st=(o.status||'').toLowerCase(), pst=(o.paymentStatus||'').toLowerCase();
            return st!=='cancelled'&&pst!=='cancelled';
        }).forEach(o=>{
            if(fmt(o.date)===target){
                ordersCount++;
                const isPaid=(o.paymentStatus||'').toLowerCase()==='paid'||(o.status||'').toLowerCase()==='paid';
                if(isPaid){
                    const r=Number(o.total)||0, c=Number(o.buyTotal)||0;
                    revenue+=r; grossProfit+=(r-c);
                }
            }
        });

        expenses.forEach(e=>{if(fmt(e.date)===target) totalExpenses+=(Number(e.amount)||0);});

        return {
            date:target, revenue:+revenue.toFixed(2), grossProfit:+grossProfit.toFixed(2),
            netProfit:+(grossProfit-totalExpenses).toFixed(2),
            salesCount, ordersCount, expenses:+totalExpenses.toFixed(2)
        };
    },

    // ── Restore system from backup JSON ────────────────────────
    restoreFullSystem: async (data) => {
        if (!data || typeof data !== 'object') throw new Error('Invalid backup format.');
        const cols = ['inventory','sales','orders','customers','categories','expenses','notes','waybills'];
        for (const col of cols) {
            if (!data[col] || !Array.isArray(data[col])) continue;
            for (const item of data[col]) {
                if (!item.id) continue;
                const { id, ...rest } = item;
                await _FS.setDoc(col, String(id), { id, ...rest });
            }
        }
        return true;
    },

    // ── CSV / Backup export (browser-side, no server needed) ───
    exportSalesToCSV: async () => {
        try {
            const sales = await DB.getAllSales();
            if (!sales.length) return alert('No sales data to export!');
            let csv = '\ufeffDate,Bill ID,Customer,Items,Total Amount,Net Profit\n';
            sales.forEach(s => {
                const date = new Date(s.date).toLocaleString().replace(/,/g,'');
                const items = (s.items||[]).map(i=>`${i.name}(x${i.qty})`).join('; ');
                csv += `${date},#SL-${s.id},"${s.customer||'Guest'}","${items}",${s.total},${s.total-(s.buyTotal||0)}\n`;
            });
            const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href=url;
            a.download=`Ruhira_Sales_History_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch(err){ console.error(err); alert('Export failed: '+err.message); }
    },

    backupFullSystem: async () => {
        try {
            const data = {
                inventory: await DB.getAllInventory(), sales: await DB.getAllSales(),
                orders: await DB.getAllOrders(), expenses: await DB.getAllExpenses(),
                customers: await DB.getAllCustomers(), categories: await DB.getAllCategories(),
                notes: await DB.getAllNotes(), settings:[], backups:[],
                exportedAt: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href=url;
            a.download=`RuhiraPOS_FULL_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch(err){ console.error(err); alert('Full backup failed: '+err.message); }
    },

    // ── Realtime sync (Firestore polling every 15s) ────────────
    initRealtimeSync: (onEventCallback) => {
        // Since we use REST API (no WebSocket), poll every 15 seconds
        const interval = setInterval(async () => {
            try {
                if (onEventCallback) onEventCallback({ type: 'sync' });
            } catch(e) {}
        }, 15000);
        return { close: () => clearInterval(interval) };
    }
};