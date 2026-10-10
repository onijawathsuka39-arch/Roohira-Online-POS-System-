const sqlite3 = require('sqlite3').verbose();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function sync() {
    console.log("Starting SQLite to Firebase Firestore migration...");

    const keyPath = fs.existsSync('firebase-service-account.json')
        ? 'firebase-service-account.json'
        : 'firebase-service-account.json.json';

    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    const firestoreDb = admin.firestore();

    const db = new sqlite3.Database('database.db');
    const allQuery = (sql) => new Promise((res, rej) => db.all(sql, (e, r) => e ? rej(e) : res(r)));

    // Helper to upload in batches of 450 (Firestore limit is 500)
    async function uploadCollection(name, rows, transformFn) {
        if (!rows || rows.length === 0) {
            console.log(`[${name}] No rows to sync.`);
            return;
        }
        console.log(`[${name}] Syncing ${rows.length} rows...`);
        const BATCH_SIZE = 400;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const chunk = rows.slice(i, i + BATCH_SIZE);
            const batch = firestoreDb.batch();
            for (const row of chunk) {
                const docId = String(row.id || row.username || row.custId || (i + 1));
                const docRef = firestoreDb.collection(name).doc(docId);
                const data = transformFn ? transformFn(row) : { ...row };
                batch.set(docRef, data, { merge: true });
            }
            await batch.commit();
        }
        console.log(`[${name}] ✅ Successfully uploaded ${rows.length} documents!`);
    }

    try {
        // 1. Users
        const users = await allQuery("SELECT * FROM users");
        await uploadCollection('users', users, r => ({ username: r.username, password: r.password, role: r.role, name: r.name }));

        // 2. Inventory
        const inventory = await allQuery("SELECT * FROM inventory");
        await uploadCollection('inventory', inventory, r => {
            const copy = { ...r };
            delete copy.id;
            return copy;
        });

        // 3. Customers
        const customers = await allQuery("SELECT * FROM customers");
        await uploadCollection('customers', customers, r => {
            const copy = { ...r };
            delete copy.id;
            if (copy.profilePic && copy.profilePic.length > 500000) {
                // omit oversized base64 picture to fit in 1MB document
                delete copy.profilePic;
            }
            return copy;
        });

        // 4. Sales
        const sales = await allQuery("SELECT * FROM sales");
        await uploadCollection('sales', sales, r => {
            const copy = { ...r };
            delete copy.id;
            if (copy.items && typeof copy.items === 'string') {
                try { copy.items = JSON.parse(copy.items); } catch(e) { copy.items = []; }
            }
            return copy;
        });

        // 5. Orders
        const orders = await allQuery("SELECT * FROM orders");
        await uploadCollection('orders', orders, r => {
            const copy = { ...r };
            delete copy.id;
            if (copy.items && typeof copy.items === 'string') {
                try { copy.items = JSON.parse(copy.items); } catch(e) { copy.items = []; }
            }
            return copy;
        });

        // 6. Categories
        const categories = await allQuery("SELECT * FROM categories");
        await uploadCollection('categories', categories, r => {
            const copy = { ...r };
            delete copy.id;
            return copy;
        });

        // 7. Expenses
        const expenses = await allQuery("SELECT * FROM expenses");
        await uploadCollection('expenses', expenses, r => {
            const copy = { ...r };
            delete copy.id;
            return copy;
        });

        // 8. Notes
        const notes = await allQuery("SELECT * FROM notes");
        await uploadCollection('notes', notes, r => {
            const copy = { ...r };
            delete copy.id;
            return copy;
        });

        // 9. Waybills
        const waybills = await allQuery("SELECT * FROM waybills");
        await uploadCollection('waybills', waybills, r => {
            const copy = { ...r };
            delete copy.id;
            return copy;
        });

        console.log("\n🎉 ALL SQLITE DATA SUCCESSFULLY SYNCED TO FIREBASE CLOUD DATABASE! 🎉");
        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
}

sync();
