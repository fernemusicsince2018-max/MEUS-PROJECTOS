export function createWindowStorageProvider() {
  const storage = typeof window !== "undefined" ? window.storage : null;

  return {
    available: Boolean(storage?.get && storage?.set),
    async get(key) {
      if (!storage?.get) return null;
      return storage.get(key);
    },
    async set(key, value) {
      if (!storage?.set) return null;
      return storage.set(key, value);
    },
  };
}
