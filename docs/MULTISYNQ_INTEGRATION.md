# Intégration Multisynq - Guide

## 🔑 Obtenir la Clé API

1. Aller sur [multisynq.io/coder](https://multisynq.io/coder)
2. Créer un compte et obtenir votre clé API gratuite
3. Ajouter la clé dans vos variables d'environnement

## 📝 Configuration

### 1. Variables d'environnement

Créer un fichier `.env.local` :

```bash
NEXT_PUBLIC_MULTISYNQ_API_KEY=votre-clé-api-ici
NEXT_PUBLIC_MULTISYNQ_APP_ID=com.yourcompany.chess
```

### 2. Intégration dans le composant

```tsx
// src/feature/home/multisynq-full.tsx
"use client";
import { useEffect } from "react";

export default function ChessMultisynqFullApp() {
  useEffect(() => {
    // Initialiser Multisynq avec la clé API
    if (typeof window !== "undefined" && window.Multisynq) {
      window.Multisynq.Session.join({
        apiKey: process.env.NEXT_PUBLIC_MULTISYNQ_API_KEY,
        appId: process.env.NEXT_PUBLIC_MULTISYNQ_APP_ID,
        model: ChessGameModel,
        view: ChessGameView,
        name: Multisynq.App.autoSession(),
        password: Multisynq.App.autoPassword(),
      }).then((session) => {
        console.log("Joined Multisynq session:", session.id);
        // Afficher le QR code pour partager
        Multisynq.App.makeWidgetDock();
      });
    }
  }, []);

  return <div>{/* Votre interface d'échecs */}</div>;
}
```

### 3. Model Multisynq

```tsx
class ChessGameModel extends Multisynq.Model {
  init() {
    this.gameState = {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      players: [],
      // ... autres états
    };

    // S'abonner aux événements
    this.subscribe(this.sessionId, "makeMove", this.handleMakeMove);
    this.subscribe(this.sessionId, "joinRoom", this.handleJoinRoom);
  }

  handleMakeMove(moveData) {
    // Logique de mouvement
    this.publish(this.sessionId, "gameStateChanged", this.gameState);
  }
}
```

### 4. View Multisynq

```tsx
class ChessGameView extends Multisynq.View {
  constructor(model) {
    super(model);

    // S'abonner aux changements
    this.subscribe(this.sessionId, "gameStateChanged", this.updateUI);
  }

  updateUI(gameState) {
    // Mettre à jour l'interface React
    this.setState({ gameState });
  }

  onPieceDrop(from, to) {
    // Envoyer l'action au model
    this.publish(this.sessionId, "makeMove", { from, to });
  }
}
```

## 🔄 Version Actuelle (Locale)

Pour l'instant, nous utilisons une version locale qui :

- ✅ Fonctionne sans clé API
- ✅ Simule la synchronisation avec des événements
- ✅ Prête pour l'intégration Multisynq

## 🚀 Prochaines Étapes

1. **Tester la version locale** : `npm run dev` → `/multisynq-test`
2. **Obtenir la clé API Multisynq**
3. **Implémenter l'intégration complète** avec la vraie synchronisation réseau

## 🎯 Avantages de Multisynq

- 🌐 **Synchronisation temps réel** entre appareils
- 🔒 **Sécurisé** et fiable
- 📱 **QR codes automatiques** pour inviter des amis
- ⚡ **Performance optimisée** pour les jeux

La version actuelle fonctionne parfaitement en local et sera facile à migrer vers Multisynq complet !
