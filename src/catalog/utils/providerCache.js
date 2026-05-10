export async function readProviderCache(provider, key) {
  if (!provider?.get || !key) return null;

  try {
    const response = await provider.get(key);
    if (!response?.value) return null;

    try {
      const parsed = JSON.parse(response.value);
      if (parsed && typeof parsed === "object" && "payload" in parsed) {
        return {
          payload: parsed.payload,
          updatedAt: parsed.updatedAt || "",
        };
      }
    } catch (error) {}

    return {
      payload: response.value,
      updatedAt: "",
    };
  } catch (error) {
    return null;
  }
}

export async function writeProviderCache(provider, key, payload) {
  if (!provider?.set || !key) return "";

  const updatedAt = new Date().toISOString();

  try {
    await provider.set(
      key,
      JSON.stringify({
        payload,
        updatedAt,
      }),
    );
  } catch (error) {}

  return updatedAt;
}

export async function deleteProviderCache(provider, key) {
  if (!provider || !key) return false;

  try {
    if (typeof provider.remove === "function") {
      await provider.remove(key);
      return true;
    }
  } catch (error) {}

  return false;
}
