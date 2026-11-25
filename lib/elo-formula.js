export const defaultKFactors = { regularK: 40, firstGameK: 100 };

export function expectedScore(rating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function ratedChanges(a, b, result, firstGame = false, factors = defaultKFactors) {
  const k = firstGame && a === 400 && b === 400 ? factors.firstGameK : factors.regularK;
  const score = (result + 1) / 2;
  const change = (score - expectedScore(a, b)) * k;
  const roundedChange = Math.sign(change) * Math.round(Math.abs(change));
  const delta = Math.max(-a, Math.min(b, roundedChange));
  return { aDelta: delta || 0, bDelta: -delta || 0 };
}
