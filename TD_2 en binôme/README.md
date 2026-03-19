# 🗳️ dApp Vote Web3

**Auteurs : Oumaima Bougrine et Benjamin Carteron**

Une interface **React + Vite + ethers.js** permettant d’interagir avec un smart contract de vote déployé sur **Sepolia**.

L’application permet de :

- connecter un wallet **MetaMask**
- lire les **scores on-chain** en temps réel
- voter pour un candidat
- afficher un **cooldown personnel** avant le prochain vote
- suivre l’état d’une transaction en direct
- écouter les événements `Voted`
- consulter un **mini blockchain explorer** directement dans l’interface

---

## ✨ Fonctionnalités

### Wallet & réseau
- connexion à **MetaMask**
- vérification du réseau attendu : **Sepolia**
- affichage de l’adresse connectée
- affichage de l’adresse du contrat
- affichage du solde du wallet connecté
- fallback en **mode lecture seule** via RPC si MetaMask n’est pas disponible sur le bon réseau

### Vote on-chain
- récupération dynamique du nombre de candidats depuis le smart contract
- récupération du nom et du nombre de votes de chaque candidat
- bouton de vote par candidat
- vérification du **cooldown** avant envoi de la transaction
- envoi de la transaction via MetaMask

### Suivi transaction
- étape de signature MetaMask
- transaction diffusée
- confirmation on-chain
- bloc final confirmé
- lien Etherscan vers le hash de transaction
- ouverture du détail du bloc confirmé dans une modale

### Historique / Explorer
- écoute live de l’événement `Voted`
- notification lorsqu’un nouveau vote est détecté
- chargement des derniers événements de vote
- affichage :
  - hash de transaction
  - numéro de bloc
  - votant
  - candidat
  - heure
  - gas utilisé
- consultation du détail d’un bloc :
  - timestamp
  - parent hash
  - gas limit
  - gas utilisé
  - autres métadonnées du bloc

---

## 🧱 Stack technique

- **React 18**
- **Vite 5**
- **ethers.js 6**
- **MetaMask**
- **Ethereum Sepolia**

---

## 🌐 Réseau et contrat

### Réseau attendu
- **Nom** : Sepolia
- **Chain ID** : `11155111`

### Contrat
```txt
0x291Ac3C6a92dF373dEa40fee62Ad39831B8A1DDC
```

### Explorer
```txt
https://sepolia.etherscan.io
```

---

## 📦 Installation

Clone le projet puis installe les dépendances :

```bash
npm install
```

---

## ▶️ Lancement

### Développement
```bash
npm run dev
```

### Build de production
```bash
npm run build
```

### Prévisualisation du build
```bash
npm run preview
```

---

## ✅ Prérequis

- **Node.js 18+** recommandé
- **npm**
- **MetaMask** pour voter
- un accès RPC Sepolia optionnel pour le mode lecture seule

---

## ⚙️ Variables d’environnement

Crée un fichier `.env` à la racine du projet :

```env
VITE_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/TON_PROJECT_ID
```

### À quoi ça sert ?
Cette variable permet à l’application de fonctionner en **lecture seule** quand :

- MetaMask n’est pas installé
- MetaMask n’est pas connecté au bon réseau

Dans ce cas :
- la lecture des scores reste possible
- le vote reste **impossible sans MetaMask**

---

## 🗂️ Structure du projet

```txt
dapp-vote/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── config.js
│   ├── abi.json
│   ├── index.css
│   └── styles.css
└── .gitignore
```

---

## 📄 Description des fichiers

### `src/App.jsx`
Contient toute la logique principale de la dApp :

- initialisation du provider
- connexion MetaMask
- lecture des candidats
- lecture du solde
- synchronisation du cooldown
- vote on-chain
- écoute des événements
- chargement de l’explorer
- affichage du détail des blocs

### `src/config.js`
Contient les constantes réseau :

- adresse du contrat
- chain ID attendu
- nom du réseau
- URL de base de l’explorer

### `src/abi.json`
Contient l’ABI du smart contract.

### `src/main.jsx`
Point d’entrée React.

### `src/index.css` et `src/styles.css`
Gèrent le style global de l’application :
- thème sombre
- glassmorphism
- gradients
- responsive
- cartes
- boutons
- tableau explorer
- modale de bloc

### `vite.config.js`
Configuration Vite avec le plugin React.

---

## 🔐 Smart contract utilisé

L’interface s’appuie sur les éléments suivants du contrat :

### Fonctions
- `vote(uint256 candidateIndex)`
- `getCandidate(uint256 index)`
- `getCandidatesCount()`
- `lastVoteTime(address voter)`
- `getTimeUntilNextVote(address voter)`

### Événement
```solidity
event Voted(address indexed voter, uint256 candidateIndex);
```

---

## 🧠 Fonctionnement de l’application

### 1. Initialisation
Au chargement, l’application :

1. essaie d’utiliser MetaMask si disponible
2. vérifie si MetaMask est bien sur **Sepolia**
3. sinon tente un provider RPC de lecture seule
4. charge les candidats depuis le contrat
5. resynchronise la session wallet si possible

### 2. Connexion wallet
Quand l’utilisateur clique sur **Connecter MetaMask** :

1. demande l’accès aux comptes
2. vérifie le réseau
3. récupère l’adresse du signer
4. charge :
   - les candidats
   - le cooldown
   - le solde du wallet

### 3. Vote
Quand l’utilisateur vote :

1. vérifie qu’un wallet est connecté
2. vérifie le cooldown avec `getTimeUntilNextVote`
3. demande la signature MetaMask
4. envoie la transaction
5. attend la confirmation
6. recharge :
   - les candidats
   - le cooldown
   - le solde

### 4. Événements live
L’application écoute l’événement `Voted` pour :

- afficher une alerte de nouveau vote
- mettre à jour les scores
- resynchroniser le cooldown du wallet connecté

### 5. Explorer embarqué
Quand l’explorer est ouvert :

- l’application interroge les événements `Voted`
- récupère les plus récents
- enrichit les données avec :
  - timestamp du bloc
  - gas utilisé
- affiche les **20 derniers événements** retrouvés

---

## 🎨 UI / Design

L’interface suit une esthétique Web3 moderne :

- thème sombre
- halos flous en arrière-plan
- cartes translucides
- boutons en dégradé
- tableau responsive
- modale de détail de bloc
- affichage clair de l’état des transactions

---

## ⚠️ Points d’attention

### MetaMask est obligatoire pour voter
Le mode RPC ne sert qu’à la **lecture**.

### Le bon réseau est obligatoire
Le wallet doit être connecté sur **Sepolia**.

### Les noms de candidats dans l’explorer
Une correspondance locale est utilisée dans le front pour certains affichages de l’historique :

- Léon Blum
- Jacques Chirac
- François Mitterrand

Si les candidats du contrat changent, cette partie du front devra être ajustée.

### Fenêtre d’analyse des événements
L’explorer embarqué ne scanne pas toute la chaîne mais une fenêtre récente afin de rester léger côté front.

---

## 🚀 Pistes d’amélioration

- ajout d’un switch automatique de réseau
- ajout d’un système de notifications toast
- pagination des événements
- filtrage par votant
- filtrage par candidat
- meilleure gestion multi-réseaux
- tests unitaires
- tests e2e
- mode admin pour gérer les candidats
- meilleure gestion des erreurs RPC / wallet

---

## 📜 Scripts npm

```json
{
  "dev": "vite",
  "build": "node node_modules/vite/bin/vite.js build",
  "preview": "vite preview"
}
```

---

## 🏁 Résumé

Cette dApp est un **bureau de vote Web3** construit avec **React**, **Vite** et **ethers.js**.

Elle combine :

- lecture on-chain
- vote via MetaMask
- cooldown par wallet
- suivi temps réel des transactions
- écoute des événements
- explorer blockchain intégré

Bref : petit projet propre, lisible, pédagogique, et déjà très stylé pour une démo Web3.