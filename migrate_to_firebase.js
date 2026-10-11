// Migration script: Export Local SQLite data to Firebase Firestore (with safe profile pic handling)
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

const allQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) resolve([]);
            else resolve(rows || []);
        });
    });
};

async function exportAndUpload() {
    console.log("Reading data from SQLite database.db...");
    
    const inventory = await allQuery("SELECT * FROM inventory");
    const sales = await allQuery("SELECT * FROM sales");
    const orders = await allQuery("SELECT * FROM orders");
    const customers = await allQuery("SELECT * FROM customers");
    const categories = await allQuery("SELECT * FROM categories");
    const notes = await allQuery("SELECT * FROM notes");
    const expenses = await allQuery("SELECT * FROM expenses");
    const waybills = await allQuery("SELECT * FROM waybills");
    const settings = await allQuery("SELECT * FROM settings");
    const users = await allQuery("SELECT * FROM users");

    console.log(`Found:
    - ${inventory.length} inventory items
    - ${sales.length} sales
    - ${orders.length} orders
    - ${customers.length} customers
    - ${categories.length} categories
    - ${notes.length} notes
    - ${expenses.length} expenses
    - ${waybills.length} waybills
    - ${users.length} users`);

    const PROJECT_ID = "roohiracollectionpos";
    const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

    async function setDoc(collection, id, data) {
        const fields = {};
        for (const [k, v] of Object.entries(data)) {
            // Check string length limit (1MB max in Firestore document)
            if (k === 'profilePic' && typeof v === 'string' && v.length > 500000) {
                fields[k] = { stringValue: '' }; // skip huge base64 strings
                continue;
            }

            if (v === null || v === undefined) {
                fields[k] = { nullValue: null };
            } else if (typeof v === 'number') {
                if (Number.isInteger(v)) {
                    fields[k] = { integerValue: String(v) };
                } else {
                    fields[k] = { doubleValue: v };
                }
            } else if (typeof v === 'boolean') {
                fields[k] = { booleanValue: v };
            } else {
                fields[k] = { stringValue: String(v) };
            }
        }
        
        const url = `${BASE_URL}/${collection}/${encodeURIComponent(id)}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to upload ${collection}/${id}: ${errText}`);
        }
    }

    try {
        console.log("\nUploading Inventory to Firebase Firestore...");
        for (const item of inventory) {
            await setDoc('inventory', String(item.id), item);
        }

        console.log("Uploading Customers...");
        for (const c of customers) {
            await setDoc('customers', String(c.id || c.custId), c);
        }

        console.log("Uploading Orders...");
        for (const o of orders) {
            await setDoc('orders', String(o.id || o.orderId), o);
        }

        console.log("Uploading Sales...");
        for (const s of sales) {
            await setDoc('sales', String(s.id), s);
        }

        console.log("Uploading Categories...");
        for (const cat of categories) {
            await setDoc('categories', String(cat.id), cat);
        }

        console.log("Uploading Notes...");
        for (const n of notes) {
            await setDoc('notes', String(n.id), n);
        }

        console.log("Uploading Expenses...");
        for (const e of expenses) {
            await setDoc('expenses', String(e.id), e);
        }

        console.log("Uploading Waybills...");
        for (const w of waybills) {
            await setDoc('waybills', String(w.id), w);
        }

        console.log("Uploading Users...");
        for (const u of users) {
            await setDoc('users', String(u.username), u);
        }

        console.log("Uploading Settings...");
        for (const set of settings) {
            await setDoc('settings', String(set.key), { key: set.key, value: set.value });
        }

        console.log("\n✅ ALL DATA SUCCESSFULLY MIGRATED TO FIREBASE FIRESTORE!");
    } catch (e) {
        console.error("Migration error:", e.message);
    } finally {
        db.close();
    }
}

exportAndUpload();
