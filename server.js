const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'pos_database.sqlite');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname)); // Serve static files from current directory

// Database Setup
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('Database connection error:', err);
    else console.log('Connected to SQLite database.');
});

// Initialize Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        category TEXT,
        type TEXT,
        stock INTEGER,
        buyPrice REAL,
        sellPrice REAL,
        size TEXT,
        packageItems TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total REAL,
        buyTotal REAL,
        date TEXT,
        customer TEXT,
        customerId TEXT,
        customerPhone TEXT,
        items TEXT,
        discount REAL,
        delivery REAL,
        loyaltyDiscount REAL,
        orderId TEXT,
        paymentMethod TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT,
        customer TEXT,
        phone TEXT,
        address TEXT,
        items TEXT,
        total REAL,
        status TEXT,
        deliveryStatus TEXT,
        deliveryMethod TEXT,
        paymentStatus TEXT,
        date TEXT,
        buyTotal REAL,
        discount REAL,
        delivery REAL,
        loyaltyDiscount REAL,
        customerId TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        custId TEXT,
        name TEXT,
        phone TEXT,
        address TEXT,
        totalOrders INTEGER DEFAULT 0,
        totalSpent REAL DEFAULT 0,
        isBlacklisted INTEGER DEFAULT 0,
        loyaltyPoints INTEGER DEFAULT 0,
        profilePic TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        date TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT,
        role TEXT,
        name TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reason TEXT,
        amount REAL,
        date TEXT
    )`);

    // Insert default admin if not exists
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (username, password, role, name) VALUES ('admin', '123', 'admin', 'Master Admin')");
            db.run("INSERT INTO users (username, password, role, name) VALUES ('staff', '123', 'staff', 'Roohira Staff')");
        }
    });
});

// API Routes
const handleQuery = (res, err, data) => {
    if (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } else {
        res.json(data || { success: true });
    }
};

// Notes API
app.get('/api/notes', (req, res) => db.all("SELECT * FROM notes ORDER BY date DESC", (err, rows) => handleQuery(res, err, rows)));
app.post('/api/notes', (req, res) => {
    const { title, content, date } = req.body;
    db.run("INSERT INTO notes (title, content, date) VALUES (?, ?, ?)", [title, content, date || new Date().toISOString()], function(err) {
        handleQuery(res, err, { id: this.lastID });
    });
});
app.delete('/api/notes/:id', (req, res) => db.run("DELETE FROM notes WHERE id = ?", [req.params.id], (err) => handleQuery(res, err)));

// Inventory API
app.get('/api/inventory', (req, res) => db.all("SELECT * FROM inventory", (err, rows) => handleQuery(res, err, rows)));
app.get('/api/inventory/:id', (req, res) => db.get("SELECT * FROM inventory WHERE id = ?", [req.params.id], (err, row) => handleQuery(res, err, row)));
app.post('/api/inventory', (req, res) => {
    const { name, category, type, stock, buyPrice, sellPrice, size, packageItems } = req.body;
    db.run(`INSERT INTO inventory (name, category, type, stock, buyPrice, sellPrice, size, packageItems) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
            [name, category, type, stock, buyPrice, sellPrice, size, packageItems], function(err) {
        handleQuery(res, err, { id: this.lastID });
    });
});
app.put('/api/inventory/:id', (req, res) => {
    const updates = req.body;
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    db.run(`UPDATE inventory SET ${setClause} WHERE id = ?`, [...values, req.params.id], (err) => handleQuery(res, err));
});
app.delete('/api/inventory/:id', (req, res) => db.run("DELETE FROM inventory WHERE id = ?", [req.params.id], (err) => handleQuery(res, err)));

// Customers API
app.get('/api/customers', (req, res) => db.all("SELECT * FROM customers", (err, rows) => handleQuery(res, err, rows)));
app.post('/api/customers', (req, res) => {
    const { name, phone, address, profilePic } = req.body;
    db.get("SELECT COUNT(*) as count FROM customers", (err, row) => {
        const shortId = 'CUS-' + (100 + (row ? row.count : 0) + 1);
        db.run(`INSERT INTO customers (custId, name, phone, address, profilePic, totalOrders, totalSpent, isBlacklisted, loyaltyPoints) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0)`, 
                [shortId, name, phone, address, profilePic], function(err) {
            handleQuery(res, err, { id: this.lastID, custId: shortId });
        });
    });
});
app.put('/api/customers/:id', (req, res) => {
    const updates = req.body;
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    db.run(`UPDATE customers SET ${setClause} WHERE id = ?`, [...values, req.params.id], (err) => handleQuery(res, err));
});
app.delete('/api/customers/:id', (req, res) => db.run("DELETE FROM customers WHERE id = ?", [req.params.id], (err) => handleQuery(res, err)));

// Sales API
app.get('/api/sales', (req, res) => {
    db.all("SELECT * FROM sales ORDER BY date DESC", (err, rows) => {
        if (rows) rows.forEach(r => r.items = JSON.parse(r.items || '[]'));
        handleQuery(res, err, rows);
    });
});
app.post('/api/sales', (req, res) => {
    const sale = req.body;
    const itemsJson = JSON.stringify(sale.items);
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run(`INSERT INTO sales (total, buyTotal, date, customer, customerId, customerPhone, items, discount, delivery, loyaltyDiscount, orderId, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [sale.total, sale.buyTotal, sale.date || new Date().toISOString(), sale.customer, sale.customerId, sale.customerPhone, itemsJson, sale.discount, sale.delivery, sale.loyaltyDiscount, sale.orderId, sale.paymentMethod], 
                function(err) {
                    if (err) return db.run("ROLLBACK");
                    const saleId = this.lastID;
                    if (!req.query.skipStockUpdate) {
                        sale.items.forEach(item => db.run("UPDATE inventory SET stock = stock - ? WHERE id = ?", [item.qty, item.id || item.itemId]));
                    }
                    if (sale.customer && sale.customer !== 'Guest') {
                        db.run("UPDATE customers SET totalOrders = totalOrders + 1, totalSpent = totalSpent + ? WHERE name = ?", [sale.total, sale.customer]);
                    }
                    db.run("COMMIT", () => res.json({ id: saleId }));
                }
        );
    });
});
app.delete('/api/sales/:id', (req, res) => db.run("DELETE FROM sales WHERE id = ?", [req.params.id], (err) => handleQuery(res, err)));

// Orders API
app.get('/api/orders', (req, res) => {
    db.all("SELECT * FROM orders ORDER BY date DESC", (err, rows) => {
        if (rows) rows.forEach(r => r.items = JSON.parse(r.items || '[]'));
        handleQuery(res, err, rows);
    });
});
app.post('/api/orders', (req, res) => {
    const order = req.body;
    const itemsJson = JSON.stringify(order.items);
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run(`INSERT INTO orders (orderId, customer, phone, address, items, total, status, deliveryStatus, deliveryMethod, paymentStatus, date, buyTotal, discount, delivery, loyaltyDiscount, customerId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [order.orderId, order.customer, order.phone, order.address, itemsJson, order.total, order.status, order.deliveryStatus, order.deliveryMethod, order.paymentStatus, order.date || new Date().toISOString(), order.buyTotal, order.discount, order.delivery, order.loyaltyDiscount, order.customerId], 
                function(err) {
                    if (err) return db.run("ROLLBACK");
                    const newOrderId = this.lastID;
                    order.items.forEach(item => db.run("UPDATE inventory SET stock = stock - ? WHERE id = ?", [item.qty, item.id || item.itemId]));
                    db.run("COMMIT", () => res.json({ id: newOrderId }));
                }
        );
    });
});
app.put('/api/orders/:id', (req, res) => {
    const updates = req.body;
    if (updates.items) updates.items = JSON.stringify(updates.items);
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    db.run(`UPDATE orders SET ${setClause} WHERE id = ?`, [...values, req.params.id], (err) => handleQuery(res, err));
});
app.delete('/api/orders/:id', (req, res) => db.run("DELETE FROM orders WHERE id = ?", [req.params.id], (err) => handleQuery(res, err)));

// Categories API
app.get('/api/categories', (req, res) => db.all("SELECT * FROM categories", (err, rows) => handleQuery(res, err, rows)));
app.post('/api/categories', (req, res) => {
    const { name, description } = req.body;
    db.run("INSERT INTO categories (name, description) VALUES (?, ?)", [name, description], function(err) {
        handleQuery(res, err, { id: this.lastID });
    });
});
app.delete('/api/categories/:id', (req, res) => db.run("DELETE FROM categories WHERE id = ?", [req.params.id], (err) => handleQuery(res, err)));

// Expenses API
app.get('/api/expenses', (req, res) => db.all("SELECT * FROM expenses ORDER BY date DESC", (err, rows) => handleQuery(res, err, rows)));
app.post('/api/expenses', (req, res) => {
    const { reason, amount, date } = req.body;
    db.run("INSERT INTO expenses (reason, amount, date) VALUES (?, ?, ?)", [reason, amount, date || new Date().toISOString()], function(err) {
        handleQuery(res, err, { id: this.lastID });
    });
});
app.delete('/api/expenses/:id', (req, res) => db.run("DELETE FROM expenses WHERE id = ?", [req.params.id], (err) => handleQuery(res, err)));

// Settings API
app.get('/api/settings/:key', (req, res) => db.get("SELECT value FROM settings WHERE key = ?", [req.params.key], (err, row) => handleQuery(res, err, row ? JSON.parse(row.value) : null)));
app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, JSON.stringify(value)], (err) => handleQuery(res, err));
});

// Auth API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password = ?", [username, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (user) res.json({ username: user.username, role: user.role, name: user.name, loginTime: new Date().toISOString() });
        else res.status(401).json({ error: 'Invalid credentials' });
    });
});

// Restore API
app.post('/api/restore', (req, res) => {
    const data = req.body;
    console.log("Starting full system restore...");
    
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run("DELETE FROM inventory");
        db.run("DELETE FROM sales");
        db.run("DELETE FROM orders");
        db.run("DELETE FROM customers");
        db.run("DELETE FROM categories");
        db.run("DELETE FROM notes");
        db.run("DELETE FROM expenses");

        if (data.inventory) {
            data.inventory.forEach(i => {
                db.run("INSERT INTO inventory (name, category, type, stock, buyPrice, sellPrice, size, packageItems) VALUES (?,?,?,?,?,?,?,?)", 
                    [i.name, i.category, i.type, i.stock, i.buyPrice, i.sellPrice, i.size, i.packageItems]);
            });
        }

        if (data.sales) {
            data.sales.forEach(s => {
                db.run("INSERT INTO sales (total, buyTotal, date, customer, customerId, customerPhone, items, discount, delivery, loyaltyDiscount, orderId, paymentMethod) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    [s.total, s.buyTotal, s.date, s.customer, s.customerId, s.customerPhone, JSON.stringify(s.items), s.discount, s.delivery, s.loyaltyDiscount, s.orderId, s.paymentMethod]);
            });
        }

        if (data.orders) {
            data.orders.forEach(o => {
                db.run("INSERT INTO orders (orderId, customer, phone, address, items, total, status, deliveryStatus, deliveryMethod, paymentStatus, date, buyTotal, discount, delivery, loyaltyDiscount, customerId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [o.orderId, o.customer, o.phone, o.address, JSON.stringify(o.items), o.total, o.status, o.deliveryStatus, o.deliveryMethod, o.paymentStatus, o.date, o.buyTotal, o.discount, o.delivery, o.loyaltyDiscount, o.customerId]);
            });
        }

        if (data.customers) {
            data.customers.forEach(c => {
                db.run("INSERT INTO customers (custId, name, phone, address, totalOrders, totalSpent, isBlacklisted, loyaltyPoints, profilePic) VALUES (?,?,?,?,?,?,?,?,?)",
                    [c.custId, c.name, c.phone, c.address, c.totalOrders, c.totalSpent, c.isBlacklisted ? 1 : 0, c.loyaltyPoints, c.profilePic]);
            });
        }

        if (data.categories) {
            data.categories.forEach(c => {
                db.run("INSERT INTO categories (name, description) VALUES (?,?)", [c.name, c.description]);
            });
        }

        if (data.notes) {
            data.notes.forEach(n => {
                db.run("INSERT INTO notes (title, content, date) VALUES (?,?,?)", [n.title, n.content, n.date]);
            });
        }

        if (data.expenses) {
            data.expenses.forEach(e => {
                db.run("INSERT INTO expenses (reason, amount, date) VALUES (?,?,?)", [e.reason, e.amount, e.date]);
            });
        }

        db.run("COMMIT", (err) => {
            if (err) {
                console.error("Restore Transaction Failed:", err);
                res.status(500).json({ error: err.message });
            } else {
                console.log("Restore Successful!");
                res.json({ success: true });
            }
        });
    });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
