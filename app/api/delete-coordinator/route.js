import { NextResponse } from "next/server";
import admin from "firebase-admin";

export const runtime = "nodejs";

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();
const auth = admin.auth();

export async function POST(req) {
    try {
        const { uid } = await req.json(); // Silinecek koordinatörün ID'si

        // 1. Koordinatöre ait tüm TURNUVALARI bul
        const tournamentsSnap = await db.collection("tournaments")
            .where("ownerUid", "==", uid).get();
        
        const tournamentIds = tournamentsSnap.docs.map(d => d.id);

        // 2. Bu turnuvalara bağlı OYUNCULARI ve MAÇLARI sil
        for (const tId of tournamentIds) {
            // Oyuncuları sil
            const playersSnap = await db.collection("players").where("tournamentId", "==", tId).get();
            const pBatch = db.batch();
            playersSnap.forEach(d => pBatch.delete(d.ref));
            await pBatch.commit();

            // Maçları sil
            const matchesSnap = await db.collection("matches").where("tournamentId", "==", tId).get();
            const mBatch = db.batch();
            matchesSnap.forEach(d => mBatch.delete(d.ref) );
            await mBatch.commit();

            // Turnuvanın kendisini sil
            await db.collection("tournaments").doc(tId).delete();
        }

        // 3. Koordinatöre bağlı HAKEMLERİ bul ve hem Auth hem Firestore'dan sil
        const refereesSnap = await db.collection("users")
            .where("role", "==", "referee")
            .where("ownerUid", "==", uid).get();

        for (const refDoc of refereesSnap.docs) {
            try {
                await auth.deleteUser(refDoc.id); // Hakemi Auth'dan sil
            } catch (e) { console.log("Hakem zaten Auth'da yok"); }
            await refDoc.ref.delete(); // Hakemi Firestore'dan sil
        }

        // 4. Koordinatörü Authentication'dan (Google/Mail girişinden) sil
        try {
            await auth.deleteUser(uid);
        } catch (e) {
            console.log("Kullanıcı zaten Auth'da yok");
        }

        // 5. Koordinatörün kendi profil belgesini Firestore'dan sil
        await db.collection("users").doc(uid).delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("TAM SİLME HATASI:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}