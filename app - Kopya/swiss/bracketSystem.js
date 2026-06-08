// bracketSystem.js

// Puan gruplarını oluştur (0.5 puan aralıkları)
export const createPointGroups = (players) => {
  const groups = {};
  
  players.forEach(player => {
    const points = player.points || 0;
    // 0.5 puan aralıklarında grupla
    const groupKey = Math.floor(points * 2) / 2;
    
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(player);
  });
  
  // Grupları yüksek puandan düşüğe sırala
  const sortedGroups = Object.keys(groups)
    .map(Number)
    .sort((a, b) => b - a);
  
  return { groups, sortedGroups };
};

// Float edilecek oyuncuları belirle
export const determineFloaters = (groupPlayers, groupPoints, nextGroupPlayers) => {
  const floaters = {
    up: [], // Alt gruptan yukarı float edenler
    down: [] // Üst gruptan aşağı float edenler
  };
  
  // Eşleşemeyen oyuncular aşağı float eder
  const unpairedInGroup = [];
  
  // Float geçmişi kontrol et - aynı yönde 2 kez float edemez
  for (const player of groupPlayers) {
    const lastFloat = player.floatHistory?.[player.floatHistory.length - 1];
    if (lastFloat === 'down') {
      // Daha önce aşağı float etti, bu tur yukarı float edebilir
      floaters.up.push(player);
    }
  }
  
  return floaters;
};