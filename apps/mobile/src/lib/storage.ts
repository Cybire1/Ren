import AsyncStorage from '@react-native-async-storage/async-storage'

/** Small JSON persistence for things that are not secret: activity, preferences, card state. */
export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value))
}

export async function remove(...keys: string[]): Promise<void> {
  await AsyncStorage.multiRemove(keys)
}
