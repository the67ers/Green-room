import { defaultKFactors } from './elo-formula.js';
import { database } from './tournament-service';

type SettingsRow = {
  glassMode: number;
  regularK: number;
  firstGameK: number;
  revision: number;
};

const columns = 'glass_mode AS glassMode, regular_k AS regularK, first_game_k AS firstGameK, revision';

function settingsFromRow(row: SettingsRow | null) {
  if (!row) return { glassMode: false, ...defaultKFactors, revision: 0 };
  return { ...row, glassMode: row.glassMode === 1 };
}

export async function getWorkspaceSettings() {
  const row = await database().prepare(`SELECT ${columns} FROM workspace_settings WHERE id = 1`).first<SettingsRow>();
  return settingsFromRow(row);
}

type SettingsChange = { glassMode: boolean } | { regularK: number; firstGameK: number };

export async function saveWorkspaceSettings(change: SettingsChange) {
  const db = database();
  // Only write the group being edited, so two admins can edit separate settings at once.
  const statement = 'glassMode' in change
    ? db.prepare(`INSERT INTO workspace_settings (id, glass_mode) VALUES (1, ?)
        ON CONFLICT(id) DO UPDATE SET glass_mode = excluded.glass_mode, revision = revision + 1
        RETURNING ${columns}`).bind(Number(change.glassMode))
    : db.prepare(`INSERT INTO workspace_settings (id, regular_k, first_game_k) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET regular_k = excluded.regular_k, first_game_k = excluded.first_game_k, revision = revision + 1
        RETURNING ${columns}`).bind(change.regularK, change.firstGameK);
  return settingsFromRow(await statement.first<SettingsRow>());
}
