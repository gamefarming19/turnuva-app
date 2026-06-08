import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const loadFideData = async (tournamentId) => {
  const [pSnap, mSnap] = await Promise.all([
    getDocs(query(collection(db, "players"), where("tournamentId", "==", tournamentId))),
    getDocs(query(collection(db, "matches"), where("tournamentId", "==", tournamentId)))
  ]);

  const matches = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const players = pSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      rating: Number(data.rating || data.elo || 0),
      points: Number(data.points || 0),
      bNo: Number(data.bNo || 999),
      whiteCount: Number(data.whiteCount || 0),
      blackCount: Number(data.blackCount || 0),
      colorHistory: String(data.colorHistory || ""),
      receivedBye: Boolean(data.receivedBye || false),
      opponents: matches
        .filter(m => (m.p1_id === doc.id || m.p2_id === doc.id) && m.p2_id !== "BYE" && m.status === 'completed')
        .map(m => m.p1_id === doc.id ? m.p2_id : m.p1_id)
    };
  });

  return { players, matches };
};