export interface CompareResultRecord {
  id: string;
  comparisonResult: string;
  previewAHQ: string;
  previewBHQ: string;
  fileAName: string;
  fileBName: string;
  createdAt: number;
}

type CompareResultPayload = Omit<CompareResultRecord, "id" | "createdAt">;

const DATABASE_NAME = "pdf-tools";
const STORE_NAME = "compare-results";
const DATABASE_VERSION = 1;

const openCompareResultDatabase = async (): Promise<IDBDatabase> => {
  if (!("indexedDB" in window)) {
    throw new Error("IndexedDB is not supported in this browser.");
  }

  return await new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open comparison database."));
  });
};

export const saveCompareResult = async (payload: CompareResultPayload): Promise<string> => {
  const database = await openCompareResultDatabase();
  const id = crypto.randomUUID();

  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.put({
      id,
      createdAt: Date.now(),
      ...payload,
    } satisfies CompareResultRecord);

    transaction.oncomplete = () => {
      database.close();
      resolve(id);
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Failed to save comparison result."));
    };

    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Saving comparison result was aborted."));
    };
  });
};

export const getCompareResult = async (id: string): Promise<CompareResultRecord | null> => {
  const database = await openCompareResultDatabase();

  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);

    request.onsuccess = () => {
      resolve((request.result as CompareResultRecord | undefined) ?? null);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to load comparison result."));
    };

    transaction.oncomplete = () => {
      database.close();
    };

    transaction.onerror = () => {
      database.close();
    };

    transaction.onabort = () => {
      database.close();
    };
  });
};

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const cleanupOldResults = async (): Promise<void> => {
  try {
    const database = await openCompareResultDatabase();
    const cutoff = Date.now() - MAX_AGE_MS;

    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;

      const record = cursor.value as CompareResultRecord;
      if (record.createdAt < cutoff) {
        cursor.delete();
      }
      cursor.continue();
    };

    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
    transaction.onabort = () => database.close();
  } catch (error) {
    console.error("Failed to clean up old comparison results:", error);
  }
};
