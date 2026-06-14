// Original Dexie Database Structure
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

// Helper functions for easy access
const DB = {
    // Inventory
    getAllInventory: () => db.inventory.toArray(),
    getInventoryById: (id) => db.inventory.get(id),
    addInventory: (item) => db.inventory.add(item),
    updateInventory: (id, changes) => db.inventory.update(id, changes),
    deleteInventory: (id) => db.inventory.delete(id),

    // Sales
    getAllSales: () => db.sales.orderBy('date').reverse().toArray(),
    getSaleById: (id) => db.sales.get(id),
    addSale: (sale) => db.sales.add(sale),
    deleteSale: (id) => db.sales.delete(id),

    // Customers
    getAllCustomers: () => db.customers.toArray(),
    getCustomerById: (id) => db.customers.get(id),
    addCustomer: (customer) => db.customers.add(customer),
    updateCustomer: (id, changes) => db.customers.update(id, changes),
    deleteCustomer: (id) => db.customers.delete(id),

    // Categories
    getAllCategories: () => db.categories.toArray(),
    addCategory: (cat) => db.categories.add(cat),
    deleteCategory: (id) => db.categories.delete(id),

    // Notes
    getAllNotes: () => db.notes.orderBy('date').reverse().toArray(),
    addNote: (note) => db.notes.add(note),
    deleteNote: (id) => db.notes.delete(id),

    // Orders
    getAllOrders: () => db.orders.orderBy('date').reverse().toArray(),
    getOrderById: (id) => db.orders.get(id),
    addOrder: (order) => db.orders.add(order),
    updateOrder: (id, changes) => db.orders.update(id, changes),
    deleteOrder: (id) => db.orders.delete(id),

    // Expenses
    getAllExpenses: () => db.expenses.orderBy('date').reverse().toArray(),
    addExpense: (exp) => db.expenses.add(exp),
    deleteExpense: (id) => db.expenses.delete(id),

    // Restore/Backup
    restoreFullSystem: async (data) => {
        await db.transaction('rw', db.inventory, db.sales, db.orders, db.customers, db.categories, db.notes, db.expenses, async () => {
            if (data.inventory) { await db.inventory.clear(); await db.inventory.bulkAdd(data.inventory); }
            if (data.sales) { await db.sales.clear(); await db.sales.bulkAdd(data.sales); }
            if (data.orders) { await db.orders.clear(); await db.orders.bulkAdd(data.orders); }
            if (data.customers) { await db.customers.clear(); await db.customers.bulkAdd(data.customers); }
            if (data.categories) { await db.categories.clear(); await db.categories.bulkAdd(data.categories); }
            if (data.notes) { await db.notes.clear(); await db.notes.bulkAdd(data.notes); }
            if (data.expenses) { await db.expenses.clear(); await db.expenses.bulkAdd(data.expenses); }
        });
        return true;
    },

    backupFullSystem: async () => {
        const data = {
            inventory: await db.inventory.toArray(),
            sales: await db.sales.toArray(),
            orders: await db.orders.toArray(),
            customers: await db.customers.toArray(),
            categories: await db.categories.toArray(),
            notes: await db.notes.toArray(),
            expenses: await db.expenses.toArray()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RuhiraPOS_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    },

    logout: () => {
        localStorage.removeItem('pos_user');
        window.location.href = 'login.html';
    }
};
