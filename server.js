const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Set permissive headers for mobile & ngrok access
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning');
    res.setHeader('ngrok-skip-browser-warning', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Serve static files from the project root
app.use(express.static(__dirname));

// Turso Cloud Database Configuration
const { createClient } = require('@libsql/client');
const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://roohira-collection-pos-onija2008.aws-ap-southeast-2.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTE2NTg3ODMsImlkIjoiMDFhMTI3MmUtOWYwMS03MWVhLTgxYWItZDdmYTFmZDc2NjExIiwia2lkIjoiS1hHUWlZMkViZk1GazdDbGdxVlBmZjZzMHVUd25xekMtaUZDS3ZUdFJDNCIsInJpZCI6IjAyMGExMWFkLTA4MzAtNDY5YS1hOWE1LTU3NjRhNThlNzM2MiJ9.vTVE-iYOoSLkcACa3cVv0PPxhLNYd0mmdwYgo1L9d4XVDhxcKAPr_KAHu9L3uJFIoiXPuGzI-btTQm68n945Bw';

let turso = null;
try {
    if (TURSO_URL && TURSO_TOKEN) {
        turso = createClient({
            url: TURSO_URL,
            authToken: TURSO_TOKEN
        });
        console.log(' Connected to Turso Online Cloud Database successfully! (' + TURSO_URL + ')');
    }
} catch (tErr) {
    console.error('Failed to initialize Turso client, falling back to local SQLite:', tErr);
}

// Open SQLite database (always initialized as fallback or local cache)
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening SQLite database:', err);
    } else {
        console.log('Connected to Local SQLite database at:', dbPath);
    }
});

// Initialize SQLite database tables
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

    const inventoryExtraCols = [
        "ALTER TABLE inventory ADD COLUMN barcode TEXT",
        "ALTER TABLE inventory ADD COLUMN colour TEXT",
        "ALTER TABLE inventory ADD COLUMN color TEXT"
    ];
    inventoryExtraCols.forEach(sql => db.run(sql, [], () => {}));

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

    const salesExtraCols = [
        "ALTER TABLE sales ADD COLUMN weight TEXT",
        "ALTER TABLE sales ADD COLUMN trackingNo TEXT",
        "ALTER TABLE sales ADD COLUMN deliveryMethod TEXT",
        "ALTER TABLE sales ADD COLUMN address TEXT",
        "ALTER TABLE sales ADD COLUMN city TEXT",
        "ALTER TABLE sales ADD COLUMN received REAL",
        "ALTER TABLE sales ADD COLUMN balance REAL",
        "ALTER TABLE sales ADD COLUMN cardDiscount REAL",
        "ALTER TABLE sales ADD COLUMN advancePaid REAL",
        "ALTER TABLE sales ADD COLUMN balanceDue REAL",
        "ALTER TABLE sales ADD COLUMN pointsEarned REAL",
        "ALTER TABLE sales ADD COLUMN totalPoints REAL"
    ];
    salesExtraCols.forEach(sql => db.run(sql, [], () => {}));

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
        customerId TEXT,
        cardDiscount REAL,
        paymentMethod TEXT
    )`);

    const ordersExtraCols = [
        "ALTER TABLE orders ADD COLUMN weight TEXT",
        "ALTER TABLE orders ADD COLUMN trackingNo TEXT",
        "ALTER TABLE orders ADD COLUMN city TEXT",
        "ALTER TABLE orders ADD COLUMN cardDiscount REAL",
        "ALTER TABLE orders ADD COLUMN paymentMethod TEXT",
        "ALTER TABLE orders ADD COLUMN advancePaid REAL",
        "ALTER TABLE orders ADD COLUMN balanceDue REAL",
        "ALTER TABLE orders ADD COLUMN received REAL",
        "ALTER TABLE orders ADD COLUMN balance REAL",
        "ALTER TABLE orders ADD COLUMN pointsEarned REAL",
        "ALTER TABLE orders ADD COLUMN totalPoints REAL"
    ];
    ordersExtraCols.forEach(sql => db.run(sql, [], () => {}));

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

    db.run(`CREATE TABLE IF NOT EXISTS waybills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT,
        trackingNo TEXT,
        date TEXT,
        senderName TEXT,
        senderAddress TEXT,
        senderPhone1 TEXT,
        senderPhone2 TEXT,
        senderPostcode TEXT,
        recipientName TEXT,
        recipientPhone1 TEXT,
        recipientPhone2 TEXT,
        recipientAddress TEXT,
        recipientCity TEXT,
        weight TEXT,
        courier TEXT,
        specialNotice TEXT,
        paymentMethod TEXT,
        totalAmount REAL,
        advancePaid REAL,
        amountToCollect REAL,
        items TEXT,
        status TEXT
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

    // Auto-seed SQLite from backup file if database is empty
    db.get("SELECT COUNT(*) as count FROM inventory", (err, row) => {
        if (err) return console.error("Error checking inventory count for seeding:", err);
        if (row && row.count === 0) {
            const backupFile = path.join(__dirname, 'RuhiraPOS_FULL_Backup_2026-05-14.json');
            if (fs.existsSync(backupFile)) {
                console.log("Empty SQLite database detected. Seeding data from backup file:", backupFile);
                try {
                    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
                    seedSQLite(backupData);
                } catch (parseErr) {
                    console.error("Failed to parse backup file for SQLite seeding:", parseErr);
                }
            }
        }
    });
});

// Helper function to seed SQLite
function seedSQLite(backupData) {
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
                const stmt = db.prepare("INSERT INTO sales (id, total, buyTotal, date, customer, paymentMethod, items, discount, delivery, loyaltyDiscount, customerId, customerPhone, orderId, weight, trackingNo, deliveryMethod, address, city, received, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                backupData.sales.forEach(s => {
                    stmt.run([s.id, s.total, s.buyTotal, s.date, s.customer, s.paymentMethod, JSON.stringify(s.items || []), s.discount || 0, s.delivery || 0, s.loyaltyDiscount || 0, s.customerId || 'Guest', s.customerPhone || 'N/A', s.orderId, s.weight || '', s.trackingNo || '', s.deliveryMethod || '', s.address || '', s.city || '', s.received || 0, s.balance || 0]);
                });
                stmt.finalize();
            }
            if (backupData.orders && backupData.orders.length) {
                const stmt = db.prepare("INSERT INTO orders (id, orderId, customer, phone, address, items, total, status, deliveryStatus, deliveryMethod, paymentStatus, date, buyTotal, discount, delivery, loyaltyDiscount, customerId, weight, trackingNo, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                backupData.orders.forEach(o => {
                    stmt.run([o.id, o.orderId, o.customer, o.phone, o.address, JSON.stringify(o.items || []), o.total, o.status, o.deliveryStatus, o.deliveryMethod, o.paymentStatus, o.date, o.buyTotal || 0, o.discount || 0, o.delivery || 0, o.loyaltyDiscount || 0, o.customerId || 'Guest', o.weight || '', o.trackingNo || '', o.city || '']);
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
                if (commitErr) console.error("Commit error during SQLite seeding:", commitErr);
                else console.log("SQLite Seeding complete!");
            });
        } catch (txErr) {
            db.run("ROLLBACK");
            console.error("Failed to seed SQLite database transaction:", txErr);
        }
    });
}



// Helper functions for Database queries (Turso Cloud with Local SQLite fallback)
const runQuery = async (sql, params = []) => {
    if (turso) {
        try {
            const res = await turso.execute({ sql, args: params });
            // Asynchronously sync to local SQLite so local db is always up-to-date
            try { db.run(sql, params, () => {}); } catch(e) {}
            return {
                lastID: res.lastInsertRowid !== undefined && res.lastInsertRowid !== null ? Number(res.lastInsertRowid) : undefined,
                changes: res.rowsAffected
            };
        } catch (tursoErr) {
            console.error("Turso runQuery error, falling back to local SQLite:", tursoErr.message);
        }
    }
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getQuery = async (sql, params = []) => {
    if (turso) {
        try {
            const res = await turso.execute({ sql, args: params });
            if (res.rows && res.rows.length > 0) {
                // Convert row object cleanly
                return { ...res.rows[0] };
            }
            return null;
        } catch (tursoErr) {
            console.error("Turso getQuery error, falling back to local SQLite:", tursoErr.message);
        }
    }
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const allQuery = async (sql, params = []) => {
    if (turso) {
        try {
            const res = await turso.execute({ sql, args: params });
            if (res.rows) {
                return res.rows.map(r => ({ ...r }));
            }
            return [];
        } catch (tursoErr) {
            console.error("Turso allQuery error, falling back to local SQLite:", tursoErr.message);
        }
    }
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// --- WIRELESS PHONE BARCODE SCANNER REAL-TIME ENDPOINTS ---
const os = require('os');

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

let scannerSSEClients = [];

app.get('/api/network-ip', (req, res) => {
    const ip = getLocalIpAddress();
    const port = PORT;
    res.json({ ip, port, scannerUrl: `http://${ip}:${port}/scanner.html` });
});

app.get('/api/scanner/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    scannerSSEClients.push(res);
    console.log(`[Scanner SSE] PC POS Client connected. Active clients: ${scannerSSEClients.length}`);

    req.on('close', () => {
        scannerSSEClients = scannerSSEClients.filter(client => client !== res);
        console.log(`[Scanner SSE] PC POS Client disconnected. Active clients: ${scannerSSEClients.length}`);
    });
});

app.post('/api/scanner/scan', (req, res) => {
    const { barcode } = req.body;
    if (!barcode) {
        return res.status(400).json({ error: 'Barcode is required' });
    }

    const cleanBarcode = String(barcode).trim();
    console.log(`[Scanner API] Received barcode from phone: "${cleanBarcode}"`);

    const payload = JSON.stringify({ barcode: cleanBarcode, timestamp: Date.now() });
    scannerSSEClients.forEach(client => {
        try {
            client.write(`data: ${payload}\n\n`);
        } catch(e) {}
    });

    res.json({ success: true, barcode: cleanBarcode, clientsNotified: scannerSSEClients.length });
});

let realtimeSSEClients = [];

app.get('/api/realtime/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    realtimeSSEClients.push(res);

    req.on('close', () => {
        realtimeSSEClients = realtimeSSEClients.filter(client => client !== res);
    });
});

function broadcastRealtimeEvent(event, data = {}) {
    const payload = JSON.stringify({ event, data, timestamp: Date.now() });
    realtimeSSEClients.forEach(client => {
        try {
            client.write(`data: ${payload}\n\n`);
        } catch(e) {}
    });
}

// Database Abstraction Layer (DB Service)
const dbService = {
    isFirebase: () => false,

    // Notes
    getNotes: async () => {
        if (dbService.isFirebase()) {
            const snapshot = await firestoreDb.collection('notes').orderBy('date', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            return await allQuery("SELECT * FROM notes ORDER BY date DESC");
        }
    },
    addNote: async (note) => {
        if (dbService.isFirebase()) {
            const data = {
                title: note.title,
                content: note.content,
                date: note.date || new Date().toISOString()
            };
            const docRef = await firestoreDb.collection('notes').add(data);
            return { id: docRef.id };
        } else {
            const result = await runQuery(
                "INSERT INTO notes (title, content, date) VALUES (?, ?, ?)",
                [note.title, note.content, note.date || new Date().toISOString()]
            );
            return { id: result.lastID };
        }
    },
    deleteNote: async (id) => {
        if (dbService.isFirebase()) {
            await firestoreDb.collection('notes').doc(String(id)).delete();
            return { success: true };
        } else {
            await runQuery("DELETE FROM notes WHERE id = ?", [id]);
            return { success: true };
        }
    },

    // Orders
    getOrders: async () => {
        if (dbService.isFirebase()) {
            const snapshot = await firestoreDb.collection('orders').orderBy('date', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            const rows = await allQuery("SELECT * FROM orders ORDER BY date DESC");
            return rows.map(r => {
                let parsedItems = [];
                if (r.items) {
                    if (typeof r.items === 'string') {
                        try { parsedItems = JSON.parse(r.items); } catch(e) { parsedItems = []; }
                    } else if (Array.isArray(r.items)) {
                        parsedItems = r.items;
                    }
                }
                return {
                    ...r,
                    items: parsedItems
                };
            });
        }
    },
    getOrder: async (id) => {
        if (dbService.isFirebase()) {
            const doc = await firestoreDb.collection('orders').doc(String(id)).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } else {
            const row = await getQuery("SELECT * FROM orders WHERE id = ?", [id]);
            if (row) {
                let parsedItems = [];
                if (row.items) {
                    if (typeof row.items === 'string') {
                        try { parsedItems = JSON.parse(row.items); } catch(e) { parsedItems = []; }
                    } else if (Array.isArray(row.items)) {
                        parsedItems = row.items;
                    }
                }
                row.items = parsedItems;
            }
            return row || null;
        }
    },
    addOrder: async (o) => {
        if (dbService.isFirebase()) {
            const data = {
                orderId: o.orderId || '',
                customer: o.customer || '',
                phone: o.phone || '',
                address: o.address || '',
                items: o.items || [],
                total: Number(o.total) || 0,
                status: o.status || 'Pending',
                deliveryStatus: o.deliveryStatus || 'Pending',
                deliveryMethod: o.deliveryMethod || '',
                paymentStatus: o.paymentStatus || 'unpaid',
                paymentMethod: o.paymentMethod || 'cash',
                date: o.date || new Date().toISOString(),
                buyTotal: Number(o.buyTotal) || 0,
                discount: Number(o.discount) || 0,
                delivery: Number(o.delivery) || 0,
                loyaltyDiscount: Number(o.loyaltyDiscount) || 0,
                cardDiscount: Number(o.cardDiscount) || 0,
                customerId: o.customerId || 'Guest',
                weight: o.weight || '',
                trackingNo: o.trackingNo || '',
                city: o.city || '',
                advancePaid: Number(o.advancePaid) || 0,
                balanceDue: Number(o.balanceDue) || 0,
                received: Number(o.received) || 0,
                balance: Number(o.balance) || 0,
                pointsEarned: Number(o.pointsEarned) || 0,
                totalPoints: Number(o.totalPoints) || 0
            };
            const docRef = await firestoreDb.collection('orders').add(data);
            return { id: docRef.id };
        } else {
            const result = await runQuery(
                `INSERT INTO orders (orderId, customer, phone, address, items, total, status, deliveryStatus, deliveryMethod, paymentStatus, paymentMethod, date, buyTotal, discount, delivery, loyaltyDiscount, cardDiscount, customerId, weight, trackingNo, city, advancePaid, balanceDue, received, balance, pointsEarned, totalPoints)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    o.orderId, o.customer, o.phone, o.address, JSON.stringify(o.items || []), o.total,
                    o.status, o.deliveryStatus, o.deliveryMethod, o.paymentStatus, o.paymentMethod || 'cash', o.date || new Date().toISOString(),
                    o.buyTotal, o.discount, o.delivery, o.loyaltyDiscount, o.cardDiscount || 0, o.customerId, o.weight || '', o.trackingNo || '', o.city || '',
                    Number(o.advancePaid) || 0, Number(o.balanceDue) || 0, Number(o.received) || 0, Number(o.balance) || 0,
                    Number(o.pointsEarned) || 0, Number(o.totalPoints) || 0
                ]
            );
            return { id: result.lastID };
        }
    },
    updateOrder: async (id, o) => {
        if (dbService.isFirebase()) {
            const cleanData = {};
            const VALID_COLS = ['orderId','customer','phone','address','items','total','status','deliveryStatus','deliveryMethod','paymentStatus','paymentMethod','date','buyTotal','discount','delivery','loyaltyDiscount','cardDiscount','customerId','weight','trackingNo','city','advancePaid','balanceDue','received','balance','pointsEarned','totalPoints'];
            for (const [key, val] of Object.entries(o)) {
                if (VALID_COLS.includes(key)) {
                    cleanData[key] = val;
                }
            }
            await firestoreDb.collection('orders').doc(String(id)).update(cleanData);
            return { success: true };
        } else {
            const VALID_COLS = ['orderId','customer','phone','address','items','total','status','deliveryStatus','deliveryMethod','paymentStatus','paymentMethod','date','buyTotal','discount','delivery','loyaltyDiscount','cardDiscount','customerId','weight','trackingNo','city','advancePaid','balanceDue','received','balance','pointsEarned','totalPoints'];
            const updates = [];
            const params = [];
            for (const [key, val] of Object.entries(o)) {
                if (key === 'id' || !VALID_COLS.includes(key)) continue;
                updates.push(`${key} = ?`);
                params.push(key === 'items' ? JSON.stringify(val) : val);
            }
            params.push(id);
            if (updates.length > 0) {
                params.push(id);
                await runQuery(`UPDATE orders SET ${updates.join(', ')} WHERE id = ? OR orderId = ?`, params);
            }
            return { success: true };
        }
    },
    deleteOrder: async (id) => {
        if (dbService.isFirebase()) {
            await firestoreDb.collection('orders').doc(String(id)).delete();
            return { success: true };
        } else {
            await runQuery("DELETE FROM orders WHERE id = ? OR orderId = ?", [id, id]);
            return { success: true };
        }
    },

    // Settings
    getSetting: async (key) => {
        if (dbService.isFirebase()) {
            const doc = await firestoreDb.collection('settings').doc(key).get();
            return doc.exists ? doc.data().value : null;
        } else {
            const row = await getQuery("SELECT value FROM settings WHERE key = ?", [key]);
            return row ? row.value : null;
        }
    },
    setSetting: async (key, value) => {
        if (dbService.isFirebase()) {
            await firestoreDb.collection('settings').doc(key).set({ value });
            return { success: true };
        } else {
            await runQuery("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
            return { success: true };
        }
    },

    // Inventory
    getInventory: async () => {
        if (dbService.isFirebase()) {
            const snapshot = await firestoreDb.collection('inventory').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            const rows = await allQuery("SELECT * FROM inventory");
            return rows.map(r => ({
                ...r,
                packageItems: r.packageItems ? JSON.parse(r.packageItems) : null
            }));
        }
    },
    getItem: async (id) => {
        if (dbService.isFirebase()) {
            const doc = await firestoreDb.collection('inventory').doc(String(id)).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } else {
            const row = await getQuery("SELECT * FROM inventory WHERE id = ?", [id]);
            if (row) {
                row.packageItems = row.packageItems ? JSON.parse(row.packageItems) : null;
            }
            return row || null;
        }
    },
    addItem: async (i) => {
        if (dbService.isFirebase()) {
            const data = {
                name: i.name || '',
                category: i.category || '',
                type: i.type || '',
                stock: Number(i.stock) || 0,
                buyPrice: Number(i.buyPrice) || 0,
                sellPrice: Number(i.sellPrice) || 0,
                size: i.size || '',
                packageItems: i.packageItems || null
            };
            const docRef = await firestoreDb.collection('inventory').add(data);
            return { id: docRef.id };
        } else {
            const result = await runQuery(
                `INSERT INTO inventory (name, category, type, stock, buyPrice, sellPrice, size, packageItems)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [i.name, i.category, i.type, i.stock, i.buyPrice, i.sellPrice, i.size, JSON.stringify(i.packageItems || null)]
            );
            return { id: result.lastID };
        }
    },
    updateItem: async (id, i) => {
        if (dbService.isFirebase()) {
            const cleanData = {};
            const VALID_KEYS = ['name', 'category', 'type', 'stock', 'buyPrice', 'sellPrice', 'size', 'packageItems'];
            for (const [key, val] of Object.entries(i)) {
                if (VALID_KEYS.includes(key)) {
                    cleanData[key] = val;
                }
            }
            await firestoreDb.collection('inventory').doc(String(id)).update(cleanData);
            return { success: true };
        } else {
            const updates = [];
            const params = [];
            for (const [key, val] of Object.entries(i)) {
                if (key === 'id') continue;
                updates.push(`${key} = ?`);
                params.push(key === 'packageItems' ? JSON.stringify(val) : val);
            }
            params.push(id);
            if (updates.length > 0) {
                await runQuery(`UPDATE inventory SET ${updates.join(', ')} WHERE id = ?`, params);
            }
            return { success: true };
        }
    },
    deleteItem: async (id) => {
        if (dbService.isFirebase()) {
            await firestoreDb.collection('inventory').doc(String(id)).delete();
            return { success: true };
        } else {
            await runQuery("DELETE FROM inventory WHERE id = ?", [id]);
            return { success: true };
        }
    },

    // Sales
    getSales: async () => {
        if (dbService.isFirebase()) {
            const snapshot = await firestoreDb.collection('sales').orderBy('date', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            const rows = await allQuery("SELECT * FROM sales ORDER BY date DESC");
            return rows.map(r => {
                let parsedItems = [];
                if (r.items) {
                    if (typeof r.items === 'string') {
                        try { parsedItems = JSON.parse(r.items); } catch(e) { parsedItems = []; }
                    } else if (Array.isArray(r.items)) {
                        parsedItems = r.items;
                    }
                }
                return {
                    ...r,
                    items: parsedItems
                };
            });
        }
    },
    getSale: async (id) => {
        if (dbService.isFirebase()) {
            const doc = await firestoreDb.collection('sales').doc(String(id)).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } else {
            const row = await getQuery("SELECT * FROM sales WHERE id = ?", [id]);
            if (row) {
                let parsedItems = [];
                if (row.items) {
                    if (typeof row.items === 'string') {
                        try { parsedItems = JSON.parse(row.items); } catch(e) { parsedItems = []; }
                    } else if (Array.isArray(row.items)) {
                        parsedItems = row.items;
                    }
                }
                row.items = parsedItems;
            }
            return row || null;
        }
    },
    addSale: async (s) => {
        if (dbService.isFirebase()) {
            const data = {
                total: Number(s.total) || 0,
                buyTotal: Number(s.buyTotal) || 0,
                date: s.date || new Date().toISOString(),
                customer: s.customer || 'Guest',
                paymentMethod: s.paymentMethod || 'cash',
                items: s.items || [],
                discount: Number(s.discount) || 0,
                delivery: Number(s.delivery) || 0,
                loyaltyDiscount: Number(s.loyaltyDiscount) || 0,
                cardDiscount: Number(s.cardDiscount) || 0,
                customerId: s.customerId || 'Guest',
                customerPhone: s.customerPhone || 'N/A',
                orderId: s.orderId || '',
                received: Number(s.received) || 0,
                balance: Number(s.balance) || 0,
                weight: s.weight || '',
                trackingNo: s.trackingNo || '',
                deliveryMethod: s.deliveryMethod || '',
                address: s.address || '',
                city: s.city || '',
                advancePaid: s.advancePaid !== undefined && s.advancePaid !== null && s.advancePaid !== '' ? Number(s.advancePaid) : null,
                balanceDue: s.balanceDue !== undefined && s.balanceDue !== null && s.balanceDue !== '' ? Number(s.balanceDue) : null,
                pointsEarned: Number(s.pointsEarned) || 0,
                totalPoints: Number(s.totalPoints) || 0
            };
            const docRef = await firestoreDb.collection('sales').add(data);
            return { id: docRef.id };
        } else {
            const result = await runQuery(
                `INSERT INTO sales (total, buyTotal, date, customer, paymentMethod, items, discount, delivery, loyaltyDiscount, cardDiscount, customerId, customerPhone, orderId, weight, trackingNo, deliveryMethod, address, city, received, balance, advancePaid, balanceDue, pointsEarned, totalPoints)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    s.total, s.buyTotal, s.date || new Date().toISOString(), s.customer, s.paymentMethod,
                    JSON.stringify(s.items || []), s.discount, s.delivery, s.loyaltyDiscount, s.cardDiscount || 0, s.customerId, s.customerPhone, s.orderId,
                    s.weight || '', s.trackingNo || '', s.deliveryMethod || '', s.address || '', s.city || '', s.received || 0, s.balance || 0,
                    (s.advancePaid !== undefined && s.advancePaid !== null && s.advancePaid !== '') ? Number(s.advancePaid) : null,
                    (s.balanceDue !== undefined && s.balanceDue !== null && s.balanceDue !== '') ? Number(s.balanceDue) : null,
                    Number(s.pointsEarned) || 0, Number(s.totalPoints) || 0
                ]
            );
            return { id: result.lastID };
        }
    },
    updateSale: async (id, s) => {
        if (dbService.isFirebase()) {
            const cleanData = {};
            const VALID_COLS = ['total','buyTotal','date','customer','paymentMethod','items','discount','delivery','loyaltyDiscount','cardDiscount','customerId','customerPhone','orderId','received','balance','weight','trackingNo','deliveryMethod','address','city','advancePaid','balanceDue','pointsEarned','totalPoints'];
            for (const [key, val] of Object.entries(s)) {
                if (VALID_COLS.includes(key)) {
                    cleanData[key] = val;
                }
            }
            await firestoreDb.collection('sales').doc(String(id)).update(cleanData);
            return { success: true };
        } else {
            const VALID_COLS = ['total','buyTotal','date','customer','paymentMethod','items','discount','delivery','loyaltyDiscount','cardDiscount','customerId','customerPhone','orderId','received','balance','weight','trackingNo','deliveryMethod','address','city','advancePaid','balanceDue','pointsEarned','totalPoints'];
            const updates = [];
            const params = [];
            for (const [key, val] of Object.entries(s)) {
                if (key === 'id' || !VALID_COLS.includes(key)) continue;
                updates.push(`${key} = ?`);
                params.push(key === 'items' ? JSON.stringify(val) : val);
            }
            params.push(id);
            if (updates.length > 0) {
                await runQuery(`UPDATE sales SET ${updates.join(', ')} WHERE id = ?`, params);
            }
            return { success: true };
        }
    },
    deleteSale: async (id) => {
        if (dbService.isFirebase()) {
            await firestoreDb.collection('sales').doc(String(id)).delete();
            return { success: true };
        } else {
            await runQuery("DELETE FROM sales WHERE id = ?", [id]);
            return { success: true };
        }
    },

    // Customers
    getCustomers: async () => {
        if (dbService.isFirebase()) {
            const snapshot = await firestoreDb.collection('customers').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            return await allQuery("SELECT * FROM customers");
        }
    },
    addCustomer: async (c) => {
        if (dbService.isFirebase()) {
            // Generate customer ID based on count
            const snapshot = await firestoreDb.collection('customers').get();
            const count = snapshot.size;
            const shortId = 'CUS-' + (100 + count + 1);

            const data = {
                custId: shortId,
                name: c.name || '',
                phone: c.phone || '',
                address: c.address || '',
                totalOrders: Number(c.totalOrders) || 0,
                totalSpent: Number(c.totalSpent) || 0,
                isBlacklisted: c.isBlacklisted ? 1 : 0,
                loyaltyPoints: Number(c.loyaltyPoints) || 0,
                profilePic: c.profilePic || ''
            };
            const docRef = await firestoreDb.collection('customers').add(data);
            return { id: docRef.id, custId: shortId };
        } else {
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
            return { id: result.lastID, custId: shortId };
        }
    },
    updateCustomer: async (id, c) => {
        if (dbService.isFirebase()) {
            const oldCustDoc = await firestoreDb.collection('customers').doc(String(id)).get();
            const oldCust = oldCustDoc.exists ? oldCustDoc.data() : null;

            const cleanData = {};
            const VALID_KEYS = ['name', 'phone', 'address', 'totalOrders', 'totalSpent', 'isBlacklisted', 'loyaltyPoints', 'profilePic'];
            for (const [key, val] of Object.entries(c)) {
                if (VALID_KEYS.includes(key)) {
                    cleanData[key] = key === 'isBlacklisted' ? (val ? 1 : 0) : val;
                }
            }
            await firestoreDb.collection('customers').doc(String(id)).update(cleanData);

            if (oldCust && c.name && c.name !== oldCust.name) {
                const salesSnapshot = await firestoreDb.collection('sales').where('customerId', '==', oldCust.custId).get();
                const salesBatch = firestoreDb.batch();
                salesSnapshot.docs.forEach(doc => {
                    salesBatch.update(doc.ref, { customer: c.name, customerPhone: c.phone || doc.data().customerPhone || '' });
                });
                await salesBatch.commit();

                const ordersSnapshot = await firestoreDb.collection('orders').where('customerId', '==', oldCust.custId).get();
                const ordersBatch = firestoreDb.batch();
                ordersSnapshot.docs.forEach(doc => {
                    ordersBatch.update(doc.ref, { customer: c.name, phone: c.phone || doc.data().phone || '' });
                });
                await ordersBatch.commit();
            }
            return { success: true };
        } else {
            const oldCust = await getQuery("SELECT name, custId, phone FROM customers WHERE id = ?", [id]);

            const updates = [];
            const params = [];
            for (const [key, val] of Object.entries(c)) {
                if (key === 'id') continue;
                updates.push(`${key} = ?`);
                params.push(key === 'isBlacklisted' ? (val ? 1 : 0) : val);
            }
            params.push(id);
            if (updates.length > 0) {
                await runQuery(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, params);
            }

            if (oldCust && c.name && c.name !== oldCust.name) {
                await runQuery("UPDATE sales SET customer = ? WHERE customerId = ? OR (customerId IS NULL AND customer = ?)", [c.name, oldCust.custId, oldCust.name]);
                await runQuery("UPDATE orders SET customer = ? WHERE customerId = ? OR (customerId IS NULL AND customer = ?)", [c.name, oldCust.custId, oldCust.name]);
            }
            if (oldCust && c.phone && c.phone !== oldCust.phone) {
                await runQuery("UPDATE sales SET customerPhone = ? WHERE customerId = ?", [c.phone, oldCust.custId]);
                await runQuery("UPDATE orders SET phone = ? WHERE customerId = ?", [c.phone, oldCust.custId]);
            }
            return { success: true };
        }
    },
    deleteCustomer: async (id) => {
        if (dbService.isFirebase()) {
            await firestoreDb.collection('customers').doc(String(id)).delete();
            return { success: true };
        } else {
            await runQuery("DELETE FROM customers WHERE id = ?", [id]);
            return { success: true };
        }
    },

    // Categories
    getCategories: async () => {
        if (dbService.isFirebase()) {
            const snapshot = await firestoreDb.collection('categories').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            return await allQuery("SELECT * FROM categories");
        }
    },
    addCategory: async (c) => {
        if (dbService.isFirebase()) {
            const data = {
                name: c.name || '',
                description: c.description || ''
            };
            const docRef = await firestoreDb.collection('categories').add(data);
            return { id: docRef.id };
        } else {
            const result = await runQuery("INSERT INTO categories (name, description) VALUES (?, ?)", [c.name, c.description]);
            return { id: result.lastID };
        }
    },
    deleteCategory: async (id) => {
        if (dbService.isFirebase()) {
            await firestoreDb.collection('categories').doc(String(id)).delete();
            return { success: true };
        } else {
            await runQuery("DELETE FROM categories WHERE id = ?", [id]);
            return { success: true };
        }
    },

    // Expenses
    getExpenses: async () => {
        if (dbService.isFirebase()) {
            const snapshot = await firestoreDb.collection('expenses').orderBy('date', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            return await allQuery("SELECT * FROM expenses ORDER BY date DESC");
        }
    },
    addExpense: async (e) => {
        if (dbService.isFirebase()) {
            const data = {
                reason: e.reason || '',
                amount: Number(e.amount) || 0,
                date: e.date || new Date().toISOString()
            };
            const docRef = await firestoreDb.collection('expenses').add(data);
            return { id: docRef.id };
        } else {
            const result = await runQuery(
                "INSERT INTO expenses (reason, amount, date) VALUES (?, ?, ?)",
                [e.reason, e.amount, e.date || new Date().toISOString()]
            );
            return { id: result.lastID };
        }
    },
    deleteExpense: async (id) => {
        if (dbService.isFirebase()) {
            await firestoreDb.collection('expenses').doc(String(id)).delete();
            return { success: true };
        } else {
            await runQuery("DELETE FROM expenses WHERE id = ?", [id]);
            return { success: true };
        }
    },

    // Waybills
    getWaybills: async () => {
        if (dbService.isFirebase()) {
            const snapshot = await firestoreDb.collection('waybills').orderBy('date', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            const rows = await allQuery("SELECT * FROM waybills ORDER BY id DESC");
            return rows.map(r => ({
                ...r,
                items: r.items ? (typeof r.items === 'string' ? JSON.parse(r.items) : r.items) : []
            }));
        }
    },
    addWaybill: async (w) => {
        const itemsJson = typeof w.items === 'object' ? JSON.stringify(w.items) : (w.items || '[]');
        if (dbService.isFirebase()) {
            const data = {
                orderId: w.orderId || '',
                trackingNo: w.trackingNo || '',
                date: w.date || new Date().toISOString(),
                senderName: w.senderName || 'Roohira Collection',
                senderAddress: w.senderAddress || '65/11,Sooriyapaluwa,Eldeniya,Kadawatha',
                senderPhone1: w.senderPhone1 || '075 721 8786',
                senderPhone2: w.senderPhone2 || '072 905 7972',
                senderPostcode: w.senderPostcode || '11850',
                recipientName: w.recipientName || '',
                recipientPhone1: w.recipientPhone1 || '',
                recipientPhone2: w.recipientPhone2 || '',
                recipientAddress: w.recipientAddress || '',
                recipientCity: w.recipientCity || '',
                weight: w.weight || '0.5kg',
                courier: w.courier || '',
                specialNotice: w.specialNotice || '',
                paymentMethod: w.paymentMethod || 'COD',
                totalAmount: Number(w.totalAmount) || 0,
                advancePaid: Number(w.advancePaid) || 0,
                amountToCollect: Number(w.amountToCollect) || 0,
                items: w.items || [],
                status: w.status || 'Generated'
            };
            const docRef = await firestoreDb.collection('waybills').add(data);
            return { id: docRef.id };
        } else {
            const result = await runQuery(
                `INSERT INTO waybills (
                    orderId, trackingNo, date, senderName, senderAddress, senderPhone1, senderPhone2,
                    senderPostcode, recipientName, recipientPhone1, recipientPhone2, recipientAddress,
                    recipientCity, weight, courier, specialNotice, paymentMethod, totalAmount,
                    advancePaid, amountToCollect, items, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    w.orderId || '',
                    w.trackingNo || '',
                    w.date || new Date().toISOString(),
                    w.senderName || 'Roohira Collection',
                    w.senderAddress || '65/11,Sooriyapaluwa,Eldeniya,Kadawatha',
                    w.senderPhone1 || '075 721 8786',
                    w.senderPhone2 || '072 905 7972',
                    w.senderPostcode || '11850',
                    w.recipientName || '',
                    w.recipientPhone1 || '',
                    w.recipientPhone2 || '',
                    w.recipientAddress || '',
                    w.recipientCity || '',
                    w.weight || '0.5kg',
                    w.courier || '',
                    w.specialNotice || '',
                    w.paymentMethod || 'COD',
                    Number(w.totalAmount) || 0,
                    Number(w.advancePaid) || 0,
                    Number(w.amountToCollect) || 0,
                    itemsJson,
                    w.status || 'Generated'
                ]
            );
            return { id: result.lastID };
        }
    },
    deleteWaybill: async (id) => {
        if (dbService.isFirebase()) {
            await firestoreDb.collection('waybills').doc(String(id)).delete();
            return { success: true };
        } else {
            await runQuery("DELETE FROM waybills WHERE id = ?", [id]);
            return { success: true };
        }
    },

    // Users (Auth)
    getUser: async (username) => {
        if (dbService.isFirebase()) {
            const doc = await firestoreDb.collection('users').doc(username).get();
            return doc.exists ? doc.data() : null;
        } else {
            return await getQuery("SELECT * FROM users WHERE username = ?", [username]);
        }
    }
};

// API Endpoints

// ---------------- NOTES ----------------
app.get('/api/notes', async (req, res) => {
    try {
        const rows = await dbService.getNotes();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notes', async (req, res) => {
    try {
        const result = await dbService.addNote(req.body);
        broadcastRealtimeEvent('notes_changed', { type: 'add' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/notes/:id', async (req, res) => {
    try {
        const result = await dbService.deleteNote(req.params.id);
        broadcastRealtimeEvent('notes_changed', { type: 'delete' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- ORDERS ----------------
app.get('/api/orders', async (req, res) => {
    try {
        const rows = await dbService.getOrders();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const row = await dbService.getOrder(req.params.id);
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const result = await dbService.addOrder(req.body);
        broadcastRealtimeEvent('orders_changed', { type: 'add', id: result });
        broadcastRealtimeEvent('inventory_changed', { type: 'stock_update' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const result = await dbService.updateOrder(req.params.id, req.body);
        broadcastRealtimeEvent('orders_changed', { type: 'update', id: req.params.id });
        broadcastRealtimeEvent('inventory_changed', { type: 'stock_update' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        const result = await dbService.deleteOrder(req.params.id);
        broadcastRealtimeEvent('orders_changed', { type: 'delete', id: req.params.id });
        broadcastRealtimeEvent('inventory_changed', { type: 'stock_update' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- SETTINGS ----------------
app.get('/api/settings/:key', async (req, res) => {
    try {
        const value = await dbService.getSetting(req.params.key);
        res.json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        const result = await dbService.setSetting(key, value);
        broadcastRealtimeEvent('settings_changed', { key });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- INVENTORY ----------------
app.get('/api/inventory', async (req, res) => {
    try {
        const rows = await dbService.getInventory();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/inventory/:id', async (req, res) => {
    try {
        const row = await dbService.getItem(req.params.id);
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/inventory', async (req, res) => {
    try {
        const result = await dbService.addItem(req.body);
        broadcastRealtimeEvent('inventory_changed', { type: 'add' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/inventory/:id', async (req, res) => {
    try {
        const result = await dbService.updateItem(req.params.id, req.body);
        broadcastRealtimeEvent('inventory_changed', { type: 'update', id: req.params.id });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/inventory/:id', async (req, res) => {
    try {
        const result = await dbService.deleteItem(req.params.id);
        broadcastRealtimeEvent('inventory_changed', { type: 'delete', id: req.params.id });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- SALES ----------------
app.get('/api/sales', async (req, res) => {
    try {
        const rows = await dbService.getSales();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/sales/:id', async (req, res) => {
    try {
        const row = await dbService.getSale(req.params.id);
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sales', async (req, res) => {
    try {
        const result = await dbService.addSale(req.body);
        broadcastRealtimeEvent('sales_changed', { type: 'add', id: result });
        broadcastRealtimeEvent('inventory_changed', { type: 'stock_update' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/sales/:id', async (req, res) => {
    try {
        const result = await dbService.updateSale(req.params.id, req.body);
        broadcastRealtimeEvent('sales_changed', { type: 'update', id: req.params.id });
        broadcastRealtimeEvent('inventory_changed', { type: 'stock_update' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/sales/:id', async (req, res) => {
    try {
        const result = await dbService.deleteSale(req.params.id);
        broadcastRealtimeEvent('sales_changed', { type: 'delete', id: req.params.id });
        broadcastRealtimeEvent('inventory_changed', { type: 'stock_update' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- CUSTOMERS ----------------
app.get('/api/customers', async (req, res) => {
    try {
        const rows = await dbService.getCustomers();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/customers', async (req, res) => {
    try {
        const result = await dbService.addCustomer(req.body);
        broadcastRealtimeEvent('customers_changed', { type: 'add' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/customers/:id', async (req, res) => {
    try {
        const result = await dbService.updateCustomer(req.params.id, req.body);
        broadcastRealtimeEvent('customers_changed', { type: 'update', id: req.params.id });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/customers/:id', async (req, res) => {
    try {
        const result = await dbService.deleteCustomer(req.params.id);
        broadcastRealtimeEvent('customers_changed', { type: 'delete', id: req.params.id });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- CATEGORIES ----------------
app.get('/api/categories', async (req, res) => {
    try {
        const rows = await dbService.getCategories();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', async (req, res) => {
    try {
        const result = await dbService.addCategory(req.body);
        broadcastRealtimeEvent('categories_changed', { type: 'add' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    try {
        const result = await dbService.deleteCategory(req.params.id);
        broadcastRealtimeEvent('categories_changed', { type: 'delete' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- EXPENSES ----------------
app.get('/api/expenses', async (req, res) => {
    try {
        const rows = await dbService.getExpenses();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/expenses', async (req, res) => {
    try {
        const result = await dbService.addExpense(req.body);
        broadcastRealtimeEvent('expenses_changed', { type: 'add' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const result = await dbService.deleteExpense(req.params.id);
        broadcastRealtimeEvent('expenses_changed', { type: 'delete' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- WAYBILLS ----------------
app.get('/api/waybills', async (req, res) => {
    try {
        const rows = await dbService.getWaybills();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/waybills', async (req, res) => {
    try {
        const result = await dbService.addWaybill(req.body);
        broadcastRealtimeEvent('waybills_changed', { type: 'add' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/waybills/:id', async (req, res) => {
    try {
        const result = await dbService.deleteWaybill(req.params.id);
        broadcastRealtimeEvent('waybills_changed', { type: 'delete' });
        res.json(result);
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

        const user = await dbService.getUser(cleanUser);
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
        
        if (dbService.isFirebase()) {
            await seedFirebase(data);
            res.json({ success: true });
        } else {
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
                        const stmt = db.prepare("INSERT INTO sales (id, total, buyTotal, date, customer, paymentMethod, items, discount, delivery, loyaltyDiscount, customerId, customerPhone, orderId, weight, trackingNo, deliveryMethod, address, city, received, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                        for (const s of data.sales) {
                            stmt.run([s.id, s.total, s.buyTotal, s.date, s.customer, s.paymentMethod, JSON.stringify(s.items || []), s.discount, s.delivery, s.loyaltyDiscount, s.customerId, s.customerPhone, s.orderId, s.weight || '', s.trackingNo || '', s.deliveryMethod || '', s.address || '', s.city || '', s.received || 0, s.balance || 0]);
                        }
                        stmt.finalize();
                    }
                    if (data.orders) {
                        db.run("DELETE FROM orders");
                        const stmt = db.prepare("INSERT INTO orders (id, orderId, customer, phone, address, items, total, status, deliveryStatus, deliveryMethod, paymentStatus, date, buyTotal, discount, delivery, loyaltyDiscount, customerId, weight, trackingNo, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                        for (const o of data.orders) {
                            stmt.run([o.id, o.orderId, o.customer, o.phone, o.address, JSON.stringify(o.items || []), o.total, o.status, o.deliveryStatus, o.deliveryMethod, o.paymentStatus, o.date, o.buyTotal, o.discount, o.delivery, o.loyaltyDiscount, o.customerId, o.weight || '', o.trackingNo || '', o.city || '']);
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
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- SERVER INFO (Network IP & Cloud Domain) ----------------
app.get('/api/server-info', (req, res) => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    const cloudDomain = 'distant-oxygen-vice.ngrok-free.dev';
    res.json({
        port: PORT,
        ips,
        localhost: `http://localhost:${PORT}`,
        mobile: `http://${ips[0] || 'localhost'}:${PORT}/mobile.html`,
        cloudUrl: `https://${cloudDomain}`,
        cloudMobile: `https://${cloudDomain}/mobile.html`
    });
});

// Mobile App Route
app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'mobile.html'));
});

// Start Server if run directly
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running locally at http://localhost:${PORT}`);
        
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            for (const iface of interfaces) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    console.log(`Access from PC/Browser: http://${iface.address}:${PORT}`);
                    console.log(`📱 Access Mobile App from Phone: http://${iface.address}:${PORT}/mobile.html`);
                }
            }
        }
    });
}

module.exports = app;
