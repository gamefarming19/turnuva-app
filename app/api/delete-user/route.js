import { NextResponse } from "next/server";
import admin from "firebase-admin";

export const runtime = "nodejs";

// Firebase Admin SDK Başlatma
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "easy-fast-tournament",
        clientEmail: "firebase-adminsdk-fbsvc@easy-fast-tournament.iam.gserviceaccount.com",
        // Daha önce paylaştığın özel anahtarı buraya hatasız şekilde yerleştirdim:
        privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDVp0JsJItPZL1h\nRXazT9LZ3mTSNksWz6mC+0I6uvDzUakLXAy7exW2+cwAPxWtzd+wBd4YjnJOazU4\nc1ykaXcRLIGW4waNwzA+oUM6WGX3wQVsPu4alV2xVErb6fC4Z+M8jiT4aBEWObea\n4VyH15P5lm0FokwMmHk9ExIUVzDqW1luuWsQUKGe0qnuOnB21+IOYhPTztWWBh15\nTtTlxA6iepqAIYqA4Ap0oooomBa+Lj7WNFjXN5cPvI6/p1BqzyzF6umtjAC6nRJS\n4hD4L5NBpN4/BA4O+NZa7bHC/1ez7tU++mk7SClRovdhUJFXoJoEPslEF0pJHdbT\n6F/qHA+PAgMBAAECggEAFfcPI3JnsW7dmsLQdEOFnYkj+7SXPa4gcusv9j0X3nwL\nvAjnn4gE8H3NP6KSBlSpuugE2v4cuaaDSd1vrdDQlpRpHOu+1b42bInvERrbc4Aw\nSt5MDlxCzfio2uO52suGF3NUUQbUkuC2LpcdXd3c7wZMXmLpcfYO/idtbr0+tdPO\n60n0z+fU2sU9WYsWMGqwig5tRIK71fIqspXNT8a348XhT7yJtnbVqybn6jyWQorE\nRRmAFJy8n6uwTPeMzM1x9KkNRs4Ly5MbOHTf54HutgJLTRkE/8b/tqlt8CZM4KUf\nefHfxFizVN4PYr0hrQAH620QvsAh/AgkHZaTowMQiQKBgQD1hRX6NTcoYwLiPP9P\ncPa/FcZQXkokCrZFqEAB7eKcdoW5kk7MD7j+IcW32mg6wZfh754L5TBZftXtwMkF\nff8URFJbYrG5wMiz8jNtxAVCUIL5JzQ8nGAoNxuciFBMdFx9bbXmi+57TwcMCcil\n92fvjiqC8KIfK3+9bu8gb8vrqwKBgQDexfPvvYCDbnfxYabx04cNIin6/3q5wC0N\nhrHXOiS135g652Uiti6ULtI3383WePHzlSv7lJeM73waiwnyDZ5urPlBosl146Te\nnax7wAUMDv8eC7rQ0nVwnO6ExjTP1p2l++XTCWgn0HpyzZAV2YN+kmlgtuVqsDYm\npwVvmHRnrQKBgQC6Efap/ZKj5QXWd+v2ROJ7xwDY/9yonAWvnOeFjsfjVF/cV+mn\n9XJ6BxZVVA0SGo4FCRh6Y2PVL67p1OWEaAzdSzovUAjpghWZasFXOuvRajsYoIGS\nPeESGVGvvA8/IiDGXlMxOnOuuCHbGb8bKPl4MAI/4ia8ALd61YwcxR2CqQKBgCmb\nLwQHkIj7iMs8QcHIj+CUEOMf8/vdOIzeKzjXUyPkrrnRncHt5KUoWXq2AeucixPD\nOIO0LNnVoIgUj7b1dDGXfLYVgSrTaWdqa1xxcH/gDSW/axS1OdnedW221wY6PxdR\nBIt1pk5JUZU/bzmldjmdfrDhd9eFMZfmec1t28/BAoGBANAEF/NteiMCll5SkZez\nUq3yZfi3O7OcetObHmx3CFpGFcFCObwQz3xNC2+W68twz6eK5aTWTiWzu5jPhMR7\nbX50Ka1CsTQZOwdS5l2EwRD9k9Gd6PE7FEfQQ1F172iG+d0XaO8KWuBg5qukvjeB\n4o2gGQHmDOyyIgEWjh6iPl3D\n-----END PRIVATE KEY-----\n",
      }),
    });
  } catch (error) {
    console.error("Firebase Admin Error:", error);
  }
}

export async function POST(req) {
  try {
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "UID belirtilmedi" }, { status: 400 });
    }

    // 1. Kullanıcıyı Authentication (Giriş Sistemi) üzerinden sil
    await admin.auth().deleteUser(uid);

    // 2. Kullanıcıyı Firestore (Veritabanı) üzerinden sil
    await admin.firestore().collection("users").doc(uid).delete();

    console.log(`Kullanıcı başarıyla silindi: ${uid}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Silme işlemi sırasında hata:", error.message);
    
    // Eğer kullanıcı Auth'da yoksa ama Firestore'da varsa yine de Firestore'dan silmeyi dene
    if (error.code === 'auth/user-not-found') {
        try {
            const { uid } = await req.json();
            await admin.firestore().collection("users").doc(uid).delete();
            return NextResponse.json({ success: true, message: "Sadece veritabanından silindi." });
        } catch (e) {
            return NextResponse.json({ error: "Veritabanı silme hatası" }, { status: 500 });
        }
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}