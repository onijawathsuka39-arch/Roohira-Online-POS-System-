const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the project root
app.use(express.static(__dirname));

// Open SQLite database
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening SQLite database:', err);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
    }
});

// Initialize database tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT,
        role TEXT,
        name TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        category TEXT,
        type TEXT,
        stock REAL,
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
        paymentMethod TEXT,
        items TEXT,
        discount REAL,
        delivery REAL,
        loyaltyDiscount REAL,
        customerId TEXT,
        customerPhone TEXT,
        orderId TEXT
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
        totalOrders INTEGER,
        totalSpent REAL,
        isBlacklisted INTEGER,
        loyaltyPoints REAL,
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

    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reason TEXT,
        amount REAL,
        date TEXT
    )`);

    // Insert default admin and staff users if they don't exist
    db.get("SELECT username FROM users WHERE username = 'admin'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (username, password, role, name) VALUES ('admin', '123', 'admin', 'Master Admin')");
        }
    });

    db.get("SELECT username FROM users WHERE username = 'staff'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (username, password, role, name) VALUES ('staff', '123', 'staff', 'Roohira Staff')");
        }
    });

    // Auto-seed from backup file if database is empty
    db.get("SELECT COUNT(*) as count FROM inventory", (err, row) => {
        if (err) return console.error("Error checking inventory count for seeding:", err);
        if (row && row.count === 0) {
            const backupFile = path.join(__dirname, 'RuhiraPOS_FULL_Backup_2026-05-14.json');
            if (fs.existsSync(backupFile)) {
                console.log("Empty database detected. Seeding data from backup file:", backupFile);
                try {
                    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
                    
                    db.serialize(() => {
                        db.run("BEGIN TRANSACTION");
                        try {
                            if (backupData.inventory && backupData.inventory.length) {
                                const stmt = db.prepare("INSERT INTO inventory (id, name, category, type, stock, buyPrice, sellPrice, size, packageItems) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                                backupData.inventory.forEach(item => {
                                    stmt.run([item.id, item.name, item.category, item.type, item.stock, item.buyPrice, item.sellPrice, item.size, JSON.stringify(item.packageItems || null)]);
                                });
                                stmt.finalize();
                            }
                            if (backupData.sales && backupData.sales.length) {
                                const stmt = db.prepare("INSERT INTO sales (id, total, buyTotal, date, customer, paymentMethod, items, discount, delivery, loyaltyDiscount, customerId, customerPhone, orderId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                                backupData.sales.forEach(s => {
                                    stmt.run([s.id, s.total, s.buyTotal, s.date, s.customer, s.paymentMethod, JSON.stringify(s.items || []), s.discount || 0, s.delivery || 0, s.loyaltyDiscount || 0, s.customerId || 'Guest', s.customerPhone || 'N/A', s.orderId]);
                                });
                                stmt.finalize();
                            }
                            if (backupData.orders && backupData.orders.length) {
                                const stmt = db.prepare("INSERT INTO orders (id, orderId, customer, phone, address, items, total, status, deliveryStatus, deliveryMethod, paymentStatus, date, buyTotal, discount, delivery, loyaltyDiscount, customerId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                                backupData.orders.forEach(o => {
                                    stmt.run([o.id, o.orderId, o.customer, o.phone, o.address, JSON.stringify(o.items || []), o.total, o.status, o.deliveryStatus, o.deliveryMethod, o.paymentStatus, o.date, o.buyTotal || 0, o.discount || 0, o.delivery || 0, o.loyaltyDiscount || 0, o.customerId || 'Guest']);
                                });
                                stmt.finalize();
                            }
                            if (backupData.customers && backupData.customers.length) {
                                const stmt = db.prepare("INSERT INTO customers (id, custId, name, phone, address, totalOrders, totalSpent, isBlacklisted, loyaltyPoints, profilePic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                                backupData.customers.forEach(c => {
                                    stmt.run([c.id, c.custId, c.name, c.phone, c.address, c.totalOrders || 0, c.totalSpent || 0, c.isBlacklisted ? 1 : 0, c.loyaltyPoints || 0, c.profilePic]);
                                });
                                stmt.finalize();
                            }
                            if (backupData.categories && backupData.categories.length) {
                                const stmt = db.prepare("INSERT INTO categories (id, name, description) VALUES (?, ?, ?)");
                                backupData.categories.forEach(c => {
                                    stmt.run([c.id, c.name, c.description]);
                                });
                                stmt.finalize();
                            }
                            if (backupData.notes && backupData.notes.length) {
                                const stmt = db.prepare("INSERT INTO notes (id, title, content, date) VALUES (?, ?, ?, ?)");
                                backupData.notes.forEach(n => {
                                    stmt.run([n.id, n.title, n.content, n.date]);
                                });
                                stmt.finalize();
                            }
                            if (backupData.expenses && backupData.expenses.length) {
                                const stmt = db.prepare("INSERT INTO expenses (id, reason, amount, date) VALUES (?, ?, ?, ?)");
                                backupData.expenses.forEach(e => {
                                    stmt.run([e.id, e.reason, e.amount, e.date]);
                                });
                                stmt.finalize();
                            }
                            db.run("COMMIT", (commitErr) => {
                                if (commitErr) console.error("Commit error during seeding:", commitErr);
                                else console.log("Seeding complete! Database successfully populated from backup file.");
                            });
                        } catch (txErr) {
                            db.run("ROLLBACK");
                            console.error("Failed to seed database transaction:", txErr);
                        }
                    });
                } catch (parseErr) {
                    console.error("Failed to parse backup file for seeding:", parseErr);
                }
            } else {
                console.log("No backup file found - starting with clean database.");
            }
        }
    });
});

// Helper functions for DB queries to support promises
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const allQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// API Endpoints

// ---------------- NOTES ----------------
app.get('/api/notes', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM notes ORDER BY date DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notes', async (req, res) => {
    try {
        const { title, content, date } = req.body;
        const result = await runQuery(
            "INSERT INTO notes (title, content, date) VALUES (?, ?, ?)",
            [title, content, date || new Date().toISOString()]
        );
        res.json({ id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/notes/:id', async (req, res) => {
    try {
        await runQuery("DELETE FROM notes WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- ORDERS ----------------
app.get('/api/orders', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM orders ORDER BY date DESC");
        const parsed = rows.map(r => ({
            ...r,
            items: r.items ? JSON.parse(r.items) : []
        }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const row = await getQuery("SELECT * FROM orders WHERE id = ?", [req.params.id]);
        if (row) {
            row.items = row.items ? JSON.parse(row.items) : [];
        }
        res.json(row || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const o = req.body;
        const result = await runQuery(
            `INSERT INTO orders (orderId, customer, phone, address, items, total, status, deliveryStatus, deliveryMethod, paymentStatus, date, buyTotal, discount, delivery, loyaltyDiscount, customerId)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                o.orderId, o.customer, o.phone, o.address, JSON.stringify(o.items || []), o.total,
                o.status, o.deliveryStatus, o.deliveryMethod, o.paymentStatus, o.date || new Date().toISOString(),
                o.buyTotal, o.discount, o.delivery, o.loyaltyDiscount, o.customerId
            ]
        );
        res.json({ id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const o = req.body;
        const updates = [];
        const params = [];
        for (const [key, val] of Object.entries(o)) {
            if (key === 'id') continue;
            updates.push(`${key} = ?`);
            params.push(key === 'items' ? JSON.stringify(val) : val);
        }
        params.push(req.params.id);
        if (updates.length > 0) {
            await runQuery(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        await runQuery("DELETE FROM orders WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- SETTINGS ----------------
app.get('/api/settings/:key', async (req, res) => {
    try {
        const row = await getQuery("SELECT value FROM settings WHERE key = ?", [req.params.key]);
        res.json(row ? row.value : null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        await runQuery("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- INVENTORY ----------------
app.get('/api/inventory', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM inventory");
        const parsed = rows.map(r => ({
            ...r,
            packageItems: r.packageItems ? JSON.parse(r.packageItems) : null
        }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/inventory/:id', async (req, res) => {
    try {
        const row = await getQuery("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
        if (row) {
            row.packageItems = row.packageItems ? JSON.parse(row.packageItems) : null;
        }
        res.json(row || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/inventory', async (req, res) => {
    try {
        const i = req.body;
        const result = await runQuery(
            `INSERT INTO inventory (name, category, type, stock, buyPrice, sellPrice, size, packageItems)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [i.name, i.category, i.type, i.stock, i.buyPrice, i.sellPrice, i.size, JSON.stringify(i.packageItems || null)]
        );
        res.json({ id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/inventory/:id', async (req, res) => {
    try {
        const i = req.body;
        const updates = [];
        const params = [];
        for (const [key, val] of Object.entries(i)) {
            if (key === 'id') continue;
            updates.push(`${key} = ?`);
            params.push(key === 'packageItems' ? JSON.stringify(val) : val);
        }
        params.push(req.params.id);
        if (updates.length > 0) {
            await runQuery(`UPDATE inventory SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/inventory/:id', async (req, res) => {
    try {
        await runQuery("DELETE FROM inventory WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- SALES ----------------
app.get('/api/sales', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM sales ORDER BY date DESC");
        const parsed = rows.map(r => ({
            ...r,
            items: r.items ? JSON.parse(r.items) : []
        }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sales', async (req, res) => {
    try {
        const s = req.body;
        const result = await runQuery(
            `INSERT INTO sales (total, buyTotal, date, customer, paymentMethod, items, discount, delivery, loyaltyDiscount, customerId, customerPhone, orderId)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                s.total, s.buyTotal, s.date || new Date().toISOString(), s.customer, s.paymentMethod,
                JSON.stringify(s.items || []), s.discount, s.delivery, s.loyaltyDiscount, s.customerId, s.customerPhone, s.orderId
            ]
        );
        res.json({ id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/sales/:id', async (req, res) => {
    try {
        const s = req.body;
        const updates = [];
        const params = [];
        for (const [key, val] of Object.entries(s)) {
            if (key === 'id') continue;
            updates.push(`${key} = ?`);
            params.push(key === 'items' ? JSON.stringify(val) : val);
        }
        params.push(req.params.id);
        if (updates.length > 0) {
            await runQuery(`UPDATE sales SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/sales/:id', async (req, res) => {
    try {
        await runQuery("DELETE FROM sales WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- CUSTOMERS ----------------
app.get('/api/customers', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM customers");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/customers', async (req, res) => {
    try {
        const c = req.body;
        // Count to generate custom ID
        const countRow = await getQuery("SELECT COUNT(*) as count FROM customers");
        const count = countRow ? countRow.count : 0;
        const shortId = 'CUS-' + (100 + count + 1);

        const result = await runQuery(
            `INSERT INTO customers (custId, name, phone, address, totalOrders, totalSpent, isBlacklisted, loyaltyPoints, profilePic)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shortId, c.name, c.phone, c.address,
                c.totalOrders || 0, c.totalSpent || 0, c.isBlacklisted ? 1 : 0, c.loyaltyPoints || 0, c.profilePic
            ]
        );
        res.json({ id: result.lastID, custId: shortId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/customers/:id', async (req, res) => {
    try {
        const c = req.body;
        const updates = [];
        const params = [];
        for (const [key, val] of Object.entries(c)) {
            if (key === 'id') continue;
            updates.push(`${key} = ?`);
            params.push(key === 'isBlacklisted' ? (val ? 1 : 0) : val);
        }
        params.push(req.params.id);
        if (updates.length > 0) {
            await runQuery(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/customers/:id', async (req, res) => {
    try {
        await runQuery("DELETE FROM customers WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- CATEGORIES ----------------
app.get('/api/categories', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM categories");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', async (req, res) => {
    try {
        const { name, description } = req.body;
        const result = await runQuery("INSERT INTO categories (name, description) VALUES (?, ?)", [name, description]);
        res.json({ id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- EXPENSES ----------------
app.get('/api/expenses', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM expenses ORDER BY date DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/expenses', async (req, res) => {
    try {
        const e = req.body;
        const result = await runQuery(
            "INSERT INTO expenses (reason, amount, date) VALUES (?, ?, ?)",
            [e.reason, e.amount, e.date || new Date().toISOString()]
        );
        res.json({ id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        await runQuery("DELETE FROM expenses WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- AUTHENTICATION ----------------
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUser = username.trim().toLowerCase();
        const cleanPass = password.trim();

        const user = await getQuery("SELECT * FROM users WHERE username = ?", [cleanUser]);
        if (user && user.password === cleanPass) {
            res.json({
                username: user.username,
                role: user.role,
                name: user.name,
                loginTime: new Date().toISOString()
            });
        } else {
            res.status(401).json({ error: "Invalid username or password" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- RESTORE FULL SYSTEM ----------------
app.post('/api/system/restore', async (req, res) => {
    try {
        const data = req.body;
        
        // Wrap everything in a transaction helper or run sequentially
        db.serialize(async () => {
            db.run("BEGIN TRANSACTION");
            try {
                if (data.inventory) {
                    db.run("DELETE FROM inventory");
                    const stmt = db.prepare("INSERT INTO inventory (id, name, category, type, stock, buyPrice, sellPrice, size, packageItems) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    for (const item of data.inventory) {
                        stmt.run([item.id, item.name, item.category, item.type, item.stock, item.buyPrice, item.sellPrice, item.size, JSON.stringify(item.packageItems || null)]);
                    }
                    stmt.finalize();
                }
                if (data.sales) {
                    db.run("DELETE FROM sales");
                    const stmt = db.prepare("INSERT INTO sales (id, total, buyTotal, date, customer, paymentMethod, items, discount, delivery, loyaltyDiscount, customerId, customerPhone, orderId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    for (const s of data.sales) {
                        stmt.run([s.id, s.total, s.buyTotal, s.date, s.customer, s.paymentMethod, JSON.stringify(s.items || []), s.discount, s.delivery, s.loyaltyDiscount, s.customerId, s.customerPhone, s.orderId]);
                    }
                    stmt.finalize();
                }
                if (data.orders) {
                    db.run("DELETE FROM orders");
                    const stmt = db.prepare("INSERT INTO orders (id, orderId, customer, phone, address, items, total, status, deliveryStatus, deliveryMethod, paymentStatus, date, buyTotal, discount, delivery, loyaltyDiscount, customerId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    for (const o of data.orders) {
                        stmt.run([o.id, o.orderId, o.customer, o.phone, o.address, JSON.stringify(o.items || []), o.total, o.status, o.deliveryStatus, o.deliveryMethod, o.paymentStatus, o.date, o.buyTotal, o.discount, o.delivery, o.loyaltyDiscount, o.customerId]);
                    }
                    stmt.finalize();
                }
                if (data.customers) {
                    db.run("DELETE FROM customers");
                    const stmt = db.prepare("INSERT INTO customers (id, custId, name, phone, address, totalOrders, totalSpent, isBlacklisted, loyaltyPoints, profilePic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    for (const c of data.customers) {
                        stmt.run([c.id, c.custId, c.name, c.phone, c.address, c.totalOrders, c.totalSpent, c.isBlacklisted ? 1 : 0, c.loyaltyPoints, c.profilePic]);
                    }
                    stmt.finalize();
                }
                if (data.categories) {
                    db.run("DELETE FROM categories");
                    const stmt = db.prepare("INSERT INTO categories (id, name, description) VALUES (?, ?, ?)");
                    for (const c of data.categories) {
                        stmt.run([c.id, c.name, c.description]);
                    }
                    stmt.finalize();
                }
                if (data.notes) {
                    db.run("DELETE FROM notes");
                    const stmt = db.prepare("INSERT INTO notes (id, title, content, date) VALUES (?, ?, ?, ?)");
                    for (const n of data.notes) {
                        stmt.run([n.id, n.title, n.content, n.date]);
                    }
                    stmt.finalize();
                }
                if (data.expenses) {
                    db.run("DELETE FROM expenses");
                    const stmt = db.prepare("INSERT INTO expenses (id, reason, amount, date) VALUES (?, ?, ?, ?)");
                    for (const e of data.expenses) {
                        stmt.run([e.id, e.reason, e.amount, e.date]);
                    }
                    stmt.finalize();
                }
                db.run("COMMIT");
                res.json({ success: true });
            } catch (txErr) {
                db.run("ROLLBACK");
                console.error("Restore transaction failed:", txErr);
                res.status(500).json({ error: txErr.message });
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running locally at http://localhost:${PORT}`);
    
    // Print local network IP addresses so other devices on the same Wi-Fi can connect
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            // Skip over non-IPv4 and internal (127.0.0.1) addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`Access from other devices on the same network: http://${iface.address}:${PORT}`);
            }
        }
    }
});
