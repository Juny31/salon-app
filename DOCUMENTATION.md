# SalonApp — Documentation complète

> **Version** : 2.0 · **Déployé sur** : GitHub Pages · **Base de données** : Supabase

---

## Table des matières

1. [Contexte & objectif](#1-contexte--objectif)
2. [Stack technique](#2-stack-technique)
3. [Architecture du projet](#3-architecture-du-projet)
4. [Base de données](#4-base-de-données)
5. [Design System](#5-design-system)
6. [Composants](#6-composants)
7. [Logique métier](#7-logique-métier)
8. [Déploiement](#8-déploiement)
9. [Variables d'environnement](#9-variables-denvironnement)
10. [Conventions de code](#10-conventions-de-code)

---

## 1. Contexte & objectif

SalonApp est une application web de **gestion de salon de coiffure**, conçue pour un usage professionnel quotidien. Elle permet à un coiffeur indépendant de :

- **Enregistrer les ventes** (caisse) avec détail des prestations
- **Gérer les clients** et leur abonnement (Standard, Premium, VIP)
- **Suivre le stock** des produits avec alertes de rupture
- **Analyser les performances** (CA, top clients, top services)
- **Configurer le catalogue** de services et leurs prix

L'application est **mono-utilisateur** (un compte = un salon) et fonctionne **entièrement en FCFA** (franc CFA). Elle est accessible depuis n'importe quel navigateur, desktop ou mobile.

---

## 2. Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework UI | React | 18.2 |
| Build tool | Vite | 5.0 |
| Base de données | Supabase (PostgreSQL) | SDK 2.39 |
| Graphiques | Recharts | 2.10 |
| Hébergement | GitHub Pages | — |
| CI/CD | GitHub Actions | — |
| Authentification | Supabase Auth (email/magic link) | — |

Pas de gestionnaire d'état externe (Redux, Zustand). Tout l'état est local via `useState` / `useEffect` React. Pas de routing (SPA mono-page avec navigation par état `currentPage`).

---

## 3. Architecture du projet

```
salon-app/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD GitHub Actions → GitHub Pages
├── src/
│   ├── main.jsx                # Point d'entrée React
│   ├── App.jsx                 # Racine : auth + routing par état
│   ├── index.css               # Design system complet (variables CSS + classes)
│   ├── lib/
│   │   └── supabase.js         # Client Supabase (singleton)
│   └── components/
│       ├── Auth.jsx            # Écran de connexion (email magic link)
│       ├── Layout.jsx          # Shell : top nav + bottom nav mobile
│       ├── Dashboard.jsx       # KPI + graphique CA + top clients
│       ├── Caisse.jsx          # Enregistrement ventes
│       ├── Clients.jsx         # Gestion clients + abonnements
│       ├── Services.jsx        # Catalogue prestations
│       ├── Stock.jsx           # Gestion stock produits
│       └── Reports.jsx         # Rapports & analyses
├── index.html
├── vite.config.js              # base: '/salon-app/' pour GitHub Pages
├── supabase-schema.sql         # DDL complet à exécuter dans Supabase
└── .env.example                # Variables d'environnement requises
```

### Navigation

La navigation est gérée par un état `currentPage` dans `App.jsx`. Pas de routing URL. Les pages disponibles sont :

```
dashboard | caisse | clients | stock | reports | services
```

---

## 4. Base de données

### Modèle de données

Toutes les tables ont une colonne `user_id UUID` liée à `auth.users(id)`. Row Level Security (RLS) est activé sur chaque table : un utilisateur ne voit que ses propres données.

#### `salon_clients`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | Identifiant unique |
| `user_id` | UUID FK | Propriétaire (auth) |
| `name` | TEXT NOT NULL | Nom complet |
| `phone` | TEXT | Numéro de téléphone |
| `email` | TEXT | Email |
| `notes` | TEXT | Notes libres |
| `abonnement` | TEXT | `''` / `'Standard'` / `'Premium'` / `'VIP'` |
| `created_at` | TIMESTAMPTZ | Date de création |

> ⚠️ La colonne `abonnement` a été ajoutée manuellement après la création initiale. Elle n'est pas dans le schéma SQL d'origine — à ajouter via : `ALTER TABLE salon_clients ADD COLUMN abonnement TEXT DEFAULT '';`

#### `salon_services`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | — |
| `user_id` | UUID FK | — |
| `name` | TEXT | Nom de la prestation |
| `category` | TEXT | Catégorie (voir liste ci-dessous) |
| `price` | DECIMAL(10,2) | Prix en FCFA |
| `duration_minutes` | INTEGER | Durée estimée |
| `is_active` | BOOLEAN | Visible dans la caisse ou non |

**Catégories services** : `Coupe`, `Couleur`, `Soin`, `Coiffage`, `Défrisage`, `Tresse / Natte`, `Extension`, `Autre`

#### `salon_visits`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | — |
| `user_id` | UUID FK | — |
| `client_id` | UUID FK nullable | Lié à `salon_clients` (null = client de passage) |
| `visit_date` | DATE | Date de la visite |
| `total` | DECIMAL(10,2) | Montant total en FCFA |
| `payment_method` | TEXT | `especes` / `carte` / `virement` |
| `notes` | TEXT | Notes optionnelles |

#### `salon_visit_services`
Table de jonction entre une visite et ses prestations.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | — |
| `visit_id` | UUID FK | Lié à `salon_visits` |
| `service_id` | UUID FK nullable | Lié à `salon_services` (null si service libre) |
| `service_name` | TEXT | Nom de la prestation (dénormalisé) |
| `price` | DECIMAL(10,2) | Prix unitaire au moment de la vente |
| `quantity` | INTEGER | Quantité |

> Le `service_name` est dénormalisé intentionnellement pour conserver l'historique même si le service est modifié ou supprimé.

#### `salon_products`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | — |
| `user_id` | UUID FK | — |
| `name` | TEXT | Nom du produit |
| `category` | TEXT | Catégorie (voir liste ci-dessous) |
| `stock_quantity` | DECIMAL(10,2) | Quantité en stock |
| `min_stock` | DECIMAL(10,2) | Seuil d'alerte |
| `unit` | TEXT | Unité (`unité`, `ml`, `g`, `L`…) |
| `price` | DECIMAL(10,2) | Prix unitaire d'achat en FCFA |

**Catégories produits** : `Shampoing`, `Soin / Masque`, `Coloration`, `Défrisant`, `Styling`, `Outillage`, `Autre`

#### `salon_stock_movements`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | — |
| `user_id` | UUID FK | — |
| `product_id` | UUID FK | Lié à `salon_products` |
| `quantity_change` | DECIMAL(10,2) | Positif = entrée, négatif = sortie |
| `reason` | TEXT | `achat` / `retour` / `inventaire` / `utilisation` / `perte` |
| `movement_date` | DATE | Date du mouvement |

---

## 5. Design System

### 5.1 Philosophie

Le design s'inspire d'Apple.com : **dark luxury UI, minimaliste, premium**. Palette sombre sophistiquée, typographie hiérarchisée, composants raffinés, micro-interactions discrètes.

### 5.2 Variables CSS (Design Tokens)

Toutes les variables sont définies dans `:root` dans `src/index.css`.

#### Couleurs de fond
```css
--bg:       #09090b;   /* Fond global — noir légèrement bleuté */
--card:     #111113;   /* Cartes de premier niveau */
--card-2:   #17171a;   /* Cartes imbriquées, modals */
--card-3:   #1d1d20;   /* Inputs, surfaces internes */
--input-bg: #141416;   /* Champs de formulaire */
```

#### Couleurs de texte
```css
--text:   #f2f2f7;   /* Texte principal — Apple primary (ratio 19:1) */
--text-2: #a1a1a6;   /* Texte secondaire (ratio 7.2:1) */
--text-3: #808086;   /* Texte tertiaire / labels (ratio 5.1:1) — WCAG AA ✓ */
```

#### Bordures
```css
--border:        rgba(255,255,255,0.07);   /* Bordure standard */
--border-subtle: rgba(255,255,255,0.04);   /* Séparateurs */
--border-strong: rgba(255,255,255,0.12);   /* Bordures accentuées */
```

#### Couleur d'accent (orange-rouge)
```css
--accent:      #e8391d;                              /* Couleur principale */
--accent-2:    #ff4d2e;                              /* Variante plus vive */
--accent-dim:  rgba(232,57,29,0.09);                 /* Fond teinté accent */
--grad-accent: linear-gradient(155deg, #ff4d2e 0%, #c63015 100%); /* Gradient boutons */
```

#### Couleurs de statut (Apple system colors)
```css
--green:     #30d158;               /* Succès, revenus */
--green-dim: rgba(48,209,88,0.10);
--red:       #ff453a;               /* Erreur, danger */
--red-dim:   rgba(255,69,58,0.10);
--amber:     #ffd60a;               /* Avertissement */
```

#### Border-radius
```css
--r-xs:   6px;    /* Petits badges */
--r-sm:   10px;   /* Avatars, icônes */
--r-md:   14px;   /* Inputs, petites cards */
--r-lg:   20px;   /* Cards secondaires */
--r-xl:   24px;   /* Cards principales */
--r-2xl:  30px;   /* Modals, hero cards */
--r-pill: 999px;  /* Boutons, badges pilule */
```

#### Ombres
```css
--shadow-xs: 0 1px 2px rgba(0,0,0,0.55);
--shadow-sm: 0 2px 10px rgba(0,0,0,0.5);
--shadow-md: 0 8px 28px rgba(0,0,0,0.6);
--shadow-lg: 0 20px 56px rgba(0,0,0,0.75);   /* Modals */
```

#### Typographie
```css
--font: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
```

Inter est importé depuis Google Fonts (`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap')`).

**Échelle typographique** :
| Usage | Taille | Poids | Classe / Variable |
|-------|--------|-------|-------------------|
| Titre de page | 28px | 700 | `.page-title` |
| Sous-titre | 13.5px | 400 | `.page-subtitle` |
| Titre de card | 16px | 600 | `.card-title` |
| Valeur KPI | 38px | 700 | `.stat-value` |
| Label KPI | 12.5px | 400 | `.stat-label` |
| Texte corps | 13.5–15px | 400–500 | — |
| Labels formulaire | 11px | 600 | `.form-label` (uppercase) |

#### Mouvement
```css
--ease:        cubic-bezier(0.25, 0.46, 0.45, 0.94);   /* Standard */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);       /* Rebond léger */
--t-fast: 140ms;
--t-base: 240ms;
```

### 5.3 Classes de composants

#### Layout
```css
.app-layout          /* Flex colonne, min-height 100vh */
.mobile-header       /* Top nav sticky, h=64px, backdrop-blur */
.main-content        /* Padding 48px 44px, max-width 1400px centré */
.bottom-nav          /* Mobile only, fixed bottom, h=60px */
```

#### Cards
```css
.card                /* bg var(--card), border, radius-xl, padding 28px 30px */
.stat-card           /* KPI card, flex colonne, hover translateY(-2px) */
.budget-card         /* Card produit/stock avec barre de progression */
```

Structure d'une stat-card :
```jsx
<div className="stat-card">
  <div className="stat-card-top">
    <div className="stat-icon-wrapper">{emoji}</div>
    <span className="stat-label">Label</span>
  </div>
  <div className="stat-value">42</div>
  <div className="stat-trend">
    <span className="stat-trend-label">vs mois dernier</span>
    <span className="trend-chip up">↑ 12%</span>
  </div>
</div>
```

#### Boutons
```css
.btn                 /* Base : pill, 9px 20px, font 13.5px */
.btn-primary         /* Gradient accent, shadow rouge */
.btn-secondary       /* Fond semi-transparent, bordure */
.btn-ghost           /* Sans fond, couleur text-2 */
.btn-sm              /* Padding réduit 6px 14px */
.btn-icon            /* 44×44px (touch target AA), fond transparent */
```

#### Formulaires
```css
.form-group          /* margin-bottom 22px */
.form-label          /* 11px, 600, uppercase, letterspacing 0.5px, text-3 */
.form-input          /* bg input-bg, border, radius-md, focus avec shadow-focus */
```

#### Modals
```css
.modal-overlay       /* Fixed, backdrop-blur, fadeIn animation */
.modal               /* bg card-2, radius-2xl, shadow-lg, slideUp animation */
.modal-header        /* flex space-between */
.modal-close         /* 44×44px rond (touch target AA), aria-label="Fermer" requis */
.modal-actions       /* flex end, border-top */
```

#### Listes
```css
.transaction-list    /* flex colonne */
.transaction-item    /* flex, gap 14px, padding 14px 0, border-bottom subtle */
.person-list         /* Top clients */
.person-item         /* flex, gap 14px, padding 13px 0 */
```

#### Navigation
```css
.top-nav             /* Pill, max-width 560px, bg rgba(255,255,255,0.04) */
.top-nav-item        /* flex center, gap 5px (icon + label), active = blanc sur noir */
.bottom-nav-item     /* flex colonne, font 8.5px, active = var(--accent) */
```

### 5.4 Abonnements — palette de tiers

Les trois tiers d'abonnement ont chacun une couleur définie dans les composants (pas en CSS global) :

```js
const TIER_STYLE = {
  VIP:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  emoji: '👑' },
  Premium:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)', emoji: '💎' },
  Standard: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)',  emoji: '⭐' },
}
```

---

## 6. Composants

### `App.jsx`
Point d'entrée. Gère la session Supabase Auth et affiche soit `<Auth />` soit `<Layout>` avec le composant de la page active.

```jsx
// État principal
const [session, setSession] = useState(null)
const [currentPage, setCurrentPage] = useState('dashboard')

// Pages disponibles
'dashboard' | 'caisse' | 'clients' | 'stock' | 'reports' | 'services'
```

### `Layout.jsx`
Shell de l'application. Reçoit `currentPage` et `setCurrentPage` en props.

- **Top nav desktop** : 6 items avec icône + label dans une pill
- **Bottom nav mobile** : 6 items (icône + libellé court), visible sous 768px
- **Menu utilisateur** : dropdown avec email + déconnexion

```js
// Items nav (desktop + mobile)
{ id: 'dashboard', label: 'Dashboard', icon: '📊', short: 'Tableau' }
{ id: 'caisse',    label: 'Caisse',    icon: '💰', short: 'Caisse'  }
{ id: 'clients',   label: 'Clients',   icon: '👤', short: 'Clients' }
{ id: 'stock',     label: 'Stock',     icon: '📦', short: 'Stock'   }
{ id: 'services',  label: 'Services',  icon: '✂️', short: 'Services'}
{ id: 'reports',   label: 'Rapports',  icon: '📈', short: 'Rapports'}
```

### `Dashboard.jsx`
Tableau de bord principal. Données calculées côté client depuis Supabase.

**Données chargées en parallèle** (`Promise.all`) :
- Visites aujourd'hui
- Visites du mois courant
- Visites du mois précédent (pour tendances %)
- Tous les clients
- 5 dernières visites
- Visites de l'année (pour graphique)
- Visites avec services abonnement

**Composants internes** :
- `CustomTooltip` : tooltip Recharts personnalisé
- `StarRating` : ⚠️ supprimé — les étoiles étaient calculées artificiellement

**Filtre période graphique** (Mois / 6 Mois / Année) : filtre les données `barData` (12 mois) avant de les passer au BarChart.

### `Caisse.jsx`
Enregistrement des ventes. Formulaire avec panier.

**État du formulaire** :
```js
form: { client_id, payment_method, notes, visit_date }
cart: [{ service_id, service_name, price, quantity }]
```

**Services rapides** prédéfinis (non modifiables) :
```js
{ name: 'Coupe',    price: 1000,  emoji: '✂️' }
{ name: 'Standard', price: 3000,  emoji: '⭐' }
{ name: 'Premium',  price: 7000,  emoji: '💎' }
{ name: 'VIP',      price: 30000, emoji: '👑' }
```

**Modes de paiement** : `especes` (💵) · `carte` (💳) · `virement` (🏦)

**Logique abonnements en caisse** : un seul abonnement par visite. Sélectionner un deuxième retire le premier automatiquement.

**Sauvegarde** : insert dans `salon_visits` puis insert de tous les `salon_visit_services` en une seule requête.

### `Clients.jsx`
Gestion clientèle avec deux onglets :

- **Abonnés** : clients avec `abonnement ≠ ''` dans leur profil, triés par tier (VIP > Premium > Standard)
- **Tous** : liste complète avec recherche par nom/téléphone

**Vue détail client** : statistiques (visites ce mois, total visites, total dépensé, abonnement) + historique complet des visites avec services.

**Logique abonnés** : déterminée par le champ `salon_clients.abonnement`, pas par les services vendus. Un client avec `abonnement='VIP'` apparaît dans l'onglet Abonnés même sans visite ce mois.

**Formulaire d'ajout** : liste radio verticale pour l'abonnement (Sans abonnement / Standard / Premium / VIP) avec indicateur visuel ✓.

### `Services.jsx`
Catalogue de prestations groupées par catégorie.

Chaque service peut être :
- **Actif** (`is_active: true`) : visible dans la caisse
- **Inactif** (`is_active: false`) : masqué dans la caisse, opacité 50% dans le catalogue

### `Stock.jsx`
Gestion des produits avec suivi des mouvements.

**Niveaux de stock** :
- 🚨 Rouge : `stock_quantity <= 0`
- ⚠️ Ambre : `stock_quantity <= min_stock`
- ✅ Vert : au-dessus du minimum

**Mouvements** : chaque entrée/sortie insère dans `salon_stock_movements` avec `quantity_change` signé (positif = entrée, négatif = sortie).

### `Reports.jsx`
Rapports mensuels. Sélecteur mois/année en haut.

**Données calculées** :
- CA total du mois sélectionné
- Panier moyen (`totalCA / visits.length`)
- Top 8 services par CA (avec camembert)
- Top 5 clients par CA

**Graphique** : BarChart du CA par mois sur l'année entière, coloré avec `var(--accent)` (#e8391d).

---

## 7. Logique métier

### Formatage des montants FCFA

Tous les composants utilisent la même fonction utilitaire locale :

```js
const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 })
    .format(Math.round(n || 0)) + ' FCFA'
```

Exemples : `1000 → "1 000 FCFA"` · `30000 → "30 000 FCFA"`

### Calcul des tendances

```js
const trend = (current, previous) => {
  if (!previous) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  return { pct, up: pct >= 0 }
}
```

### Système d'abonnements

Trois tiers ordonnés (du plus élevé au plus bas) :
```js
const SUBSCRIPTION_TIERS = ['VIP', 'Premium', 'Standard']
```

L'index dans ce tableau détermine le tri : `0 = VIP` (priorité max), `2 = Standard`.

Un client est considéré "actif ce mois" si `visitsThisMonth > 0`.

### Authentification

Supabase Auth avec magic link (email). Pas de mot de passe. La session est persistée automatiquement par le SDK Supabase.

```js
// Vérification de session au démarrage
supabase.auth.getSession()
// Écoute des changements de session
supabase.auth.onAuthStateChange((_event, session) => { ... })
// Déconnexion
supabase.auth.signOut()
```

### Row Level Security (RLS)

Toutes les tables ont RLS activé avec la politique :
```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

Les tables `salon_visit_services` et `salon_stock_movements` utilisent une sous-requête pour vérifier l'ownership via la table parente.

---

## 8. Déploiement

### GitHub Pages via GitHub Actions

Le déploiement est automatique à chaque push sur la branche `main`.

**Fichier** : `.github/workflows/deploy.yml`

**Étapes du workflow** :
1. Checkout du code
2. Setup Node.js 20
3. `npm install --legacy-peer-deps`
4. `npm run build` (avec les secrets Supabase injectés)
5. Upload du dossier `dist/` comme artifact GitHub Pages
6. Déploiement via `actions/deploy-pages@v4`

**Secrets GitHub requis** :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**URL de production** : `https://juny31.github.io/salon-app/`

### Configuration Vite pour GitHub Pages

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  base: '/salon-app/',  // Obligatoire pour GitHub Pages sous-dossier
})
```

> ⚠️ Sans `base: '/salon-app/'`, tous les assets seraient chargés depuis la racine `/` et l'app ne fonctionnerait pas sur GitHub Pages.

### Déploiement manuel

```bash
# 1. Build local
npm run build

# 2. Prévisualiser le build
npm run preview

# 3. Pousser vers GitHub (déclenche le CI/CD)
git add .
git commit -m "chore: description des changements"
git push origin main
```

---

## 9. Variables d'environnement

Créer un fichier `.env` à la racine (non commité, voir `.gitignore`) :

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Ces variables sont préfixées `VITE_` pour être exposées au bundle côté client par Vite.

---

## 10. Conventions de code

### Nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Composants | PascalCase | `Clients.jsx`, `Dashboard.jsx` |
| Fonctions | camelCase | `fetchData`, `handleSave`, `handleDelete` |
| Constantes globales | SCREAMING_SNAKE ou PascalCase | `SUBSCRIPTION_TIERS`, `TIER_STYLE` |
| Variables d'état | camelCase | `[showForm, setShowForm]` |
| Classes CSS | kebab-case | `.stat-card`, `.modal-close` |

### Patterns récurrents

**Fetch au montage** :
```js
useEffect(() => { fetchData() }, [])
```

**Formulaire contrôlé** :
```js
const [form, setForm] = useState({ name: '', phone: '' })
// Mise à jour partielle
onChange={e => setForm({ ...form, name: e.target.value })}
```

**Sauvegarde avec loading** :
```js
const [saving, setSaving] = useState(false)
const handleSave = async (e) => {
  e.preventDefault()
  setSaving(true)
  const { error } = await supabase.from('table').insert(...)
  if (!error) { /* reset + refetch */ }
  setSaving(false)
}
```

**Suppression avec confirmation** :
```js
const handleDelete = async (id) => {
  if (!window.confirm('Supprimer ?')) return
  await supabase.from('table').delete().eq('id', id)
  setItems(prev => prev.filter(i => i.id !== id))
}
```

### Accessibilité

Règles appliquées dans tout le projet :
- Tous les boutons icône ont `aria-label` explicite
- Tous les boutons `.modal-close` ont `aria-label="Fermer"`
- Les navs ont `aria-label="Navigation principale"` / `"Navigation mobile"`
- Le `<main>` a `role="main"`
- Les inputs de formulaire ont tous un `<label>` associé
- Focus ring global via `:focus-visible { outline: 2px solid rgba(232,57,29,0.7); }`
- Touch targets minimum 44×44px (`.btn-icon`, `.modal-close`)

### Ajout d'un nouveau schéma SQL

1. Écrire la migration dans `supabase-schema.sql`
2. L'exécuter dans le SQL Editor de Supabase
3. Activer RLS et créer la politique
4. Mettre à jour ce document

---

*Documentation générée le 3 juin 2026 · À maintenir à jour à chaque évolution significative du projet.*
