// validators.js
import { calculateColorPreference } from './colorRules.js';

// app/lib/validators.js
// app/lib/validators.js

export const isValidPairing = (p1, p2, matchHistory, round, currentPairings, totalRounds = null) => {
  if (p1.id === p2.id) return false;
  if (p2.id === "BYE") return true;

  const matchKey = [p1.id, p2.id].sort().join("-");
  if (matchHistory.has(matchKey)) return false;

  const alreadyPairedThisRound = currentPairings.some(pair =>
    (pair.p1.id === p1.id && pair.p2.id === p2.id) ||
    (pair.p1.id === p2.id && pair.p2.id === p1.id)
  );
  if (alreadyPairedThisRound) return false;

  if (totalRounds !== null && !isValidFinalRoundPairing(p1, p2, round, totalRounds)) {
    return false;
  }

  const history1 = String(p1.colorHistory || "");
  const history2 = String(p2.colorHistory || "");
  const diff1 = (Number(p1.whiteCount) || 0) - (Number(p1.blackCount) || 0);
  const diff2 = (Number(p2.whiteCount) || 0) - (Number(p2.blackCount) || 0);

  const pref1 = calculateColorPreference(p1);
  const pref2 = calculateColorPreference(p2);
  if (pref1.isForced && pref2.isForced && pref1.preferred && pref1.preferred === pref2.preferred) {
    return false;
  }

  const p1NeedsWhite = diff1 <= -2 || history1.startsWith("BB");
  const p1NeedsBlack = diff1 >= 2 || history1.startsWith("WW");
  const p2NeedsWhite = diff2 <= -2 || history2.startsWith("BB");
  const p2NeedsBlack = diff2 >= 2 || history2.startsWith("WW");

  if (p1NeedsWhite && p2NeedsWhite) return false;
  if (p1NeedsBlack && p2NeedsBlack) return false;

  return true;
};

// Float kontrolü (yukarı/aşağı float)
export const isValidFloat = (player, currentPoints, targetPoints, floatHistory) => {
  const floatDirection = targetPoints > currentPoints ? 'up' : 'down';
  const lastFloat = player.floatHistory?.[player.floatHistory.length - 1];
  
  // Aynı yönde 2 kez float edemez
  if (lastFloat === floatDirection) return false;
  
  return true;
};

// Son tur özel kuralları
export const isValidFinalRoundPairing = (p1, p2, round, totalRounds) => {
  if (round !== totalRounds) return true;
  
  // Son turda liderler korunmalı
  const topPlayers = [p1, p2].sort((a,b) => (b.points||0) - (a.points||0));
  if (topPlayers[0].points - topPlayers[1].points > 1) {
    // Puan farkı çok fazla - son tur uygun değil
    return false;
  }
  
  return true;
};