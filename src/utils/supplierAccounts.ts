export const SUPPLIER_ACCOUNT_MAX_LENGTH = 20;

export interface SupplierAccounts {
  electricityAccount: string;
  waterAccount: string;
}

const STORAGE_KEYS = {
  electricity: 'ams.supplier.electricityAccount',
  water: 'ams.supplier.waterAccount'
} as const;

export function sanitizeSupplierAccount(value: string): string {
  return value.trim().slice(0, SUPPLIER_ACCOUNT_MAX_LENGTH);
}

function readKey(key: string): string {
  try {
    return sanitizeSupplierAccount(window.localStorage.getItem(key) ?? '');
  } catch {
    return '';
  }
}

function writeKey(key: string, value: string): void {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
}

export function getSupplierAccounts(): SupplierAccounts {
  return {
    electricityAccount: readKey(STORAGE_KEYS.electricity),
    waterAccount: readKey(STORAGE_KEYS.water)
  };
}

export function saveSupplierAccounts(accounts: SupplierAccounts): SupplierAccounts {
  const sanitized: SupplierAccounts = {
    electricityAccount: sanitizeSupplierAccount(accounts.electricityAccount),
    waterAccount: sanitizeSupplierAccount(accounts.waterAccount)
  };
  writeKey(STORAGE_KEYS.electricity, sanitized.electricityAccount);
  writeKey(STORAGE_KEYS.water, sanitized.waterAccount);
  return sanitized;
}
