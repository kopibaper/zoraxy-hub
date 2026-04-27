import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_PATH || "./data/zoraxyhub.db";

// Ensure data directory exists
const dir = dirname(dbPath);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Initialize tables if they don't exist
export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 8000,
      protocol TEXT NOT NULL DEFAULT 'https',
      connection_mode TEXT NOT NULL DEFAULT 'direct',
      auth_method TEXT NOT NULL DEFAULT 'session',
      credentials TEXT,
      agent_token TEXT,
      agent_port INTEGER DEFAULT 9191,
      agent_tls INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      location TEXT,
      status TEXT NOT NULL DEFAULT 'unknown',
      last_seen TEXT,
      zoraxy_version TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      variables TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS template_deployments (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES config_templates(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      variables TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      deployed_at TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      node_id TEXT,
      details TEXT,
      result TEXT NOT NULL DEFAULT 'success',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS node_snapshots (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      snapshot_type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migration: add agent columns if missing
  try {
    sqlite.exec(`ALTER TABLE nodes ADD COLUMN agent_port INTEGER DEFAULT 9191`);
  } catch {
    // column already exists
  }
  try {
    sqlite.exec(`ALTER TABLE nodes ADD COLUMN agent_tls INTEGER DEFAULT 0`);
  } catch {
    // column already exists
  }
}
