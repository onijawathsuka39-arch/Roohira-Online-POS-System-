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

async function runBatchMigration() {
    console.log("Migrating remaining tables in batches...");

    // Categories
    const categories = await queryLocal("SELECT * FROM categories");
    const catStmts = categories.map(cat => ({
        sql: "INSERT OR REPLACE INTO categories (id, name, description) VALUES (?, ?, ?)",
        args: [cat.id, cat.name, cat.description]
    }));
    if (catStmts.length) await turso.batch(catStmts, "write");
    console.log(`- Categories migrated: ${categories.length}`);

    // Customers
    const customers = await queryLocal("SELECT * FROM customers");
    const custStmts = customers.map(c => ({
        sql: `INSERT OR REPLACE INTO customers (id, custId, name, phone, address, totalOrders, totalSpent, isBlacklisted, loyaltyPoints, profilePic)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [c.id, c.custId, c.name, c.phone, c.address, c.totalOrders, c.totalSpent, c.isBlacklisted, c.loyaltyPoints, c.profilePic]
    }));
    if (custStmts.length) await turso.batch(custStmts, "write");
    console.log(`- Customers migrated: ${customers.length}`);

    // Sales in chunks of 50
    const sales = await queryLocal("SELECT * FROM sales");
    for (let i = 0; i < sales.length; i += 50) {
        const chunk = sales.slice(i, i + 50);
        const salesStmts = chunk.map(s => ({
            sql: `INSERT OR REPLACE INTO sales (id, total, buyTotal, date, customer, paymentMethod, items, discount, delivery, loyaltyDiscount, customerId, customerPhone, orderId, weight, trackingNo, deliveryMethod, address, city, received, balance, cardDiscount, advancePaid, balanceDue, pointsEarned, totalPoints)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [s.id, s.total, s.buyTotal, s.date, s.customer, s.paymentMethod, s.items, s.discount, s.delivery, s.loyaltyDiscount, s.customerId, s.customerPhone, s.orderId, s.weight, s.trackingNo, s.deliveryMethod, s.address, s.city, s.received, s.balance, s.cardDiscount, s.advancePaid, s.balanceDue, s.pointsEarned, s.totalPoints]
        }));
        await turso.batch(salesStmts, "write");
        console.log(`- Sales chunk migrated: ${i + chunk.length}/${sales.length}`);
    }

    // Orders in chunks of 50
    const orders = await queryLocal("SELECT * FROM orders");
    const orderStmts = orders.map(o => ({
        sql: `INSERT OR REPLACE INTO orders (id, orderId, customer, phone, address, city, items, total, buyTotal, status, deliveryStatus, deliveryMethod, paymentMethod, paymentStatus, trackingNo, weight, discount, delivery, cardDiscount, loyaltyDiscount, date, received, balance, advancePaid, balanceDue, customerId, pointsEarned, totalPoints)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [o.id, o.orderId, o.customer, o.phone, o.address, o.city, o.items, o.total, o.buyTotal, o.status, o.deliveryStatus, o.deliveryMethod, o.paymentMethod, o.paymentStatus, o.trackingNo, o.weight, o.discount, o.delivery, o.cardDiscount, o.loyaltyDiscount, o.date, o.received, o.balance, o.advancePaid, o.balanceDue, o.customerId, o.pointsEarned, o.totalPoints]
    }));
    if (orderStmts.length) await turso.batch(orderStmts, "write");
    console.log(`- Orders migrated: ${orders.length}`);

    // Expenses
    const expenses = await queryLocal("SELECT * FROM expenses");
    const expStmts = expenses.map(e => ({
        sql: "INSERT OR REPLACE INTO expenses (id, reason, amount, date) VALUES (?, ?, ?, ?)",
        args: [e.id, e.reason, e.amount, e.date]
    }));
    if (expStmts.length) await turso.batch(expStmts, "write");
    console.log(`- Expenses migrated: ${expenses.length}`);

    // Notes
    const notes = await queryLocal("SELECT * FROM notes");
    const noteStmts = notes.map(n => ({
        sql: "INSERT OR REPLACE INTO notes (id, title, content, date) VALUES (?, ?, ?, ?)",
        args: [n.id, n.title, n.content, n.date]
    }));
    if (noteStmts.length) await turso.batch(noteStmts, "write");
    console.log(`- Notes migrated: ${notes.length}`);

    // Settings
    const settings = await queryLocal("SELECT * FROM settings");
    const settingStmts = settings.map(st => ({
        sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        args: [st.key, st.value]
    }));
    if (settingStmts.length) await turso.batch(settingStmts, "write");
    console.log(`- Settings migrated: ${settings.length}`);

    // Waybills
    const waybills = await queryLocal("SELECT * FROM waybills");
    const wbStmts = waybills.map(w => ({
        sql: `INSERT OR REPLACE INTO waybills (id, orderId, trackingNo, date, senderName, senderAddress, senderPhone1, senderPhone2, senderPostcode, recipientName, recipientPhone1, recipientPhone2, recipientAddress, recipientCity, weight, courier, specialNotice, paymentMethod, totalAmount, advancePaid, amountToCollect, items, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [w.id, w.orderId, w.trackingNo, w.date, w.senderName, w.senderAddress, w.senderPhone1, w.senderPhone2, w.senderPostcode, w.recipientName, w.recipientPhone1, w.recipientPhone2, w.recipientAddress, w.recipientCity, w.weight, w.courier, w.specialNotice, w.paymentMethod, w.totalAmount, w.advancePaid, w.amountToCollect, w.items, w.status]
    }));
    if (wbStmts.length) await turso.batch(wbStmts, "write");
    console.log(`- Waybills migrated: ${waybills.length}`);

    console.log("\nALL DATA SUCCESSFULLY MIGRATED TO TURSO CLOUD!");
}

runBatchMigration().catch(console.error);
