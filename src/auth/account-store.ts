/**
 * Account registry. Stores **paths** to `.p8` files, never key material.
 *
 * File layout on disk (example):
 *   ~/.app-store-connect-mcp/
 *     └── accounts.json          — mode 0600
 *
 * Directory mode: 0700
 *
 * `accounts.json` shape:
 *   {
 *     "currentAccount": "acme-app" | null,
 *     "accounts": {
 *       "acme-app": {
 *         "name": "acme-app",
 *         "keyId": "AB12CD34EF",
 *         "issuerId": "69a6de70-...",
 *         "keyFile": "/Users/you/.config/app-store-connect-mcp/AuthKey_<KEYID>.p8",
 *         "description": "Main company App Store Connect",
 *         "scope": ["GET /v1/apps", ...]
 *       }
 *     }
 *   }
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Account {
  name: string;
  keyId: string;
  issuerId: string;
  keyFile: string;
  description?: string;
  scope?: string[];
}

export interface AccountsFile {
  currentAccount: string | null;
  accounts: Record<string, Account>;
}

const CONFIG_DIR = path.join(os.homedir(), ".app-store-connect-mcp");
const ACCOUNTS_FILE = path.join(CONFIG_DIR, "accounts.json");

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  } else {
    // Fix permissions if they drifted.
    try {
      fs.chmodSync(CONFIG_DIR, 0o700);
    } catch {
      /* non-fatal on platforms that don't support chmod as expected */
    }
  }
}

export function loadAccounts(): AccountsFile {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    return { currentAccount: null, accounts: {} };
  }
  const raw = fs.readFileSync(ACCOUNTS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as AccountsFile;
    return {
      currentAccount: parsed.currentAccount ?? null,
      accounts: parsed.accounts ?? {},
    };
  } catch (err) {
    throw new Error(
      `Corrupt accounts file at ${ACCOUNTS_FILE}: ${(err as Error).message}`,
    );
  }
}

export function saveAccounts(store: AccountsFile): void {
  ensureConfigDir();
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(store, null, 2), {
    mode: 0o600,
  });
  try {
    fs.chmodSync(ACCOUNTS_FILE, 0o600);
  } catch {
    /* non-fatal */
  }
}

/**
 * A process pinned to one account via `ASC_ACCOUNT`. `currentAccount` in
 * `accounts.json` is a single global value shared by every MCP client on the
 * machine, so a `accounts_switch` in one project silently retargets every
 * other one. Pinning makes the choice per-process: set `ASC_ACCOUNT` in the
 * client's server config and that client can only ever reach that account.
 */
export function pinnedAccountName(): string | null {
  const pin = process.env.ASC_ACCOUNT?.trim();
  return pin ? pin : null;
}

export function getCurrentAccount(): Account | null {
  const store = loadAccounts();
  const pin = pinnedAccountName();
  if (pin) {
    const acc = store.accounts[pin];
    if (!acc) {
      throw new Error(
        `ASC_ACCOUNT is pinned to '${pin}', but no such account is registered. Run \`accounts_add\` with name '${pin}', or correct ASC_ACCOUNT in your MCP client config.`,
      );
    }
    return acc;
  }
  if (!store.currentAccount) return null;
  return store.accounts[store.currentAccount] ?? null;
}

export function requireCurrentAccount(): Account {
  const acc = getCurrentAccount();
  if (!acc) {
    throw new Error(
      "No active App Store Connect account. Run `accounts_add` to register your `.p8` key file, then `accounts_switch` to select it. (Or set env vars ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY_PATH for compatibility mode.)",
    );
  }
  if (!fs.existsSync(acc.keyFile)) {
    throw new Error(
      `Private key file not found: ${acc.keyFile}. Update the path with \`accounts_update\` or re-add the account.`,
    );
  }
  return acc;
}

export function addAccount(account: Account): void {
  const store = loadAccounts();
  store.accounts[account.name] = account;
  if (!store.currentAccount) store.currentAccount = account.name;
  saveAccounts(store);
}

export function removeAccount(name: string): void {
  const pin = pinnedAccountName();
  if (pin === name) {
    throw new Error(
      `Account '${name}' is the pinned account (ASC_ACCOUNT) for this server and cannot be removed from here.`,
    );
  }
  const store = loadAccounts();
  delete store.accounts[name];
  if (store.currentAccount === name) {
    const remaining = Object.keys(store.accounts);
    store.currentAccount = remaining[0] ?? null;
  }
  saveAccounts(store);
}

export function switchAccount(name: string): void {
  const pin = pinnedAccountName();
  if (pin && pin !== name) {
    throw new Error(
      `This server is pinned to account '${pin}' via ASC_ACCOUNT and cannot switch to '${name}'. Change ASC_ACCOUNT in the MCP client config if you really mean to retarget it.`,
    );
  }
  const store = loadAccounts();
  if (!store.accounts[name]) {
    throw new Error(
      `No account named '${name}'. Run \`accounts_list\` to see available accounts.`,
    );
  }
  store.currentAccount = name;
  saveAccounts(store);
}

export function updateAccount(
  name: string,
  patch: Partial<Omit<Account, "name">>,
): void {
  const store = loadAccounts();
  const existing = store.accounts[name];
  if (!existing) throw new Error(`No account named '${name}'.`);
  store.accounts[name] = { ...existing, ...patch };
  saveAccounts(store);
}

/**
 * Safe representation of the account store for `accounts_list`. We surface
 * the keyId, issuerId, keyFile *path*, and description. We never echo the
 * `.p8` content — that's on disk, we just remember where.
 *
 * Note: keyId and issuerId are configuration identifiers, NOT secrets. They
 * identify which key to use, but are useless without the `.p8` content.
 * Apple also surfaces them in the App Store Connect web UI.
 */
export function publicAccounts(): AccountsFile {
  return loadAccounts();
}

export { CONFIG_DIR, ACCOUNTS_FILE };
