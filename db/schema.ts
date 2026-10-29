import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const matchReports=sqliteTable('match_reports',{
  id:text('id').primaryKey(), revision:integer('revision').notNull(), matchKey:text('match_key').notNull(),
  reporter:text('reporter').notNull(), opponent:text('opponent').notNull(), choice:integer('choice').notNull(),
  status:text('status').notNull().default('pending'), createdAt:integer('created_at').notNull(),
});
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
  email: text('email').unique(),
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

export const checkinWindows = sqliteTable('checkin_windows', {
  id: text('id').primaryKey(), generation: text('generation').notNull(),
  config: text('config').notNull(), closesAt: integer('closes_at').notNull(),
  status: text('status').notNull(),
});
export const checkinEntries = sqliteTable('checkin_entries', {
  id: text('id').primaryKey(), windowId: text('window_id').notNull(),
  accountId: text('account_id').notNull(), name: text('name').notNull(),
  checkedAt: integer('checked_at').notNull(),
});
