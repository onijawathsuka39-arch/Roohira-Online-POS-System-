// Database Structure - Redirecting to Local Express Server API
const API_BASE = '/api';

const DB = {
    request: async (endpoint, method = 'GET', data = null) => {
        try {
            const options = { method, headers: { 'Content-Type': 'application/json' } };
            if (data) options.body = JSON.stringify(data);
            const response = await fetch(`${API_BASE}${endpoint}`, options);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return await response.json();
        } catch (err) {
            console.error('Database Request Failed:', err);
            throw err;
        }
    },

    // Notes
    getAllNotes: async () => await DB.request('/notes'),
    addNote: async (note) => await DB.request('/notes', 'POST', { ...note, date: new Date().toISOString() }),
    deleteNote: async (id) => await DB.request(`/notes/${id}`, 'DELETE'),

    // Orders
    getAllOrders: async () => await DB.request('/orders'),
    addOrder: async (order) => await DB.request('/orders', 'POST', { ...order, date: new Date().toISOString() }),
    updateOrder: async (id, data) => await DB.request(`/orders/${id}`, 'PUT', data),
    updateOrderStatus: async (id, status) => await DB.request(`/orders/${id}`, 'PUT', { status }),
    deleteOrder: async (id) => await DB.request(`/orders/${id}`, 'DELETE'),

    // Inventory
    getAllInventory: async () => await DB.request('/inventory'),
    getItem: async (id) => await DB.request(`/inventory/${id}`),
    addItem: async (item) => await DB.request('/inventory', 'POST', item),
    updateItem: async (id, changes) => await DB.request(`/inventory/${id}`, 'PUT', changes),
    deleteItem: async (id) => await DB.request(`/inventory/${id}`, 'DELETE'),
    
    // Aliases for compatibility
    getInventoryById: async (id) => await DB.request(`/inventory/${id}`),
    addInventory: async (item) => await DB.request('/inventory', 'POST', item),
    updateInventory: async (id, changes) => await DB.request(`/inventory/${id}`, 'PUT', changes),
    deleteInventory: async (id) => await DB.request(`/inventory/${id}`, 'DELETE'),

    // Sales
    getAllSales: async () => await DB.request('/sales'),
    addSale: async (sale, skipStockUpdate = false) => await DB.request(`/sales${skipStockUpdate ? '?skipStockUpdate=true' : ''}`, 'POST', sale),
    updateSale: async (id, data) => await DB.request(`/sales/${id}`, 'PUT', data),
    deleteSale: async (id) => await DB.request(`/sales/${id}`, 'DELETE'),

    // Customers
    getAllCustomers: async () => await DB.request('/customers'),
    getSalesByCustomer: async (name) => {
        const sales = await DB.getAllSales();
        return sales.filter(s => s.customer === name);
    },
    getOrdersByCustomer: async (name) => {
        const orders = await DB.getAllOrders();
        return orders.filter(o => o.customer === name);
    },
    addCustomer: async (customer) => await DB.request('/customers', 'POST', customer),
    updateCustomer: async (id, data) => await DB.request(`/customers/${id}`, 'PUT', data),
    deleteCustomer: async (id) => await DB.request(`/customers/${id}`, 'DELETE'),
    updateCustomerPoints: async (id, points) => await DB.request(`/customers/${id}`, 'PUT', { loyaltyPoints: points }),

    // Categories
    getAllCategories: async () => await DB.request('/categories'),
    addCategory: async (category) => await DB.request('/categories', 'POST', category),
    deleteCategory: async (id) => await DB.request(`/categories/${id}`, 'DELETE'),

    // Expenses
    getAllExpenses: async () => await DB.request('/expenses'),
    addExpense: async (expense) => await DB.request('/expenses', 'POST', { ...expense, date: new Date().toISOString() }),
    deleteExpense: async (id) => await DB.request(`/expenses/${id}`, 'DELETE'),

    // Settings
    getSetting: async (key) => await DB.request(`/settings/${key}`),
    setSetting: async (key, value) => await DB.request('/settings', 'POST', { key, value }),

    // Auth
    login: async (username, password) => {
        const user = await DB.request('/login', 'POST', { username, password });
        if (user) sessionStorage.setItem('ruhira_user', JSON.stringify(user));
        return user;
    },
    logout: () => { sessionStorage.removeItem('ruhira_user'); window.location.href = 'login.html'; },
    getCurrentUser: () => JSON.parse(sessionStorage.getItem('ruhira_user') || 'null'),

    // Stats
    getDashboardStats: async () => {
        const [sales, inventory, customers, expenses] = await Promise.all([
            DB.getAllSales(), DB.getAllInventory(), DB.getAllCustomers(), DB.getAllExpenses()
        ]);
        const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const grossProfit = sales.reduce((sum, s) => sum + ((Number(s.total) || 0) - (Number(s.buyTotal) || 0)), 0);
        return { 
            totalRevenue: Number(totalRevenue.toFixed(2)), 
            totalExpenses: Number(totalExpenses.toFixed(2)),
            grossProfit: Number(grossProfit.toFixed(2)),
            totalProfit: Number((grossProfit - totalExpenses).toFixed(2)), 
            totalOrders: sales.length, 
            totalCustomers: customers.length, 
            lowStockCount: inventory.filter(i => (Number(i.stock) || 0) <= 5).length 
        };
    },

    restoreFullSystem: async (data) => (await DB.request('/restore', 'POST', data)).success,

    backupFullSystem: async () => {
        const data = {
            notes: await DB.getAllNotes(),
            orders: await DB.getAllOrders(),
            inventory: await DB.getAllInventory(),
            sales: await DB.getAllSales(),
            customers: await DB.getAllCustomers(),
            categories: await DB.getAllCategories(),
            expenses: await DB.getAllExpenses()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RuhiraPOS_FullBackup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    exportSalesToCSV: async () => {
        const sales = await DB.getAllSales();
        if (!sales.length) { alert('No sales data to export'); return; }
        
        const headers = ['ID', 'Date', 'Customer', 'Items', 'Total', 'BuyTotal', 'Profit', 'PaymentMethod'];
        const rows = sales.map(s => [
            s.id,
            new Date(s.date).toLocaleString(),
            s.customer || 'Guest',
            (s.items || []).map(i => `${i.name} x${i.qty}`).join('; '),
            s.total,
            s.buyTotal,
            (s.total - (s.buyTotal || 0)),
            s.paymentMethod || 'cash'
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ruhira_Sales_History_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};
