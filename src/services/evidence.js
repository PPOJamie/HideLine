const DATABASE_NAME = "hideline-local-data";
const DATABASE_VERSION = 1;
const STORE_NAME = "evidence";

let databasePromise;

function openDatabase() {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("This browser does not support private local photo storage."));
  }
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("gameId", "gameId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local photo storage could not be opened."));
    request.onblocked = () => reject(new Error("Local photo storage is blocked by another open HideLine tab."));
  });
  return databasePromise;
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Local photo storage failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Local photo storage was cancelled."));
  });
}

export async function saveLocalEvidence(file, { gameId = "unassigned", questionId = "unknown" } = {}) {
  if (!(file instanceof Blob)) throw new Error("The photo could not be stored locally.");
  const database = await openDatabase();
  const id = `evidence_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put({
    id,
    gameId,
    questionId,
    blob: file,
    fileName: file.name || "evidence.jpg",
    contentType: file.type || "image/jpeg",
    createdAt: new Date().toISOString()
  });
  await transactionComplete(transaction);
  return id;
}

export async function getLocalEvidence(id) {
  if (!id) return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("The local photo could not be read."));
  });
}

export async function getLocalEvidenceUrl(id) {
  const record = await getLocalEvidence(id);
  if (!record?.blob) throw new Error("This photo is no longer stored on this device.");
  return URL.createObjectURL(record.blob);
}

export async function clearEvidenceStore(gameId = null) {
  if (!("indexedDB" in globalThis)) return;
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  if (!gameId) {
    store.clear();
  } else {
    const index = store.index("gameId");
    const request = index.openKeyCursor(IDBKeyRange.only(gameId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
  }
  await transactionComplete(transaction);
}
