// Firestore REST Client - Direct Cloud Connection (No Private Key needed for test-mode)
const PROJECT_ID = "roohiracollectionpos";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function decodeValue(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return parseInt(v.integerValue, 10);
    if ('doubleValue' in v) return parseFloat(v.doubleValue);
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) {
        return (v.arrayValue.values || []).map(decodeValue);
    }
    if ('mapValue' in v) {
        const obj = {};
        for (const [key, val] of Object.entries(v.mapValue.fields || {})) {
            obj[key] = decodeValue(val);
        }
        return obj;
    }
    return null;
}

function encodeValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') {
        if (Number.isInteger(v)) return { integerValue: String(v) };
        return { doubleValue: v };
    }
    if (Array.isArray(v)) {
        return { arrayValue: { values: v.map(encodeValue) } };
    }
    if (typeof v === 'object') {
        const fields = {};
        for (const [key, val] of Object.entries(v)) {
            fields[key] = encodeValue(val);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(v) };
}

function docToObj(doc) {
    if (!doc) return null;
    const parts = doc.name.split('/');
    const id = decodeURIComponent(parts[parts.length - 1]);
    const data = { id };
    if (doc.fields) {
        for (const [key, val] of Object.entries(doc.fields)) {
            data[key] = decodeValue(val);
        }
    }
    return data;
}

const firestoreClient = {
    async getCollection(col) {
        try {
            let documents = [];
            let nextPageToken = null;
            do {
                const url = new URL(`${BASE_URL}/${col}`);
                url.searchParams.set('pageSize', '300');
                if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

                const res = await fetch(url.toString());
                if (!res.ok) {
                    if (res.status === 404) return [];
                    throw new Error(`Firestore GET ${col} error: ${res.statusText}`);
                }
                const data = await res.json();
                if (data.documents) documents = documents.concat(data.documents);
                nextPageToken = data.nextPageToken;
            } while (nextPageToken);

            return documents.map(docToObj);
        } catch (e) {
            console.error(`Error fetching collection ${col}:`, e.message);
            return [];
        }
    },

    async getDoc(col, id) {
        try {
            const res = await fetch(`${BASE_URL}/${col}/${encodeURIComponent(id)}`);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`Firestore GET ${col}/${id} error: ${res.statusText}`);
            const data = await res.json();
            return docToObj(data);
        } catch (e) {
            console.error(`Error getting doc ${col}/${id}:`, e.message);
            return null;
        }
    },

    async setDoc(col, id, data) {
        const fields = {};
        for (const [k, v] of Object.entries(data)) {
            if (k === 'id') continue;
            fields[k] = encodeValue(v);
        }
        const res = await fetch(`${BASE_URL}/${col}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Firestore SET ${col}/${id} error: ${err}`);
        }
        return { id, success: true };
    },

    async addDoc(col, data) {
        const fields = {};
        for (const [k, v] of Object.entries(data)) {
            if (k === 'id') continue;
            fields[k] = encodeValue(v);
        }
        const res = await fetch(`${BASE_URL}/${col}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Firestore ADD ${col} error: ${err}`);
        }
        const createdDoc = await res.json();
        return docToObj(createdDoc);
    },

    async updateDoc(col, id, data) {
        // Build updateMask so only specified keys are updated
        const fields = {};
        const updateParams = new URLSearchParams();
        for (const [k, v] of Object.entries(data)) {
            if (k === 'id') continue;
            fields[k] = encodeValue(v);
            updateParams.append('updateMask.fieldPaths', k);
        }
        const url = `${BASE_URL}/${col}/${encodeURIComponent(id)}?${updateParams.toString()}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Firestore UPDATE ${col}/${id} error: ${err}`);
        }
        return { id, success: true };
    },

    async deleteDoc(col, id) {
        const res = await fetch(`${BASE_URL}/${col}/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        if (!res.ok && res.status !== 404) {
            const err = await res.text();
            throw new Error(`Firestore DELETE ${col}/${id} error: ${err}`);
        }
        return { success: true };
    }
};

module.exports = firestoreClient;
