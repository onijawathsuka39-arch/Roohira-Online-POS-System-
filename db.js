// Database client wrapper using server REST API endpoints (SQLite database backend)

const API = {
    get: async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return await res.json();
    },
    post: async (url, data) => {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return await res.json();
    },
    put: async (url, data) => {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return await res.json();
    },
    delete: async (url) => {
        const res = await fetch(url, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return await res.json();
    }
};

const DB = {
    // Notes
    getAllNotes: async () => await API.get('/api/notes'),
    addNote: async (note) => await API.post('/api/notes', { ...note, date: new Date().toISOString() }),
    deleteNote: async (id) => await API.delete(`/api/notes/${id}`),

    // Orders
    getAllOrders: async () => await API.get('/api/orders'),
    addOrder: async (order) => {
        // Update inventory stock for ALL items in the order
        for (const item of order.items) {
            const dbItem = await DB.getItem(item.id || item.itemId);
            if (dbItem) {
                await DB.updateItem(dbItem.id, { stock: dbItem.stock - item.qty });
            }
        }
        return await API.post('/api/orders', { ...order, date: new Date().toISOString() });
    },
    updateOrder: async (id, data) => await API.put(`/api/orders/${id}`, data),
    updateOrderStatus: async (id, status) => {
        const order = await API.get(`/api/orders/${id}`);
        if (!order) return;

        // If newly marked as Cancelled, restore stock
        if (status === 'Cancelled' && order.status !== 'Cancelled') {
            for (const item of order.items) {
                const dbItem = await DB.getItem(item.id || item.itemId);
                if (dbItem) {
                    await DB.updateItem(dbItem.id, { stock: dbItem.stock + item.qty });
                }
            }
        }
        // If moving OUT of Cancelled status, deduct stock again
        else if (order.status === 'Cancelled' && status !== 'Cancelled') {
            for (const item of order.items) {
                const dbItem = await DB.getItem(item.id || item.itemId);
                if (dbItem) {
                    await DB.updateItem(dbItem.id, { stock: dbItem.stock - item.qty });
                }
            }
        }

        return await API.put(`/api/orders/${id}`, { status });
    },
    updateOrderPaymentStatus: async (id, paymentStatus) => {
        const order = await API.get(`/api/orders/${id}`);
        if (!order) return;

        // If newly marked as paid, convert order to sale
        if (paymentStatus === 'paid' && order.paymentStatus !== 'paid') {
            await DB.addSale({
                items: order.items,
                total: order.total,
                buyTotal: order.buyTotal || (order.items || []).reduce((sum, i) => sum + ((i.buyPrice || 0) * i.qty), 0),
                discount: order.discount || 0,
                delivery: order.delivery || 0,
                loyaltyDiscount: order.loyaltyDiscount || 0,
                date: new Date().toISOString(),
                customer: order.customer,
                customerId: order.customerId || 'Guest',
                customerPhone: order.phone || 'N/A',
                orderId: order.orderId || order.id,
                paymentMethod: 'cash'
            }, true); // SKIP stock update because it was already deducted on order creation
            await API.put(`/api/orders/${id}`, { paymentStatus: 'paid', status: 'Paid' });
        } else {
            await API.put(`/api/orders/${id}`, { paymentStatus });
        }
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
            for (const item of sale.items) {
                const dbItem = await DB.getItem(item.id || item.itemId);
                if (dbItem) {
                    await DB.updateItem(dbItem.id, { stock: dbItem.stock - item.qty });
                }
            }
        }

        // Update customer info (One bill = one order increment)
        if (sale.customer && sale.customer !== 'Guest') {
            const customers = await DB.getAllCustomers();
            const cust = customers.find(c => c.name === sale.customer);
            if (cust) {
                await API.put(`/api/customers/${cust.id}`, {
                    totalOrders: (cust.totalOrders || 0) + 1,
                    totalSpent: (cust.totalSpent || 0) + sale.total
                });
            }
        }

        return await API.post('/api/sales', sale);
    },
    updateSale: async (id, data) => await API.put(`/api/sales/${id}`, data),
    deleteSale: async (id) => await API.delete(`/api/sales/${id}`),
    getSalesByCustomer: async (customerName) => {
        const sales = await DB.getAllSales();
        return sales.filter(s => s.customer === customerName);
    },
    getOrdersByCustomer: async (customerName) => {
        const orders = await DB.getAllOrders();
        return orders.filter(o => o.customer === customerName);
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
    updateCustomerPoints: async (id, points) => await API.put(`/api/customers/${id}`, { loyaltyPoints: points }),
    updateCustomerStatus: async (id, isBlacklisted) => await API.put(`/api/customers/${id}`, { isBlacklisted }),
    deleteCustomer: async (id) => await API.delete(`/api/customers/${id}`),

    // Categories
    getAllCategories: async () => await API.get('/api/categories'),
    addCategory: async (category) => await API.post('/api/categories', category),

    // Stats calculation
    getDashboardStats: async () => {
        const sales = await DB.getAllSales();
        const inventory = await DB.getAllInventory();
        const customers = await DB.getAllCustomers();
        const expenses = await DB.getAllExpenses();

        const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const grossProfit = sales.reduce((sum, s) => {
            const revenue = Number(s.total) || 0;
            const cost = Number(s.buyTotal) || 0;
            return sum + (revenue - cost);
        }, 0);
        const netProfit = grossProfit - totalExpenses;

        const lowStockCount = inventory.filter(i => (Number(i.stock) || 0) <= 5).length;
        const totalOrders = sales.length;

        return {
            totalRevenue: Number(totalRevenue.toFixed(2)),
            totalExpenses: Number(totalExpenses.toFixed(2)),
            grossProfit: Number(grossProfit.toFixed(2)),
            totalProfit: Number(netProfit.toFixed(2)),
            totalOrders,
            totalCustomers: customers.length,
            lowStockCount
        };
    },

    // CSV Export Utility
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
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Export failed: ' + err.message);
        }
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
                settings: [],
                backups: [],
                exportedAt: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RuhiraPOS_FULL_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Full backup failed: ' + err.message);
        }
    },

    restoreFullSystem: async (data) => {
        try {
            if (!data || (typeof data !== 'object')) {
                throw new Error('Invalid backup format.');
            }
            const hasValidData = data.inventory || data.sales || data.orders || data.customers || data.categories || data.notes;
            if (!hasValidData) {
                throw new Error('Backup file does not contain valid POS data.');
            }

            await API.post('/api/system/restore', data);
            return true;
        } catch (err) {
            console.error('Restore failed:', err);
            throw err;
        }
    },

    // Authentication Logic
    initUsers: async () => {
        // Handled automatically on backend server.js initialization
    },

    login: async (username, password) => {
        try {
            const sessionData = await API.post('/api/auth/login', { username, password });
            sessionStorage.setItem('ruhira_user', JSON.stringify(sessionData));
            return sessionData;
        } catch (err) {
            console.error("Login failed:", err);
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

    // Expenses
    getAllExpenses: async () => await API.get('/api/expenses'),
    addExpense: async (expense) => await API.post('/api/expenses', { ...expense, date: new Date().toISOString() }),
    deleteExpense: async (id) => await API.delete(`/api/expenses/${id}`)
};