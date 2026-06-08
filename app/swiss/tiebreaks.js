// tiebreaks.js
export const calculateBuchholz = (playerId, matches, players) => {
  // Oyuncunun maç yaptığı rakiplerin puanları toplamı
  const playerMatches = matches.filter(m => 
    (m.p1_id === playerId || m.p2_id === playerId) && m.status === 'completed'
  );
  
  let total = 0;
  for (const match of playerMatches) {
    const opponentId = match.p1_id === playerId ? match.p2_id : match.p1_id;
    if (opponentId === "BYE") continue;
    
    const opponent = players.find(p => p.id === opponentId);
    if (opponent) total += opponent.points || 0;
  }
  return total;
};

export const calculateSonneborn = (playerId, matches, players) => {
  // Rakiplerin puanları + kazanılan maçların rakip puanları
  const playerMatches = matches.filter(m => 
    (m.p1_id === playerId || m.p2_id === playerId) && m.status === 'completed'
  );
  
  let total = 0;
  for (const match of playerMatches) {
    const opponentId = match.p1_id === playerId ? match.p2_id : match.p1_id;
    if (opponentId === "BYE") continue;
    
    const opponent = players.find(p => p.id === opponentId);
    const isWin = (match.p1_id === playerId && match.result === "1-0") ||
                  (match.p2_id === playerId && match.result === "0-1");
    
    if (opponent) {
      total += isWin ? (opponent.points || 0) : 0;
    }
  }
  return total;
};

export const updateAllTiebreaks = async (players, matches) => {
  for (const player of players) {
    player.buchholz = calculateBuchholz(player.id, matches, players);
    player.sonneborn = calculateSonneborn(player.id, matches, players);
  }
  return players;
};