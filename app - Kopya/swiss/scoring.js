// scoring.js
import { calculateColorPreference } from './colorRules.js';

export const calculatePairingScore = (p1, p2, round, matchHistory, pairings) => {
  let score = 0;
  
  // 1. Aynı puan grubu (+1000)
  if (Math.abs((p1.points || 0) - (p2.points || 0)) < 0.1) {
    score += 1000;
  } else {
    // Puan farkı cezası
    const pointDiff = Math.abs((p1.points || 0) - (p2.points || 0));
    score -= pointDiff * 100;
  }
  
  // 2. Daha önce oynamamış (+500)
  const matchKey = [p1.id, p2.id].sort().join("-");
  if (!matchHistory.has(matchKey)) {
    score += 500;
  } else {
    score -= 10000; // Tekrar maç asla olmamalı
  }
  
  // 3. Renk dengesi skoru
  const pref1 = calculateColorPreference(p1);
  const pref2 = calculateColorPreference(p2);
  
  if (pref1.isForced && pref1.preferred === 'W') score += 200;
  if (pref1.isForced && pref1.preferred === 'B') score += 200;
  if (pref2.isForced && pref2.preferred === 'W') score += 200;
  if (pref2.isForced && pref2.preferred === 'B') score += 200;
  
  // 4. Renk dengesizliği bonusu
  const p1Diff = (p1.whiteCount || 0) - (p1.blackCount || 0);
  const p2Diff = (p2.whiteCount || 0) - (p2.blackCount || 0);
  if (p1Diff > 0 && p2Diff < 0) score += 100;
  if (p1Diff < 0 && p2Diff > 0) score += 100;
  
  // 5. Buchholz bonusu (daha güçlü rakip)
  score += (p2.buchholz || 0) * 0.1;
  
  // 6. Float gereksinimi kontrolü
  // Daha önce aynı yönde float etmişse ceza
  const lastFloat1 = p1.floatHistory?.[p1.floatHistory.length - 1];
  const lastFloat2 = p2.floatHistory?.[p2.floatHistory.length - 1];
  if (lastFloat1 === 'up') score -= 50;
  if (lastFloat2 === 'down') score -= 50;
  
  return score;
};

export const findBestCandidate = (p1, candidates, round, matchHistory, pairings) => {
  let bestCandidate = null;
  let bestScore = -Infinity;
  
  for (const candidate of candidates) {
    const score = calculatePairingScore(p1, candidate, round, matchHistory, pairings);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }
  
  return { candidate: bestCandidate, score: bestScore };
};