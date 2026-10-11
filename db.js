// Database client wrapper using server REST API endpoints (SQLite database backend)

const getApiUrl = (url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (window.location.protocol === 'file:') ? 'http://localhost:3005' : '';
    return base + (url.startsWith('/') ? url : '/' + url);
};

const API = {
    get: async (url) => {
        const res = await fetch(getApiUrl(url), {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return await res.json();
    },
    post: async (url, data) => {
        const res = await fetch(getApiUrl(url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return await res.json();
    },
    put: async (url, data) => {
        const res = await fetch(getApiUrl(url), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return await res.json();
    },
    delete: async (url) => {
        const res = await fetch(getApiUrl(url), {
            method: 'DELETE',
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return await res.json();
    }
};

const DB = {
    // Lifecycle / Initialization (compat)
    init: async () => true,
    initUsers: async () => true,

    // Notes
    getAllNotes: async () => await API.get('/api/notes'),
    addNote: async (note) => await API.post('/api/notes', { ...note, date: new Date().toISOString() }),
    deleteNote: async (id) => await API.delete(`/api/notes/${id}`),

    // Orders
    getAllOrders: async () => await API.get('/api/orders'),
    addOrder: async (order) => {
        // Update inventory stock for ALL items in the order
        for (const item of (order.items || [])) {
            const itemId = item.id || item.itemId;
            if (itemId) {
                try {
                    const dbItem = await DB.getItem(itemId);
                    if (dbItem && dbItem.id) {
                        const currentStock = parseFloat(dbItem.stock) || 0;
                        const qty = parseFloat(item.qty) || 0;
                        await DB.updateItem(dbItem.id, { stock: currentStock - qty });
                    }
                } catch (e) {
                    console.warn("Stock update warning for order item:", item, e);
                }
            }
        }
        const res = await API.post('/api/orders', { ...order, date: order.date || new Date().toISOString() });
        return (res && res.id !== undefined) ? res.id : res;
    },
    getOrder: async (id) => await API.get(`/api/orders/${id}`),
    getOrderById: async (id) => await DB.getOrder(id),
    updateOrder: async (id, data) => await API.put(`/api/orders/${id}`, data),
    updateOrderStatus: async (id, status) => {
        const order = await API.get(`/api/orders/${id}`);
        if (!order) return;

        // If newly marked as Cancelled, restore stock
        if (status === 'Cancelled' && order.status !== 'Cancelled') {
            for (const item of (order.items || [])) {
                const itemId = item.id || item.itemId;
                if (itemId) {
                    try {
                        const dbItem = await DB.getItem(itemId);
                        if (dbItem && dbItem.id) {
                            const currentStock = parseFloat(dbItem.stock) || 0;
                            const qty = parseFloat(item.qty) || 0;
                            await DB.updateItem(dbItem.id, { stock: currentStock + qty });
                        }
                    } catch (e) {
                        console.warn("Stock restore warning:", item, e);
                    }
                }
            }
        }
        // If moving OUT of Cancelled status, deduct stock again
        else if (order.status === 'Cancelled' && status !== 'Cancelled') {
            for (const item of (order.items || [])) {
                const itemId = item.id || item.itemId;
                if (itemId) {
                    try {
                        const dbItem = await DB.getItem(itemId);
                        if (dbItem && dbItem.id) {
                            const currentStock = parseFloat(dbItem.stock) || 0;
                            const qty = parseFloat(item.qty) || 0;
                            await DB.updateItem(dbItem.id, { stock: currentStock - qty });
                        }
                    } catch (e) {
                        console.warn("Stock deduct warning:", item, e);
                    }
                }
            }
        }

        return await API.put(`/api/orders/${id}`, { status });
    },
    updateOrderPaymentStatus: async (id, paymentStatus) => {
        const order = await API.get(`/api/orders/${id}`);
        if (!order) return;

        const updateData = { paymentStatus };
        if (paymentStatus === 'paid') {
            updateData.status = 'Paid';
        }
        return await API.put(`/api/orders/${id}`, updateData);
    },
    deleteOrder: async (id) => await API.delete(`/api/orders/${id}`),

    // Settings
    getSetting: async (key) => {
        return await API.get(`/api/settings/${key}`);
    },
    setSetting: async (key, value) => await API.post('/api/settings', { key, value }),

    // Inventory
    getAllInventory: async () => await API.get('/api/inventory'),
    getItem: async (id) => await API.get(`/api/inventory/${id}`),
    getInventoryById: async (id) => await DB.getItem(id), // Alias
    addItem: async (item) => await API.post('/api/inventory', item),
    addInventory: async (item) => await DB.addItem(item), // Alias
    updateItem: async (id, changes) => await API.put(`/api/inventory/${id}`, changes),
    updateInventory: async (id, changes) => await DB.updateItem(id, changes), // Alias
    deleteItem: async (id) => await API.delete(`/api/inventory/${id}`),
    deleteInventory: async (id) => await DB.deleteItem(id), // Alias

    // Sales
    getAllSales: async () => await API.get('/api/sales'),
    addSale: async (sale, skipStockUpdate = false) => {
        if (!skipStockUpdate) {
            // Update inventory stock for ALL items in the bill
            for (const item of (sale.items || [])) {
                const itemId = item.id || item.itemId;
                if (itemId) {
                    try {
                        const dbItem = await DB.getItem(itemId);
                        if (dbItem && dbItem.id) {
                            const currentStock = parseFloat(dbItem.stock) || 0;
                            const qty = parseFloat(item.qty) || 0;
                            await DB.updateItem(dbItem.id, { stock: currentStock - qty });
                        }
                    } catch (e) {
                        console.warn("Stock update warning for sale item:", item, e);
                    }
                }
            }
        }

        // Update customer info (One bill = one order increment)
        if (sale.customer && sale.customer !== 'Guest') {
            try {
                const customers = await DB.getAllCustomers();
                const cust = customers.find(c => c.name === sale.customer || (sale.customerId && c.custId === sale.customerId));
                if (cust && cust.id) {
                    await API.put(`/api/customers/${cust.id}`, {
                        totalOrders: (cust.totalOrders || 0) + 1,
                        totalSpent: (cust.totalSpent || 0) + (Number(sale.total) || 0)
                    });
                }
            } catch (e) {
                console.warn("Customer update warning:", e);
            }
        }

        const res = await API.post('/api/sales', sale);
        return (res && res.id !== undefined) ? res.id : res;
    },
    getSale: async (id) => await API.get(`/api/sales/${id}`),
    getSaleById: async (id) => await DB.getSale(id),
    updateSale: async (id, data) => await API.put(`/api/sales/${id}`, data),
    deleteSale: async (id) => await API.delete(`/api/sales/${id}`),
    getSalesByCustomer: async (customerName, customerId) => {
        const sales = await DB.getAllSales();
        return sales.filter(s => s.customer === customerName || (customerId && s.customerId === customerId));
    },
    getOrdersByCustomer: async (customerName, customerId) => {
        const orders = await DB.getAllOrders();
        return orders.filter(o => o.customer === customerName || (customerId && o.customerId === customerId));
    },

    // Customers
    getAllCustomers: async () => await API.get('/api/customers'),
    getCustomerByName: async (name) => {
        const customers = await DB.getAllCustomers();
        return customers.find(c => c.name === name) || null;
    },
    getCustomerById: async (custId) => {
        const customers = await DB.getAllCustomers();
        return customers.find(c => c.custId === custId) || null;
    },
    addCustomer: async (customer) => {
        return await API.post('/api/customers', customer);
    },
    getCustomerByDbId: async (id) => {
        const customers = await DB.getAllCustomers();
        return customers.find(c => c.id === parseInt(id)) || null;
    },
    updateCustomer: async (id, changes) => await API.put(`/api/customers/${id}`, changes),
    updateCustomerPoints: async (id, points) => await API.put(`/api/customers/${id}`, { loyaltyPoints: points }),
    updateCustomerStatus: async (id, isBlacklisted) => await API.put(`/api/customers/${id}`, { isBlacklisted }),
    deleteCustomer: async (id) => await API.delete(`/api/customers/${id}`),

    // Categories
    getAllCategories: async () => await API.get('/api/categories'),
    addCategory: async (category) => await API.post('/api/categories', category),
    deleteCategory: async (id) => await API.delete(`/api/categories/${id}`),

    // Stats calculation
    getDashboardStats: async () => {
        const sales = await DB.getAllSales();
        const orders = await DB.getAllOrders();
        const inventory = await DB.getAllInventory();
        const customers = await DB.getAllCustomers();
        const expenses = await DB.getAllExpenses();

        const now = new Date();
        const formatDateStr = (d) => {
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return '';
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const todayStr = formatDateStr(now);
        const yest = new Date(now);
        yest.setDate(now.getDate() - 1);
        const yesterdayStr = formatDateStr(yest);
        const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        let todayRevenue = 0, todayProfit = 0, todaySalesCount = 0, todayOrdersCount = 0;
        let yesterdayRevenue = 0, yesterdayProfit = 0, yesterdaySalesCount = 0, yesterdayOrdersCount = 0;
        let thisMonthRevenue = 0, thisMonthProfit = 0, thisMonthSalesCount = 0, thisMonthOrdersCount = 0;
        let totalRevenue = 0, grossProfit = 0;

        sales.forEach(s => {
            const rev = Number(s.total) || 0;
            const cost = Number(s.buyTotal) || 0;
            const profit = rev - cost;
            const sDateStr = formatDateStr(s.date);

            totalRevenue += rev;
            grossProfit += profit;

            if (sDateStr === todayStr) { todayRevenue += rev; todayProfit += profit; todaySalesCount += 1; }
            if (sDateStr === yesterdayStr) { yesterdayRevenue += rev; yesterdayProfit += profit; yesterdaySalesCount += 1; }
            if (sDateStr.startsWith(thisMonthPrefix)) { thisMonthRevenue += rev; thisMonthProfit += profit; thisMonthSalesCount += 1; }
        });

        const activeOrders = orders.filter(o => {
            const st = (o.status || '').toLowerCase();
            const pst = (o.paymentStatus || '').toLowerCase();
            return st !== 'cancelled' && pst !== 'cancelled';
        });

        activeOrders.forEach(o => {
            const oDateStr = formatDateStr(o.date);
            if (oDateStr === todayStr) todayOrdersCount += 1;
            if (oDateStr === yesterdayStr) yesterdayOrdersCount += 1;
            if (oDateStr.startsWith(thisMonthPrefix)) thisMonthOrdersCount += 1;

            const isPaid = (o.paymentStatus || '').toLowerCase() === 'paid' || (o.status || '').toLowerCase() === 'paid';
            if (isPaid) {
                const oRev = Number(o.total) || 0;
                const oCost = Number(o.buyTotal) || (o.items || []).reduce((sum, i) => sum + ((Number(i.buyPrice) || 0) * (Number(i.qty) || 1)), 0);
                const oProfit = oRev - oCost;

                totalRevenue += oRev; grossProfit += oProfit;
                if (oDateStr === todayStr) { todayRevenue += oRev; todayProfit += oProfit; }
                if (oDateStr === yesterdayStr) { yesterdayRevenue += oRev; yesterdayProfit += oProfit; }
                if (oDateStr.startsWith(thisMonthPrefix)) { thisMonthRevenue += oRev; thisMonthProfit += oProfit; }
            }
        });

        const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const netProfit = grossProfit - totalExpenses;
        const lowStockCount = inventory.filter(i => (Number(i.stock) || 0) <= 5).length;

        return {
            todayRevenue: Number(todayRevenue.toFixed(2)),
            todayProfit: Number(todayProfit.toFixed(2)),
            todaySalesCount, todayOrdersCount,
            yesterdayRevenue: Number(yesterdayRevenue.toFixed(2)),
            yesterdayProfit: Number(yesterdayProfit.toFixed(2)),
            yesterdaySalesCount, yesterdayOrdersCount,
            thisMonthRevenue: Number(thisMonthRevenue.toFixed(2)),
            thisMonthProfit: Number(thisMonthProfit.toFixed(2)),
            thisMonthSalesCount, thisMonthOrdersCount,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            totalExpenses: Number(totalExpenses.toFixed(2)),
            grossProfit: Number(grossProfit.toFixed(2)),
            totalProfit: Number(netProfit.toFixed(2)),
            totalOrders: sales.length + activeOrders.length,
            totalCustomers: customers.length,
            lowStockCount
        };
    },

    getStatsForDate: async (targetDateStr) => {
        const sales = await DB.getAllSales();
        const orders = await DB.getAllOrders();
        const expenses = await DB.getAllExpenses();

        const formatDateStr = (d) => {
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return '';
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const target = targetDateStr || formatDateStr(new Date());
        let revenue = 0, grossProfit = 0, salesCount = 0, ordersCount = 0;

        sales.forEach(s => {
            if (formatDateStr(s.date) === target) {
                const r = Number(s.total) || 0, c = Number(s.buyTotal) || 0;
                revenue += r; grossProfit += (r - c); salesCount += 1;
            }
        });

        const activeOrders = orders.filter(o => {
            const st = (o.status || '').toLowerCase(), pst = (o.paymentStatus || '').toLowerCase();
            return st !== 'cancelled' && pst !== 'cancelled';
        });

        activeOrders.forEach(o => {
            if (formatDateStr(o.date) === target) {
                ordersCount += 1;
                const isPaid = (o.paymentStatus || '').toLowerCase() === 'paid' || (o.status || '').toLowerCase() === 'paid';
                if (isPaid) {
                    const r = Number(o.total) || 0, c = Number(o.buyTotal) || 0;
                    revenue += r; grossProfit += (r - c);
                }
            }
        });

        let totalExpenses = 0;
        expenses.forEach(e => { if (formatDateStr(e.date) === target) totalExpenses += (Number(e.amount) || 0); });

        return {
            date: target,
            revenue: Number(revenue.toFixed(2)),
            grossProfit: Number(grossProfit.toFixed(2)),
            netProfit: Number((grossProfit - totalExpenses).toFixed(2)),
            salesCount, ordersCount,
            expenses: Number(totalExpenses.toFixed(2))
        };
    },

    // CSV Export
    exportSalesToCSV: async () => {
        try {
            const sales = await DB.getAllSales();
            if (sales.length === 0) return alert('No sales data to export!');
            let csv = '\ufeffDate,Bill ID,Customer,Items,Total Amount,Net Profit\n';
            sales.forEach(s => {
                const date = new Date(s.date).toLocaleString().replace(/,/g, '');
                const itemsStr = (s.items || []).map(i => `${i.name}(x${i.qty})`).join('; ');
                const profit = s.total - (s.buyTotal || 0);
                csv += `${date},#SL-${s.id},"${s.customer || 'Guest'}","${itemsStr}",${s.total},${profit}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Ruhira_Sales_History_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) { console.error(err); alert('Export failed: ' + err.message); }
    },

    // Full System Backup/Restore
    backupFullSystem: async () => {
        try {
            const data = {
                inventory: await DB.getAllInventory(),
                sales: await DB.getAllSales(),
                orders: await DB.getAllOrders(),
                expenses: await DB.getAllExpenses(),
                customers: await DB.getAllCustomers(),
                categories: await DB.getAllCategories(),
                notes: await DB.getAllNotes(),
                settings: [], backups: [],
                exportedAt: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RuhiraPOS_FULL_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) { console.error(err); alert('Full backup failed: ' + err.message); }
    },

    restoreFullSystem: async (data) => {
        try {
            if (!data || (typeof data !== 'object')) throw new Error('Invalid backup format.');
            const hasValidData = data.inventory || data.sales || data.orders || data.customers || data.categories || data.notes;
            if (!hasValidData) throw new Error('Backup file does not contain valid POS data.');
            await API.post('/api/system/restore', data);
            return true;
        } catch (err) { console.error('Restore failed:', err); throw err; }
    },

    // Authentication
    login: async (username, password) => {
        try {
            const sessionData = await API.post('/api/auth/login', { username, password });
            sessionStorage.setItem('ruhira_user', JSON.stringify(sessionData));
            return sessionData;
        } catch (err) { console.error("Login failed:", err); return null; }
    },
    logout: () => { sessionStorage.removeItem('ruhira_user'); window.location.href = 'login.html'; },
    getCurrentUser: () => { const user = sessionStorage.getItem('ruhira_user'); return user ? JSON.parse(user) : null; },

    // Expenses
    getAllExpenses: async () => await API.get('/api/expenses'),
    addExpense: async (expense) => await API.post('/api/expenses', { ...expense, date: new Date().toISOString() }),
    deleteExpense: async (id) => await API.delete(`/api/expenses/${id}`),

    // Waybills
    getAllWaybills: async () => {
        try {
            const list = await API.get('/api/waybills');
            if (Array.isArray(list)) { localStorage.setItem('roohira_local_waybills', JSON.stringify(list)); return list; }
        } catch (e) { console.warn("API /api/waybills fallback to localStorage:", e); }
        try { return JSON.parse(localStorage.getItem('roohira_local_waybills') || '[]'); } catch (e) { return []; }
    },
    addWaybill: async (waybill) => {
        let savedId = null;
        try {
            const res = await API.post('/api/waybills', { ...waybill, date: waybill.date || new Date().toISOString() });
            savedId = (res && res.id !== undefined) ? res.id : res;
        } catch (e) { console.warn("API addWaybill fallback to localStorage:", e); savedId = Date.now(); }
        try {
            const local = JSON.parse(localStorage.getItem('roohira_local_waybills') || '[]');
            local.unshift({ ...waybill, id: savedId, date: waybill.date || new Date().toISOString() });
            localStorage.setItem('roohira_local_waybills', JSON.stringify(local));
        } catch (e) {}
        return savedId;
    },
    deleteWaybill: async (id) => {
        try { await API.delete(`/api/waybills/${id}`); } catch (e) { console.warn("API deleteWaybill fallback:", e); }
        try {
            let local = JSON.parse(localStorage.getItem('roohira_local_waybills') || '[]');
            local = local.filter(w => String(w.id) !== String(id));
            localStorage.setItem('roohira_local_waybills', JSON.stringify(local));
        } catch (e) {}
        return true;
    },

    // Real-time multi-device sync listener
    initRealtimeSync: (onEventCallback) => {
        try {
            const streamUrl = getApiUrl('/api/realtime/stream');
            const es = new EventSource(streamUrl);
            es.onmessage = (e) => {
                try { const data = JSON.parse(e.data); if (onEventCallback) onEventCallback(data); } catch(err) {}
            };
            return es;
        } catch(err) { console.warn("Realtime sync listener error:", err); return null; }
    }
};