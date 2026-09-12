# Parking Automobilité — site vitrine 3D

Site vitrine « scrollytelling » en Three.js pour **Parking Automobilité**,
92 avenue Léon Blum, 38100 Grenoble (SCI 3 A S M) : au scroll, le bâtiment
se construit du sol vers le sommet, une voiture grimpe la rampe hélicoïdale
centrale, puis on découvre la toiture photovoltaïque et le panorama sur les
montagnes.

## Stack technique

- **Vite** — bundler / serveur de dev.
- **Three.js** (`three@^0.186`) — scène 3D, PBR, post-processing.
- **GSAP + ScrollTrigger** — timeline pilotée par le scroll.
- **Lenis** — scroll fluide (smooth scroll), synchronisé avec ScrollTrigger.

Le bâtiment est **procédural** (CAS B, voir plus bas) : ses proportions et
ses cotes d'étage sont calées sur les vraies données du dossier de
consultation des entreprises (DCE) de l'architecte Jean-Marc Mathieu
(cf. `src/buildingData.js`), mais la géométrie elle-même est générée en
JavaScript, pas importée depuis un fichier CAO.

## Installation

```bash
npm install
npm run dev       # serveur de dev sur http://localhost:5173
npm run build      # build de production dans dist/
npm run preview    # sert le build de dist/
```

Aucune donnée externe n'est requise : le site fonctionne "out of the box"
avec un environnement (ciel) généré procéduralement si aucun HDRI n'est
fourni (voir ci-dessous).

## Où mettre les assets réels (facultatif, pour aller plus loin)

### Photo panoramique des montagnes (déjà en place)

`public/images/panorama-belledonne.jpg` est une vraie photo du massif de
Belledonne, utilisée comme toile de fond (voir `buildMountainBackdrop()`
dans `src/environment.js`) à la place d'une silhouette procédurale. Pour
la remplacer par une autre photo, dépose une nouvelle image au même
chemin (idéalement un format large, ~16:9 à 2:1) — les dimensions
`photoWidth`/`photoHeight` en haut de `buildMountainBackdrop()` servent
uniquement à calculer le bon ratio d'affichage du plan 3D, ajuste-les si
la nouvelle photo a un ratio différent.

### HDRI (éclairage image-based, reflets réalistes)

Dépose un fichier HDRI libre au format `.hdr` dans :

```
public/hdri/env.hdr
```

`src/environment.js` tente de le charger via `HDRLoader` +
`PMREMGenerator` ; s'il est absent (cas par défaut du dépôt), un ciel
dégradé procédural est généré automatiquement en secours, pour que le
rendu reste correct sans aucun téléchargement.

Un bon choix libre de droits : sur [Polyhaven](https://polyhaven.com/hdris),
un HDRI de ciel dégagé de milieu de journée (ex. *"kloofendal 48d partly
cloudy"* ou *"qwantani"*), téléchargé en résolution 2K-4K, format `.hdr`.

### Modèle 3D de l'architecte (passer du CAS B au CAS A)

Si un jour tu obtiens un modèle exporté par l'architecte (`.glb`/`.gltf`,
ou `.fbx`/`.obj` converti en `.glb` via Blender) :

1. Place-le dans `public/models/batiment.glb`.
2. Dans `src/main.js`, remplace l'appel à `buildBuilding()` (import de
   `./building.js`) par un chargement `GLTFLoader` :

   ```js
   import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

   const loader = new GLTFLoader();
   const gltf = await loader.loadAsync("models/batiment.glb");
   const building = gltf.scene;
   scene.add(building);
   // centre le modèle et applique une échelle si besoin :
   const box = new THREE.Box3().setFromObject(building);
   const center = box.getCenter(new THREE.Vector3());
   building.position.sub(center);
   ```

3. Pour l'animation de construction ascendante :
   - Si les 7 niveaux sont des **meshes nommés/séparés** dans le glTF
     (ex. `niveau_1`, `niveau_2`, …), récupère-les avec
     `building.getObjectByName(...)` et réutilise exactement la logique
     de `src/scroll.js` (`level.scale.y`, `level.visible`) sur ces objets
     à la place du tableau `levels` procédural.
   - Sinon, simule la construction avec un **plan de coupe qui monte**
     (`renderer.clippingPlanes` / `material.clippingPlanes`, un
     `THREE.Plane(new THREE.Vector3(0, -1, 0), y)` dont `y` augmente avec
     la progression du scroll).
4. Recale la rampe hélicoïdale (`src/ramp.js`) sur le rayon et la hauteur
   réels du modèle si besoin — la voiture (`src/car.js`) suit cette même
   fonction.

## Où sont les vraies données du bâtiment

`src/buildingData.js` centralise les cotes extraites du DCE (coupes AA/BB,
plan de toitures, indice 9) : hauteurs d'étage réelles, hauteur totale
(32 m), rayon de la rampe hélicoïdale (R = 15 m dans les plans, adapté à
9,5 m pour le rendu stylisé), surface de toiture photovoltaïque
(1 940 m²), et hauteur du bâtiment voisin réel (Halle Alsthom, +32,90 m).
Modifie ce fichier pour ajuster les proportions sans toucher au reste du
code.

## Ajuster le rythme, les couleurs et les textes de la timeline

Tout se passe dans **`src/scroll.js`** :

- L'objet `PHASES` en haut du fichier définit les bornes (en % de scroll,
  de 0 à 1) de chaque étape : vue au sol, construction, montée de la
  voiture, toiture, salle de réunion, panorama final. Change ces valeurs
  pour accélérer/ralentir une phase.
- `CARD_RANGES` définit à quel moment chaque carte de texte
  (`.story-card` dans `index.html`) apparaît/disparaît.
- `cameraKeyframes()` définit les points de passage de la caméra
  (position + cible `look`) pour chaque phase clé ; la fonction
  `evaluateCamera` interpole entre ces points avec un easing "in-out".
- Les textes eux-mêmes sont dans `index.html`, dans les blocs
  `<div class="story-card" data-phase="N">`.
- Les couleurs sont centralisées dans `COLORS` (`src/buildingData.js`)
  et dans les variables CSS de `src/style.css` (`--color-red`,
  `--color-glass`, etc.).

La hauteur de la section pilotant le scroll (`#scene-scroll`, 600vh dans
`src/style.css`) détermine la longueur totale de l'expérience : plus elle
est grande, plus le scroll est "lent" phase par phase.

## Accessibilité & performance

- `prefers-reduced-motion: reduce` est respecté : la scène 3D est alors
  affichée statique (bâtiment déjà construit, caméra fixe), sans pin ni
  animation de caméra au scroll, et les cartes de texte s'affichent en
  flux normal (voir `setupStaticFallback` dans `src/scroll.js`).
- Navigation clavier : liens et boutons ont un `:focus-visible` visible
  (contour rouge), un lien d'évitement (« Aller au contenu principal »)
  est présent.
- Le contenu SEO (offre, parking vert, atouts, contact) est du HTML
  sémantique classique, lisible sans JavaScript ni WebGL.
- Perfs : matériaux/meneaux/panneaux solaires instanciés
  (`THREE.InstancedMesh`, un seul draw call par élément répété), ombres
  PCF/VSM, `pixelRatio` plafonné à 2, SSAO désactivé automatiquement sur
  les machines à faible nombre de cœurs (`navigator.hardwareConcurrency`).

## Déploiement (Vercel / Netlify)

Le projet est un site statique généré par `npm run build` (dossier
`dist/`) :

- **Vercel** : `vercel --prod` (framework détecté automatiquement comme
  Vite), ou connecter le repo GitHub avec la commande de build
  `npm run build` et le dossier de sortie `dist`.
- **Netlify** : commande de build `npm run build`, dossier de publication
  `dist`.

## Limites du temps réel — pour aller au photoréalisme total

Ce rendu vise le meilleur compromis qualité/60 fps en WebGL temps réel. Pour
un rendu vraiment photoréaliste (niveau visualisation architecturale), il
faudrait sortir du temps réel pur ou s'appuyer sur des assets créés dans
Blender :

- **Modèle texturé haute fidélité** : le bâtiment procédural utilise des
  volumes simples (boîtes, cylindre) ; un vrai modèle Blender avec
  béton/verre/acier texturés (normal maps, AO maps bakées, usure,
  salissures) apporterait un tout autre niveau de détail que ce que la
  génération procédurale peut raisonnablement offrir en temps réel.
- **Éclairage global réel** : le rendu utilise un éclairage direct
  (soleil + IBL via HDRI/PMREM) et pas de path tracing ; les inter-
  réflexions subtiles entre le verre, le béton et le sol (radiosité,
  caustiques du verre) nécessiteraient un moteur offline (Cycles/Arnold)
  ou une solution de path tracing temps réel bien plus coûteuse.
- **Végétation de la terrasse** : ici un simple bloc de couleur ; des
  vrais assets d'herbe/plantes (cartes alpha, instancing type
  "grass shader") demanderaient un travail de shading dédié.
- **Voiture** : modèle low-poly stylisé ; un vrai modèle de véhicule
  avec carrosserie peinte réaliste (clearcoat multi-couches, reflets
  d'environnement détaillés) viendrait typiquement d'un asset Blender/
  glTF dédié.
- **Ombres de contact fines et AO** : le SSAO temps réel reste une
  approximation ; un bake d'AO (dans Blender ou via un outil dédié)
  donnerait des ombres de contact plus fines, surtout sous la rampe et
  entre les plateaux.

Ces limites sont normales pour un site vitrine WebGL visant 60 fps sur un
laptop moyen : le compromis choisi ici priorise la fluidité du scroll et
le chargement rapide plutôt qu'un rendu offline.
