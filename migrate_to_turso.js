const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const TURSO_URL = 'libsql://roohira-collection-pos-onija2008.aws-ap-southeast-2.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTE2NTg3ODMsImlkIjoiMDFhMTI3MmUtOWYwMS03MWVhLTgxYWItZDdmYTFmZDc2NjExIiwia2lkIjoiS1hHUWlZMkViZk1GazdDbGdxVlBmZjZzMHVUd25xekMtaUZDS3ZUdFJDNCIsInJpZCI6IjAyMGExMWFkLTA4MzAtNDY5YS1hOWE1LTU3NjRhNThlNzM2MiJ9.vTVE-iYOoSLkcACa3cVv0PPxhLNYd0mmdwYgo1L9d4XVDhxcKAPr_KAHu9L3uJFIoiXPuGzI-btTQm68n945Bw';

const turso = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN
});

const localDb = new sqlite3.Database(path.join(__dirname, 'database.db'));

function queryLocal(sql) {
    return new Promise((resolve, reject) => {
        localDb.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function runMigration() {
    console.log("1. Connecting to Turso and creating tables...");

    await turso.execute(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT,
        role TEXT,
        name TEXT
    )`);

    await turso.execute(`CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        category TEXT,
        type TEXT,
        stock REAL,
        buyPrice REAL,
        sellPrice REAL,
        size TEXT,
        packageItems TEXT,
        barcode TEXT,
        colour TEXT,
        color TEXT
    )`);

    await turso.execute(`CREATE TABLE IF NOT EXISTS sales (
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
        orderId TEXT,
        weight TEXT,
        trackingNo TEXT,
        deliveryMethod TEXT,
        address TEXT,
        city TEXT,
        received REAL,
        balance REAL,
        cardDiscount REAL,
        advancePaid REAL,
        balanceDue REAL,
        pointsEarned REAL,
        totalPoints REAL
    )`);

    await turso.execute(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        description TEXT
    )`);

    await turso.execute(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT,
        customer TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        items TEXT,
        total REAL,
        buyTotal REAL,
        status TEXT,
        deliveryStatus TEXT,
        deliveryMethod TEXT,
        paymentMethod TEXT,
        paymentStatus TEXT,
        trackingNo TEXT,
        weight TEXT,
        discount REAL,
        delivery REAL,
        cardDiscount REAL,
        loyaltyDiscount REAL,
        date TEXT,
        received REAL,
        balance REAL,
        advancePaid REAL,
        balanceDue REAL,
        customerId TEXT,
        pointsEarned REAL,
        totalPoints REAL
    )`);

    await turso.execute(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        custId TEXT UNIQUE,
        name TEXT,
        phone TEXT,
        address TEXT,
        totalOrders INTEGER DEFAULT 0,
        totalSpent REAL DEFAULT 0,
        isBlacklisted INTEGER DEFAULT 0,
        loyaltyPoints REAL DEFAULT 0,
        profilePic TEXT
    )`);

    await turso.execute(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reason TEXT,
        amount REAL,
        date TEXT
    )`);

    await turso.execute(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        date TEXT
    )`);

    await turso.execute(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    await turso.execute(`CREATE TABLE IF NOT EXISTS waybills (
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

    console.log("2. Tables created successfully on Turso! Now transferring local data...");

    // Users
    const users = await queryLocal("SELECT * FROM users");
    for (const u of users) {
        await turso.execute({
            sql: "INSERT OR REPLACE INTO users (username, password, role, name) VALUES (?, ?, ?, ?)",
            args: [u.username, u.password, u.role, u.name]
        });
    }
    console.log(`- Users migrated: ${users.length}`);

    // Inventory
    const inventory = await queryLocal("SELECT * FROM inventory");
    for (const item of inventory) {
        await turso.execute({
            sql: `INSERT OR REPLACE INTO inventory (id, name, category, type, stock, buyPrice, sellPrice, size, packageItems, barcode, colour, color)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [item.id, item.name, item.category, item.type, item.stock, item.buyPrice, item.sellPrice, item.size, item.packageItems, item.barcode, item.colour, item.color]
        });
    }
    console.log(`- Inventory items migrated: ${inventory.length}`);

    // Categories
    const categories = await queryLocal("SELECT * FROM categories");
    for (const cat of categories) {
        await turso.execute({
            sql: "INSERT OR REPLACE INTO categories (id, name, description) VALUES (?, ?, ?)",
            args: [cat.id, cat.name, cat.description]
        });
    }
    console.log(`- Categories migrated: ${categories.length}`);

    // Customers
    const customers = await queryLocal("SELECT * FROM customers");
    for (const c of customers) {
        await turso.execute({
            sql: `INSERT OR REPLACE INTO customers (id, custId, name, phone, address, totalOrders, totalSpent, isBlacklisted, loyaltyPoints, profilePic)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [c.id, c.custId, c.name, c.phone, c.address, c.totalOrders, c.totalSpent, c.isBlacklisted, c.loyaltyPoints, c.profilePic]
        });
    }
    console.log(`- Customers migrated: ${customers.length}`);

    // Sales
    const sales = await queryLocal("SELECT * FROM sales");
    for (const s of sales) {
        await turso.execute({
            sql: `INSERT OR REPLACE INTO sales (id, total, buyTotal, date, customer, paymentMethod, items, discount, delivery, loyaltyDiscount, customerId, customerPhone, orderId, weight, trackingNo, deliveryMethod, address, city, received, balance, cardDiscount, advancePaid, balanceDue, pointsEarned, totalPoints)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [s.id, s.total, s.buyTotal, s.date, s.customer, s.paymentMethod, s.items, s.discount, s.delivery, s.loyaltyDiscount, s.customerId, s.customerPhone, s.orderId, s.weight, s.trackingNo, s.deliveryMethod, s.address, s.city, s.received, s.balance, s.cardDiscount, s.advancePaid, s.balanceDue, s.pointsEarned, s.totalPoints]
        });
    }
    console.log(`- Sales migrated: ${sales.length}`);

    // Orders
    const orders = await queryLocal("SELECT * FROM orders");
    for (const o of orders) {
        await turso.execute({
            sql: `INSERT OR REPLACE INTO orders (id, orderId, customer, phone, address, city, items, total, buyTotal, status, deliveryStatus, deliveryMethod, paymentMethod, paymentStatus, trackingNo, weight, discount, delivery, cardDiscount, loyaltyDiscount, date, received, balance, advancePaid, balanceDue, customerId, pointsEarned, totalPoints)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [o.id, o.orderId, o.customer, o.phone, o.address, o.city, o.items, o.total, o.buyTotal, o.status, o.deliveryStatus, o.deliveryMethod, o.paymentMethod, o.paymentStatus, o.trackingNo, o.weight, o.discount, o.delivery, o.cardDiscount, o.loyaltyDiscount, o.date, o.received, o.balance, o.advancePaid, o.balanceDue, o.customerId, o.pointsEarned, o.totalPoints]
        });
    }
    console.log(`- Orders migrated: ${orders.length}`);

    // Expenses
    const expenses = await queryLocal("SELECT * FROM expenses");
    for (const e of expenses) {
        await turso.execute({
            sql: "INSERT OR REPLACE INTO expenses (id, reason, amount, date) VALUES (?, ?, ?, ?)",
            args: [e.id, e.reason, e.amount, e.date]
        });
    }
    console.log(`- Expenses migrated: ${expenses.length}`);

    // Notes
    const notes = await queryLocal("SELECT * FROM notes");
    for (const n of notes) {
        await turso.execute({
            sql: "INSERT OR REPLACE INTO notes (id, title, content, date) VALUES (?, ?, ?, ?)",
            args: [n.id, n.title, n.content, n.date]
        });
    }
    console.log(`- Notes migrated: ${notes.length}`);

    // Settings
    const settings = await queryLocal("SELECT * FROM settings");
    for (const st of settings) {
        await turso.execute({
            sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            args: [st.key, st.value]
        });
    }
    console.log(`- Settings migrated: ${settings.length}`);

    // Waybills
    const waybills = await queryLocal("SELECT * FROM waybills");
    for (const w of waybills) {
        await turso.execute({
            sql: `INSERT OR REPLACE INTO waybills (id, orderId, trackingNo, date, senderName, senderAddress, senderPhone1, senderPhone2, senderPostcode, recipientName, recipientPhone1, recipientPhone2, recipientAddress, recipientCity, weight, courier, specialNotice, paymentMethod, totalAmount, advancePaid, amountToCollect, items, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [w.id, w.orderId, w.trackingNo, w.date, w.senderName, w.senderAddress, w.senderPhone1, w.senderPhone2, w.senderPostcode, w.recipientName, w.recipientPhone1, w.recipientPhone2, w.recipientAddress, w.recipientCity, w.weight, w.courier, w.specialNotice, w.paymentMethod, w.totalAmount, w.advancePaid, w.amountToCollect, w.items, w.status]
        });
    }
    console.log(`- Waybills migrated: ${waybills.length}`);

    console.log("\n ALL LOCAL DATA SUCCESSFULLY MIGRATED TO TURSO CLOUD DATABASE!");
    process.exit(0);
}

runMigration().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
