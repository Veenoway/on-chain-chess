# Configuration du Relayer pour la Finalisation Automatique

## Vue d'ensemble

Le système de relayer permet de finaliser automatiquement les parties d'échecs sur le contrat smart contract sans que les joueurs aient besoin de signer des transactions manuellement. Ceci résout le problème où un joueur perdant peut refuser de signer la transaction de finalisation, empêchant l'autre joueur de claim ses gains.

## Comment ça fonctionne

1. **Processus de Claim Amélioré** : Quand un joueur essaie de claim ses gains, le système essaie d'abord d'utiliser le relayer API pour finaliser automatiquement la partie.

2. **Relayer API** : L'endpoint `/api/finish-game-relayer` utilise sa propre clé privée pour payer les frais de gas et finaliser la partie automatiquement.

3. **Fallback Manuel** : Si le relayer échoue, l'utilisateur peut toujours finaliser manuellement comme avant.

## Configuration du Relayer

### 1. Créer un Wallet Relayer

```bash
# Créez un nouveau wallet sur Monad Testnet
# Utilisez MetaMask ou un autre wallet pour générer une nouvelle adresse
```

### 2. Ajouter des Fonds

```bash
# Ajoutez des fonds MON testnet au wallet relayer
# Vous pouvez utiliser un faucet Monad Testnet
# Gardez environ 1-5 MON pour couvrir les frais de gas
```

### 3. Configurer les Variables d'Environnement

Créez un fichier `.env.local` à la racine du projet :

```bash
# Configuration du relayer
RELAYER_PRIVATE_KEY=0xVOTRE_CLE_PRIVEE_ICI
```

**IMPORTANT** :

- ⚠️ Ne jamais commiter le fichier `.env.local` dans git
- ⚠️ Utilisez uniquement un wallet dédié au relayer
- ⚠️ N'utilisez JAMAIS votre wallet personnel principal
- ⚠️ Gardez seulement le minimum nécessaire pour les frais de gas

### 4. Exemple de Configuration

```env
RELAYER_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**IMPORTANT** : La clé privée doit absolument commencer par `0x` pour être reconnue comme une chaîne hexadécimale valide.

❌ **Incorrect** : `RELAYER_PRIVATE_KEY=1234567890abcdef...`
✅ **Correct** : `RELAYER_PRIVATE_KEY=0x1234567890abcdef...`

## Sécurité

### Bonnes Pratiques

1. **Wallet Dédié** : Créez un wallet spécifiquement pour le relayer
2. **Fonds Minimaux** : Ne gardez que ce qui est nécessaire pour les frais de gas
3. **Rotation des Clés** : Changez régulièrement la clé privée du relayer
4. **Monitoring** : Surveillez les transactions du relayer pour détecter des activités suspectes

### Risques

- **Exposition de la Clé** : Si la clé privée est compromise, seuls les fonds du relayer sont à risque
- **Épuisement des Fonds** : Le relayer peut ne plus fonctionner si les fonds sont épuisés
- **Frais de Gas Élevés** : En cas de congestion réseau, les coûts peuvent augmenter

## API du Relayer

### Endpoint

```
POST /api/finish-game-relayer
```

### Paramètres

```json
{
  "gameId": "123",
  "result": 1 // 1=White wins, 2=Black wins, 3=Draw
}
```

### Réponse de Succès

```json
{
  "success": true,
  "message": "Game finished successfully by relayer",
  "transactionHash": "0x...",
  "gasUsed": "21000",
  "gameInfo": {
    "gameId": "123",
    "state": 2,
    "result": 1,
    "finishedAt": "1640995200"
  }
}
```

### Réponse d'Erreur

```json
{
  "error": "Game is already finished",
  "details": "..."
}
```

## Monitoring

### Logs à Surveiller

- **🤖 Relayer: Starting game finish process** : Début d'une finalisation
- **✅ Partie finalisée par le relayer** : Succès de la finalisation
- **❌ Erreur relayer** : Échec de la finalisation

### Métriques Importantes

- **Taux de Succès** : Pourcentage de finalisations réussies par le relayer
- **Solde du Relayer** : Montant restant pour les frais de gas
- **Coût Moyen par Transaction** : Frais de gas moyens par finalisation

## Dépannage

### Problèmes Courants

1. **"Relayer has insufficient balance"**

   - Solution : Ajouter des fonds MON au wallet relayer

2. **"Only the contract owner can finish games"**

   - Solution : Vérifier que le contrat permet au relayer de finaliser les parties

3. **"Failed to estimate gas"**
   - Solution : Vérifier que les paramètres de la partie sont valides

### Test du Relayer

Pour tester que le relayer fonctionne :

```bash
curl -X POST http://localhost:3000/api/finish-game-relayer \
  -H "Content-Type: application/json" \
  -d '{"gameId": "123", "result": 1}'
```

## Avantages du Système

1. **UX Améliorée** : Les joueurs n'ont plus besoin de signer des transactions de finalisation
2. **Prévention des Blocages** : Les joueurs perdants ne peuvent plus empêcher les claims
3. **Fiabilité** : Système de fallback si le relayer échoue
4. **Transparence** : Toutes les transactions restent visibles sur la blockchain

## Coûts

- **Frais de Gas** : ~0.001-0.01 MON par finalisation (selon la congestion réseau)
- **Maintenance** : Surveillance et rechargement périodique du wallet relayer
