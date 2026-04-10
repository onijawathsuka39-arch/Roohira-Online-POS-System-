// Database Structure using Dexie.js
const db = new Dexie('RuhiraPOS_DB');

db.version(8).stores({
    inventory: '++id, name, category, type, stock, buyPrice, sellPrice, size, packageItems',
    sales: '++id, total, buyTotal, date, customer, paymentMethod',
    orders: '++id, orderId, customer, phone, address, items, total, status, deliveryStatus, deliveryMethod, paymentStatus, date',
    customers: '++id, custId, name, phone, address, totalOrders, totalSpent, isBlacklisted, loyaltyPoints, profilePic',
    categories: '++id, name, description',
    notes: '++id, title, content, date',
    settings: 'key, value',
    backups: '++id, date, name, size',
    users: 'username, role, password',
    expenses: '++id, reason, amount, date'
});

// Helper functions for DB access
const DB = {
    // Notes
    getAllNotes: async () => await db.notes.toArray(),
    addNote: async (note) => await db.notes.add({ ...note, date: new Date().toISOString() }),
    deleteNote: async (id) => await db.notes.delete(id),

    // Orders
    getAllOrders: async () => await db.orders.orderBy('date').reverse().toArray(),
    addOrder: async (order) => {
        // Update inventory stock for ALL items in the order
        for (const item of order.items) {
            const dbItem = await db.inventory.get(item.id || item.itemId);
            if (dbItem) {
                await db.inventory.update(dbItem.id, { stock: dbItem.stock - item.qty });
            }
        }
        return await db.orders.add({ ...order, date: new Date().toISOString() });
    },
    updateOrder: async (id, data) => await db.orders.update(id, data),
    updateOrderStatus: async (id, status) => {
        const order = await db.orders.get(id);
        if (!order) return;

        // If newly marked as Cancelled, restore stock
        if (status === 'Cancelled' && order.status !== 'Cancelled') {
            for (const item of order.items) {
                const dbItem = await db.inventory.get(item.id || item.itemId);
                if (dbItem) {
                    await db.inventory.update(dbItem.id, { stock: dbItem.stock + item.qty });
                }
            }
        }
        // If moving OUT of Cancelled status, deduct stock again
        else if (order.status === 'Cancelled' && status !== 'Cancelled') {
            for (const item of order.items) {
                const dbItem = await db.inventory.get(item.id || item.itemId);
                if (dbItem) {
                    await db.inventory.update(dbItem.id, { stock: dbItem.stock - item.qty });
                }
            }
        }

        return await db.orders.update(id, { status });
    },
    updateOrderPaymentStatus: async (id, paymentStatus) => {
        const order = await db.orders.get(id);
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
            await db.orders.update(id, { paymentStatus: 'paid', status: 'Paid' });
        } else {
            await db.orders.update(id, { paymentStatus });
        }
    },
    deleteOrder: async (id) => await db.orders.delete(id),

    // Settings
    getSetting: async (key) => {
        const s = await db.settings.get(key);
        return s ? s.value : null;
    },
    setSetting: async (key, value) => await db.settings.put({ key, value }),

    // Inventory
    getAllInventory: async () => await db.inventory.toArray(),
    getItem: async (id) => await db.inventory.get(id),
    getInventoryById: async (id) => await db.inventory.get(id), // Alias
    addItem: async (item) => await db.inventory.add(item),
    addInventory: async (item) => await db.inventory.add(item), // Alias
    updateItem: async (id, changes) => await db.inventory.update(id, changes),
    updateInventory: async (id, changes) => await db.inventory.update(id, changes), // Alias
    deleteItem: async (id) => await db.inventory.delete(id),
    deleteInventory: async (id) => await db.inventory.delete(id), // Alias

    // Sales
    getAllSales: async () => await db.sales.orderBy('date').reverse().toArray(),
    addSale: async (sale, skipStockUpdate = false) => {
        if (!skipStockUpdate) {
            // Update inventory stock for ALL items in the bill
            for (const item of sale.items) {
                const dbItem = await db.inventory.get(item.id || item.itemId);
                if (dbItem) {
                    await db.inventory.update(dbItem.id, { stock: dbItem.stock - item.qty });
                }
            }
        }

        // Update customer info (One bill = one order increment)
        if (sale.customer && sale.customer !== 'Guest') {
            const cust = await db.customers.where('name').equals(sale.customer).first();
            if (cust) {
                await db.customers.update(cust.id, {
                    totalOrders: (cust.totalOrders || 0) + 1,
                    totalSpent: (cust.totalSpent || 0) + sale.total
                });
            }
        }

        return await db.sales.add(sale);
    },
    updateSale: async (id, data) => await db.sales.update(id, data),
    deleteSale: async (id) => await db.sales.delete(id),
    getSalesByCustomer: async (customerName) => await db.sales.where('customer').equals(customerName).reverse().toArray(),
    getOrdersByCustomer: async (customerName) => await db.orders.where('customer').equals(customerName).reverse().toArray(),

    // Customers
    getAllCustomers: async () => await db.customers.toArray(),
    getCustomerByName: async (name) => await db.customers.where('name').equals(name).first(),
    getCustomerById: async (custId) => await db.customers.where('custId').equals(custId).first(),
    addCustomer: async (customer) => {
        const count = await db.customers.count();
        const shortId = 'CUS-' + (100 + count + 1);
        return await db.customers.add({
            ...customer,
            custId: shortId,
            totalOrders: 0,
            totalSpent: 0,
            isBlacklisted: false,
            loyaltyPoints: 0
        });
    },
    updateCustomerPoints: async (id, points) => await db.customers.update(id, { loyaltyPoints: points }),
    updateCustomerStatus: async (id, isBlacklisted) => await db.customers.update(id, { isBlacklisted }),
    deleteCustomer: async (id) => await db.customers.delete(id),

    // Categories
    getAllCategories: async () => await db.categories.toArray(),
    addCategory: async (category) => await db.categories.add(category),

    // Stats calculation
    getDashboardStats: async () => {
        const sales = await db.sales.toArray();
        const inventory = await db.inventory.toArray();
        const customers = await db.customers.toArray();
        const expenses = await db.expenses.toArray();

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
            const sales = await db.sales.toArray();
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
                inventory: await db.inventory.toArray(),
                sales: await db.sales.toArray(),
                orders: await db.orders.toArray(),
                expenses: await db.expenses.toArray(),
                customers: await db.customers.toArray(),
                categories: await db.categories.toArray(),
                notes: await db.notes.toArray(),
                settings: await db.settings.toArray(),
                backups: await db.backups.toArray(),
                version: db.verno,
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
            // Validate that it's actually a RuhiraPOS backup
            if (!data || (typeof data !== 'object')) {
                throw new Error('Invalid backup format.');
            }
            const hasValidData = data.inventory || data.sales || data.orders || data.customers || data.categories || data.notes;
            if (!hasValidData) {
                throw new Error('Backup file does not contain valid POS data.');
            }

            // Clear all tables
            await Promise.all([
                db.inventory.clear(),
                db.sales.clear(),
                db.orders.clear(),
                db.expenses.clear(),
                db.customers.clear(),
                db.categories.clear(),
                db.notes.clear(),
                db.settings.clear(),
                db.backups.clear()
            ]);

            // Restore data using bulkPut (handles ID conflicts gracefully)
            if (data.inventory && data.inventory.length) await db.inventory.bulkPut(data.inventory);
            if (data.sales && data.sales.length) await db.sales.bulkPut(data.sales);
            if (data.orders && data.orders.length) await db.orders.bulkPut(data.orders);
            if (data.customers && data.customers.length) await db.customers.bulkPut(data.customers);
            if (data.categories && data.categories.length) await db.categories.bulkPut(data.categories);
            if (data.notes && data.notes.length) await db.notes.bulkPut(data.notes);
            if (data.expenses && data.expenses.length) await db.expenses.bulkPut(data.expenses);
            if (data.settings && data.settings.length) await db.settings.bulkPut(data.settings);
            if (data.backups && data.backups.length) await db.backups.bulkPut(data.backups);

            return true;
        } catch (err) {
            console.error('Restore failed:', err);
            throw err;
        }
    },

    // Authentication Logic
    initUsers: async () => {
        try {
            const adminExists = await db.users.get('admin');
            if (!adminExists) {
                await db.users.put({ username: 'admin', password: '123', role: 'admin', name: 'Master Admin' });
            }
            const staffExists = await db.users.get('staff');
            if (!staffExists) {
                await db.users.put({ username: 'staff', password: '123', role: 'staff', name: 'Roohira Staff' });
            }
        } catch (err) {
            console.error("User initialization skipped due to DB state:", err);
        }
    },

    login: async (username, password) => {
        const cleanUser = username.trim().toLowerCase();
        const cleanPass = password.trim();

        try {
            const user = await db.users.get(cleanUser);
            if (user && user.password === cleanPass) {
                const sessionData = {
                    username: user.username,
                    role: user.role,
                    name: user.name,
                    loginTime: new Date().toISOString()
                };
                sessionStorage.setItem('ruhira_user', JSON.stringify(sessionData));
                return sessionData;
            }
        } catch (err) {
            console.error("DB Login check failed, falling back:", err);
        }

        if (cleanUser === 'admin' && cleanPass === '123') {
            const sessionData = { username: 'admin', role: 'admin', name: 'Master Admin' };
            sessionStorage.setItem('ruhira_user', JSON.stringify(sessionData));
            return sessionData;
        } else if (cleanUser === 'staff' && cleanPass === '123') {
            const sessionData = { username: 'staff', role: 'staff', name: 'Roohira Staff' };
            sessionStorage.setItem('ruhira_user', JSON.stringify(sessionData));
            return sessionData;
        }

        return null;
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
    getAllExpenses: async () => await db.expenses.orderBy('date').reverse().toArray(),
    addExpense: async (expense) => await db.expenses.add({ ...expense, date: new Date().toISOString() }),
    deleteExpense: async (id) => await db.expenses.delete(id)
};
