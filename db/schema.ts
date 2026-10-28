import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const tournaments = sqliteTable('tournaments', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
});
export const adminSessions = sqliteTable('admin_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
  accountId: text('account_id'),
});
export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  expiresAt: integer('expires_at').notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayUsername: text('display_username'),
  role: text('role').notNull(),
  disabled: integer('disabled').notNull().default(0),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const tournamentHistory = sqliteTable('tournament_history', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  archivedAt: integer('archived_at').notNull(),
});
