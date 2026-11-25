import { isAdmin, json, readJson, sameOrigin } from '../../../lib/tournament-service';
import { saveWorkspaceSettings } from '../../../lib/workspace-settings';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Invalid origin.' }, 403);
  if (!await isAdmin(request)) return json({ error: 'Admin access is required.' }, 403);

  let change;
  try {
    change = await readJson(request, 1024);
  } catch {
    return json({ error: 'Enter valid settings.' }, 400);
  }
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    return json({ error: 'Enter valid settings.' }, 400);
  }
  const fields = Object.keys(change).length;
  if (fields === 1 && typeof change.glassMode === 'boolean') {
    return json({ settings: await saveWorkspaceSettings({ glassMode: change.glassMode }) });
  }
  const { regularK, firstGameK } = change;
  if (fields === 2 && [regularK, firstGameK].every(k => Number.isInteger(k) && k >= 1 && k <= 1000)) {
    return json({ settings: await saveWorkspaceSettings({ regularK, firstGameK }) });
  }
  return json({ error: 'Use a switch for Glass mode or whole K values from 1 to 1,000.' }, 400);
}
