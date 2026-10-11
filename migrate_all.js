// ================================================================
// migrate_all.js - SQLite → Firebase Firestore Full Migration
// SQLite database.db ෙ ඇති sales, orders ඔක්කොම Firestore ෙ upload
// Usage: node migrate_all.js
// ================================================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const firestoreClient = require('./firestore_client');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });
}

async function getFirestoreIds(collection) {
    try {
        const docs = await firestoreClient.getCollection(collection);
        return new Set(docs.map(d => String(d.id)));
    } catch (e) {
        console.warn(`Could not fetch ${collection} from Firestore:`, e.message);
        return new Set();
    }
}

async function migrateSales() {
    console.log('\n📦 Migrating SALES...');
    const rows = await allQuery("SELECT * FROM sales ORDER BY id ASC");
    const existing = await getFirestoreIds('sales');
    console.log(`   SQLite: ${rows.length} records | Firestore already has: ${existing.size}`);

    let uploaded = 0, skipped = 0;
    for (const row of rows) {
        const id = String(row.id);
        if (existing.has(id)) { skipped++; continue; }

        let items = row.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }
        if (!Array.isArray(items)) items = [];

        const data = {
            id: row.id,
            total: row.total || 0,
            buyTotal: row.buyTotal || 0,
            date: row.date || new Date().toISOString(),
            customer: row.customer || 'Guest',
            paymentMethod: row.paymentMethod || 'cash',
            items: items,
            discount: row.discount || 0,
            delivery: row.delivery || 0,
            loyaltyDiscount: row.loyaltyDiscount || 0,
            cardDiscount: row.cardDiscount || 0,
            customerId: row.customerId || 'Guest',
            customerPhone: row.customerPhone || 'N/A',
            orderId: row.orderId || '',
            weight: row.weight || '',
            trackingNo: row.trackingNo || '',
            deliveryMethod: row.deliveryMethod || '',
            address: row.address || 'N/A',
            city: row.city || '',
            received: row.received || 0,
            balance: row.balance || 0,
            advancePaid: row.advancePaid != null ? row.advancePaid : null,
            balanceDue: row.balanceDue != null ? row.balanceDue : null,
            pointsEarned: row.pointsEarned || 0,
            totalPoints: row.totalPoints || 0
        };

        try {
            await firestoreClient.setDoc('sales', id, data);
            uploaded++;
            process.stdout.write(`\r   ✅ Uploaded: ${uploaded} / ${rows.length - skipped}`);
        } catch(e) {
            console.error(`\n   ❌ Failed sale ID ${id}:`, e.message);
        }
    }
    console.log(`\n   Done! Uploaded: ${uploaded} | Skipped (already in Firestore): ${skipped}`);
}

async function migrateOrders() {
    console.log('\n📋 Migrating ORDERS...');
    const rows = await allQuery("SELECT * FROM orders ORDER BY id ASC");
    const existing = await getFirestoreIds('orders');
    console.log(`   SQLite: ${rows.length} records | Firestore already has: ${existing.size}`);

    let uploaded = 0, skipped = 0;
    for (const row of rows) {
        const id = String(row.id);
        if (existing.has(id)) { skipped++; continue; }

        let items = row.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }
        if (!Array.isArray(items)) items = [];

        const data = {
            id: row.id,
            orderId: row.orderId || `ORD-${String(row.id).padStart(4,'0')}`,
            customer: row.customer || '',
            phone: row.phone || 'N/A',
            address: row.address || 'N/A',
            city: row.city || '',
            items: items,
            total: row.total || 0,
            buyTotal: row.buyTotal || 0,
            status: row.status || 'Pending',
            deliveryStatus: row.deliveryStatus || '',
            deliveryMethod: row.deliveryMethod || '',
            paymentStatus: row.paymentStatus || 'unpaid',
            paymentMethod: row.paymentMethod || '',
            date: row.date || new Date().toISOString(),
            discount: row.discount || 0,
            delivery: row.delivery || 0,
            loyaltyDiscount: row.loyaltyDiscount || 0,
            cardDiscount: row.cardDiscount || 0,
            customerId: row.customerId || '',
            weight: row.weight || '',
            trackingNo: row.trackingNo || '',
            received: row.received || 0,
            balance: row.balance || 0,
            advancePaid: row.advancePaid != null ? row.advancePaid : null,
            balanceDue: row.balanceDue != null ? row.balanceDue : null,
            pointsEarned: row.pointsEarned || 0,
            totalPoints: row.totalPoints || 0
        };

        try {
            await firestoreClient.setDoc('orders', id, data);
            uploaded++;
            process.stdout.write(`\r   ✅ Uploaded: ${uploaded} / ${rows.length - skipped}`);
        } catch(e) {
            console.error(`\n   ❌ Failed order ID ${id}:`, e.message);
        }
    }
    console.log(`\n   Done! Uploaded: ${uploaded} | Skipped (already in Firestore): ${skipped}`);
}

async function migrateInventory() {
    console.log('\n🏷️  Migrating INVENTORY...');
    const rows = await allQuery("SELECT * FROM inventory ORDER BY id ASC");
    const existing = await getFirestoreIds('inventory');
    console.log(`   SQLite: ${rows.length} records | Firestore already has: ${existing.size}`);

    let uploaded = 0, skipped = 0;
    for (const row of rows) {
        const id = String(row.id);
        if (existing.has(id)) { skipped++; continue; }
        try {
            await firestoreClient.setDoc('inventory', id, { ...row });
            uploaded++;
        } catch(e) {
            console.error(`\n   ❌ Failed inventory ID ${id}:`, e.message);
        }
    }
    console.log(`   Done! Uploaded: ${uploaded} | Skipped: ${skipped}`);
}

async function migrateCustomers() {
    console.log('\n👥 Migrating CUSTOMERS...');
    const rows = await allQuery("SELECT * FROM customers ORDER BY id ASC");
    const existing = await getFirestoreIds('customers');
    console.log(`   SQLite: ${rows.length} records | Firestore already has: ${existing.size}`);

    let uploaded = 0, skipped = 0;
    for (const row of rows) {
        const id = String(row.id);
        if (existing.has(id)) { skipped++; continue; }
        try {
            await firestoreClient.setDoc('customers', id, { ...row });
            uploaded++;
        } catch(e) {
            console.error(`\n   ❌ Failed customer ID ${id}:`, e.message);
        }
    }
    console.log(`   Done! Uploaded: ${uploaded} | Skipped: ${skipped}`);
}

async function migrateExpenses() {
    console.log('\n💸 Migrating EXPENSES...');
    try {
        const rows = await allQuery("SELECT * FROM expenses ORDER BY id ASC");
        const existing = await getFirestoreIds('expenses');
        console.log(`   SQLite: ${rows.length} records | Firestore already has: ${existing.size}`);
        let uploaded = 0, skipped = 0;
        for (const row of rows) {
            const id = String(row.id);
            if (existing.has(id)) { skipped++; continue; }
            try {
                await firestoreClient.setDoc('expenses', id, { ...row });
                uploaded++;
            } catch(e) {}
        }
        console.log(`   Done! Uploaded: ${uploaded} | Skipped: ${skipped}`);
    } catch(e) { console.log('   No expenses table found, skipping.'); }
}

async function main() {
    console.log('🔥 Roohira POS - SQLite → Firebase Firestore Migration');
    console.log('=======================================================');
    console.log('Project: roohiracollectionpos');
    console.log('Database:', dbPath);
    console.log('');

    try {
        await migrateSales();
        await migrateOrders();
        await migrateInventory();
        await migrateCustomers();
        await migrateExpenses();

        console.log('\n✅ Migration Complete!');
        console.log('   Mobile App ෙ දැන් සියල්ල දිස්වේ.');
    } catch(e) {
        console.error('\n❌ Migration failed:', e.message);
    } finally {
        db.close();
        process.exit(0);
    }
}

main();
