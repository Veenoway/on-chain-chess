/**
 * Script de test pour l'API relayer
 *
 * Usage: node scripts/test-relayer.js
 *
 * Ce script teste l'endpoint /api/finish-game-relayer
 */

const BASE_URL = "http://localhost:3000";

async function testRelayerAPI() {
  console.log("🧪 Test de l'API Relayer");
  console.log("========================\n");

  // Test 1: Paramètres invalides
  console.log("Test 1: Paramètres invalides");
  try {
    const response = await fetch(`${BASE_URL}/api/finish-game-relayer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: "",
        result: 4, // Invalide
      }),
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", data);

    if (response.status === 400) {
      console.log("✅ Test 1 PASSÉ - Validation des paramètres fonctionne\n");
    } else {
      console.log("❌ Test 1 ÉCHOUÉ - Validation attendue\n");
    }
  } catch (error) {
    console.log("❌ Test 1 ERREUR:", error.message, "\n");
  }

  // Test 2: Game ID inexistant
  console.log("Test 2: Game ID inexistant");
  try {
    const response = await fetch(`${BASE_URL}/api/finish-game-relayer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: "999999",
        result: 1,
      }),
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", data);

    if (
      response.status === 404 ||
      (data.error && data.error.includes("not found"))
    ) {
      console.log(
        "✅ Test 2 PASSÉ - Gestion des games inexistants fonctionne\n"
      );
    } else {
      console.log("❌ Test 2 ÉCHOUÉ - Erreur 404 attendue\n");
    }
  } catch (error) {
    console.log("❌ Test 2 ERREUR:", error.message, "\n");
  }

  // Test 3: Vérifier la configuration du relayer
  console.log("Test 3: Configuration du relayer");
  try {
    const response = await fetch(`${BASE_URL}/api/finish-game-relayer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: "1",
        result: 1,
      }),
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", data);

    if (data.error && data.error.includes("insufficient balance")) {
      console.log("⚠️  Test 3 - Relayer configuré mais sans fonds");
      console.log("   Solution: Ajoutez des fonds MON au wallet relayer\n");
    } else if (data.error && data.error.includes("private key")) {
      console.log("⚠️  Test 3 - Clé privée relayer non configurée");
      console.log(
        "   Solution: Configurez RELAYER_PRIVATE_KEY dans .env.local\n"
      );
    } else {
      console.log("✅ Test 3 - Configuration du relayer semble correcte\n");
    }
  } catch (error) {
    console.log("❌ Test 3 ERREUR:", error.message);
    console.log("   Vérifiez que le serveur Next.js est démarré\n");
  }

  console.log("🏁 Tests terminés");
  console.log("\nPour utiliser le relayer:");
  console.log("1. Configurez RELAYER_PRIVATE_KEY dans .env.local");
  console.log("2. Ajoutez des fonds MON au wallet relayer");
  console.log("3. Démarrez le serveur: npm run dev");
}

// Vérifier si nous sommes dans un environnement Node.js
if (typeof fetch === "undefined") {
  console.log("❌ Ce script nécessite Node.js 18+ avec fetch global");
  console.log("Ou installez node-fetch: npm install node-fetch");
  process.exit(1);
}

testRelayerAPI().catch(console.error);
