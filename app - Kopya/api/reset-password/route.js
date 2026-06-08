import { NextResponse } from "next/server";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(req) {
  try {
    const { uid, newPassword } = await req.json();

    // 1. Firebase Authentication üzerindeki gerçek şifreyi güncelle 🔑
    await admin.auth().updateUser(uid, {
      password: newPassword,
    });

    // 2. Firestore dökümanını "Geçici Şifre" moduna al
    await admin.firestore().collection("users").doc(uid).update({
      isTemporaryPassword: true,
      status: "active"
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}