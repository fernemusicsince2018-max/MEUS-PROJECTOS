const memoryStore = new Map();

export function createLocalStorageProvider() {
  function getStorage() {
    return typeof window !== "undefined" ? window.localStorage : null;
  }

  return {
    available: true,
    async get(key) {
      const storage = getStorage();
      if (storage) {
        const value = storage.getItem(key);
        return value == null ? null : { value };
      }

      return memoryStore.has(key) ? { value: memoryStore.get(key) } : null;
    },
    async set(key, value) {
      const storage = getStorage();
      if (storage) {
        storage.setItem(key, value);
        return { ok: true };
      }

      memoryStore.set(key, value);
      return { ok: true };
    },
    async remove(key) {
      const storage = getStorage();
      if (storage) {
        storage.removeItem(key);
        return { ok: true };
      }

      memoryStore.delete(key);
      return { ok: true };
    },
  };
}
