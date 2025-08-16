export const storage = {
  get: <T>(key: string, defaultValue: T): T => {\
    if (typeof window === 'undefined') return defaultValue;
    try {\
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {\
      return defaultValue;
    }
  },

  set: <T>(key: string, value: T): void => {\
    if (typeof window === 'undefined') return;
    try {\
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {\
      console.error('Failed to save to localStorage:\', error);
    }
  },

  remove: (key: string): void => {\
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },

  clear: (): void => {\
    if (typeof window === 'undefined') return;
    localStorage.clear();
  }\
};
