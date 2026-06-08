// colorRules.js

// Hard Rule: ASLA 3 kez aynı renk olamaz
export const wouldCreateThreeInARow = (player, proposedColor) => {
  const lastTwo = player.last2Colors || [];
  if (lastTwo.length !== 2) return false;
  
  // Son 2 renk aynı mı ve önerilen renk de aynı mı?
  if (lastTwo[0] === lastTwo[1] && lastTwo[0] === proposedColor) {
    return true; // WWW veya BBB oluşur!
  }
  return false;
};

// Renk tercihi hesapla (Random değil!)
// app/lib/colorRules.js

// app/lib/colorRules.js

export const calculateColorPreference = (player) => {
  const w = Number(player.whiteCount || 0);
  const b = Number(player.blackCount || 0);
  const diff = w - b; // Pozitifse Siyah(B) ister, Negatifse Beyaz(W) ister
  const history = String(player.colorHistory || "");

  // 1. KESİN YASAK: Arka arkaya 3 kez aynı renk (WWW / BBB engeli)
  if (history.startsWith("WW")) return { preferred: "B", isForced: true, weight: 100 };
  if (history.startsWith("BB")) return { preferred: "W", isForced: true, weight: 100 };

  // 2. TOPLAM DENGE KURALI: Fark 2 veya üzerindeyse ASLA aynı renk verilemez
  if (diff >= 2) return { preferred: "B", isForced: true, weight: 100 };
  if (diff <= -2) return { preferred: "W", isForced: true, weight: 100 };

  // 3. İDEAL DENGE: Fark 1 ise, ters rengi şiddetle tercih et (Dengeyi 0'a çekmek için)
  if (diff === 1) return { preferred: "B", isForced: false, weight: 50 };
  if (diff === -1) return { preferred: "W", isForced: false, weight: 50 };

  // 4. TAM EŞİTLİK: Fark 0 ise, son oynadığı rengin tersini tercih et (Alternasyon)
  if (history.startsWith("W")) return { preferred: "B", isForced: false, weight: 10 };
  if (history.startsWith("B")) return { preferred: "W", isForced: false, weight: 10 };

  return { preferred: null, isForced: false, weight: 0 };
};

export const assignColor = (p1, p2) => {
  const pref1 = calculateColorPreference(p1);
  const pref2 = calculateColorPreference(p2);

  const canAssign = (player, color) => {
    return !wouldCreateThreeInARow(player, color);
  };

  const tryAssignment = (assignment) => {
    if (assignment === 'WB') {
      return canAssign(p1, 'W') && canAssign(p2, 'B');
    }
    return canAssign(p1, 'B') && canAssign(p2, 'W');
  };

  if (pref1.isForced || pref2.isForced) {
    if (pref1.isForced && pref2.isForced && pref1.preferred !== pref2.preferred) {
      return pref1.preferred === 'W' ? 'WB' : 'BW';
    }

    if (pref1.isForced && pref1.preferred) {
      const assignment = pref1.preferred === 'W' ? 'WB' : 'BW';
      if (tryAssignment(assignment)) return assignment;
    }

    if (pref2.isForced && pref2.preferred) {
      const assignment = pref2.preferred === 'W' ? 'BW' : 'WB';
      if (tryAssignment(assignment)) return assignment;
    }
  }

  if (pref1.weight > pref2.weight && pref1.preferred) {
    const assignment = pref1.preferred === 'W' ? 'WB' : 'BW';
    if (tryAssignment(assignment)) return assignment;
  }

  if (pref2.weight > pref1.weight && pref2.preferred) {
    const assignment = pref2.preferred === 'W' ? 'BW' : 'WB';
    if (tryAssignment(assignment)) return assignment;
  }

  if (tryAssignment('WB')) return 'WB';
  if (tryAssignment('BW')) return 'BW';

  return pref1.preferred === 'W' ? 'WB' : 'BW';
};

// Renk geçmişini güncelle
export const updateColorHistory = (player, color) => {
  const newHistory = [...String(player.colorHistory || "")];
  newHistory.push(color);
  if (newHistory.length > 10) newHistory.shift();

  const last2Colors = newHistory.slice(-2);

  if (color === 'W') {
    player.whiteCount = (player.whiteCount || 0) + 1;
  } else {
    player.blackCount = (player.blackCount || 0) + 1;
  }

  player.colorHistory = newHistory.join("");
  player.last2Colors = last2Colors;

  return player;
};