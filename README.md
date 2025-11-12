# 📦 Archive PMN v1.0

Système de gestion d'archives numériques pour le Port de la Marina de Nianing (PMN).

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18.x ou supérieur
- npm ou yarn
- Compte Supabase

### Installation

```bash
# Cloner le projet
git clone <url-du-repo>
cd project

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos credentials Supabase

# Lancer en développement
npm run dev
```

Le site sera accessible sur `http://localhost:3000`

## 📋 Fonctionnalités

### ✅ Gestion de documents
- Upload de fichiers (PDF, images, documents)
- Organisation en dossiers et sous-dossiers
- Catégorisation (Administrative, Technique, Financière, etc.)
- Recherche avancée par nom, numéro, description
- Prévisualisation en ligne
- Téléchargement individuel ou en ZIP

### ✅ Système de numérotation
- Attribution manuelle de numéros aux dossiers (ex: D-001, CAISSE-12-D04)
- Statuts colorés (🔴 Archive, 🟡 En cours, 🟢 Nouveau)
- Recherche par numéro de dossier
- Visible uniquement pour Super Admin

### ✅ Partage et collaboration
- Partage avec utilisateurs spécifiques
- Génération de liens publics
- Téléchargement direct sans connexion
- Permissions granulaires (lecture, écriture, suppression, partage)
- Expiration des liens optionnelle

### ✅ Messagerie intégrée
- Conversations 1-to-1
- Canaux de groupe
- Notifications en temps réel
- Pièces jointes
- Historique complet

### ✅ Administration
- Gestion des utilisateurs
- Validation des comptes
- Attribution des rôles (Super Admin, Admin, Agent, Invité)
- Demandes d'accès aux documents
- Statistiques du tableau de bord

### ✅ Interface responsive
- Optimisé mobile, tablette, desktop
- Menu hamburger sur mobile
- Grille adaptative
- Modales redimensionnables

### ✅ Modes d'affichage
- Très grandes icônes (80px)
- Grandes icônes (60px)
- Icônes moyennes (40px)
- Préférences sauvegardées par utilisateur

## 🏗️ Architecture technique

### Frontend
- **Framework**: Next.js 13 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **État**: React Hooks
- **Icons**: Lucide React

### Backend
- **Base de données**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **Auth**: Supabase Authentication
- **RLS**: Politiques de sécurité Row Level Security

### API Routes
- `/api/share/[token]` - Téléchargement direct fichier unique
- `/api/share-folder/[token]` - Téléchargement ZIP multiple

## 🔐 Sécurité

- Authentification par email/mot de passe
- Validation des comptes par Super Admin
- Row Level Security (RLS) sur toutes les tables
- Politiques de storage granulaires
- Tokens de partage uniques et sécurisés
- Expiration optionnelle des liens

## 📦 Déploiement

### Vercel (Recommandé)

1. **Pousser sur GitHub**
```bash
git push origin main
```

2. **Connecter à Vercel**
- Aller sur [vercel.com](https://vercel.com)
- Importer le projet GitHub
- Configurer les variables d'environnement

3. **Variables d'environnement Vercel**
```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon
NEXT_PUBLIC_APP_URL=https://e-archive-pmn.vercel.app
```

4. **Déployer**
```bash
vercel --prod
```

### Build local
```bash
npm run build
npm run start
```

## 📚 Documentation

- [Guide de déploiement Vercel](./VERCEL_DEPLOYMENT.md)
- [Migrations Supabase](./supabase/migrations/)

## 🧪 Tests

```bash
# Vérifier les types TypeScript
npm run typecheck

# Linter
npm run lint

# Build de production
npm run build
```

## 🎨 Structure du projet

```
project/
├── app/                      # Pages et routes Next.js
│   ├── api/                 # API routes
│   ├── dashboard/           # Pages du dashboard
│   ├── login/              # Authentification
│   └── shared/             # Page publique de partage
├── components/              # Composants React réutilisables
│   └── ui/                 # Composants UI shadcn
├── lib/                     # Utilitaires et helpers
│   ├── hooks/              # Hooks personnalisés
│   └── types/              # Types TypeScript
├── supabase/               # Migrations et configuration
│   └── migrations/         # Migrations SQL
├── public/                 # Assets statiques
└── README.md              # Ce fichier
```

## 👥 Rôles utilisateurs

### Super Administrateur
- Accès complet à toutes les fonctionnalités
- Gestion des utilisateurs
- Attribution de numéros aux dossiers
- Validation des comptes
- Administration système

### Administrateur
- Gestion des documents et dossiers
- Validation des demandes d'accès
- Partage de documents
- Consultation des statistiques

### Agent
- Upload de documents
- Organisation en dossiers
- Partage avec permissions
- Messagerie

### Invité
- Lecture seule
- Demande d'accès aux documents
- Téléchargement autorisé

## 🔧 Scripts disponibles

```bash
npm run dev          # Développement local
npm run build        # Build de production
npm run start        # Serveur de production
npm run lint         # Vérifier le code
npm run typecheck    # Vérifier les types TypeScript
```

## 📞 Support

Pour toute question ou problème :
- Consulter la documentation Vercel
- Vérifier les logs Supabase
- Tester en local d'abord

## 📝 Licence

© 2025 Port de la Marina de Nianing (PMN)
Tous droits réservés.

---

**Version**: 1.0
**Dernière mise à jour**: Janvier 2025
**Développé pour**: Port de la Marina de Nianing
