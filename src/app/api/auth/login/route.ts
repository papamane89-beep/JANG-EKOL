import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { login, motDePasse } = await req.json();
    if (!login || !motDePasse) {
      return NextResponse.json(
        { error: "Login et mot de passe requis" },
        { status: 400 }
      );
    }

    const user = await db.utilisateur.findUnique({
      where: { login },
    });

    if (!user || !user.actif) {
      return NextResponse.json(
        { error: "Identifiants invalides ou compte désactivé" },
        { status: 401 }
      );
    }

    if (!verifyPassword(motDePasse, user.motDePasse)) {
      return NextResponse.json(
        { error: "Identifiants invalides" },
        { status: 401 }
      );
    }

    const token = createSession({
      id: user.id,
      login: user.login,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
    });

    const res = NextResponse.json({
      data: {
        id: user.id,
        login: user.login,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
      },
    });
    res.cookies.set("jang_token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: "Erreur lors de la connexion" },
      { status: 500 }
    );
  }
}
