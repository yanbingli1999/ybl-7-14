import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');

interface DataFile<T> {
  version: string;
  lastModified: string;
  data: T[];
}

type StoreType = 'projects' | 'variables' | 'simulations' | 'comparisons';

const FILES: Record<StoreType, string> = {
  projects: 'projects.json',
  variables: 'variables.json',
  simulations: 'simulations.json',
  comparisons: 'comparisons.json',
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(type: StoreType): string {
  return path.join(DATA_DIR, FILES[type]);
}

function readFile<T>(type: StoreType): T[] {
  ensureDataDir();
  const filePath = getFilePath(type);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content) as DataFile<T>;
    return parsed.data || [];
  } catch {
    return [];
  }
}

function writeFile<T>(type: StoreType, data: T[]): void {
  ensureDataDir();
  const filePath = getFilePath(type);

  const wrapper: DataFile<T> = {
    version: '1.0',
    lastModified: new Date().toISOString(),
    data,
  };

  fs.writeFileSync(filePath, JSON.stringify(wrapper, null, 2), 'utf-8');
}

export function createStore<T extends { id: string }>(type: StoreType) {
  return {
    getAll(): T[] {
      return readFile<T>(type);
    },

    getById(id: string): T | undefined {
      const all = readFile<T>(type);
      return all.find(item => item.id === id);
    },

    filter(predicate: (item: T) => boolean): T[] {
      const all = readFile<T>(type);
      return all.filter(predicate);
    },

    create(item: T): T {
      const all = readFile<T>(type);
      all.push(item);
      writeFile<T>(type, all);
      return item;
    },

    update(id: string, updates: Partial<T>): T | undefined {
      const all = readFile<T>(type);
      const idx = all.findIndex(item => item.id === id);
      if (idx === -1) return undefined;

      all[idx] = { ...all[idx], ...updates } as T;
      writeFile<T>(type, all);
      return all[idx];
    },

    delete(id: string): boolean {
      const all = readFile<T>(type);
      const idx = all.findIndex(item => item.id === id);
      if (idx === -1) return false;

      all.splice(idx, 1);
      writeFile<T>(type, all);
      return true;
    },

    deleteMany(predicate: (item: T) => boolean): number {
      const all = readFile<T>(type);
      const originalLen = all.length;
      const filtered = all.filter(item => !predicate(item));
      if (filtered.length !== originalLen) {
        writeFile<T>(type, filtered);
      }
      return originalLen - filtered.length;
    },

    bulkCreate(items: T[]): T[] {
      const all = readFile<T>(type);
      all.push(...items);
      writeFile<T>(type, all);
      return items;
    },
  };
}

export type Store<T extends { id: string }> = ReturnType<typeof createStore<T>>;
