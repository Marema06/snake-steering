# Snake — Steering Behaviors · p5.js · Néon

> Projet Master IA2 — Université Nice Côte d'Azur 2025-2026
> Cours de Michel Buffa — p5.js Steering Behaviors

## Démo en ligne

**[Jouer sur GitHub Pages](https://marema06.github.io/snake-steering/)**

**[Vidéo YouTube](https://youtu.be/VOTRE_LIEN)**

---

## Description

Snake revisité avec un corps articulé dont la **tête est un Vehicle autonome**.
Le joueur guide la tête à la souris ; chaque segment du corps suit le précédent via `arrive()`.
Le jeu monte en difficulté progressivement : obstacles, nourriture qui fuit, zone bonus ×2,
portails, serpent rival IA, RAGE MODE…

**Contrôles :**
- Souris — diriger la tête
- R / Esc — menu
- D — debug (vecteurs visibles)
- M — mute sons / B — mute musique
- O / P — ajouter / retirer un obstacle

---

## Architecture

| Fichier | Rôle |
|---------|------|
| `vehicle.js` | Classe de base `Vehicle` (seek, flee, arrive, wander, eviterObstacles) |
| `snake.js` | `Snake extends Vehicle` — corps articulé |
| `sketch.js` | Boucle principale, toutes les classes du jeu |

### Classes animées (toutes `extends Vehicle`)

| Classe | Behaviors |
|--------|-----------|
| `Snake` | `seek(souris)` · `arrive(segment précédent)` |
| `Obstacle` | `wander()` normal · `seek(tête)` mode seeker |
| `Nourriture` | `flee(tête)` pour les types qui fuient |
| `RivalSnake` | `seek(nourriture)` · `flee(joueur)` · `wander()` |

---

## MON EXPERIENCE

### Pourquoi ce jeu

J'ai choisi le Snake parce que le corps articulé illustre parfaitement le behavior `arrive()` :
chaque segment doit suivre le précédent en ralentissant quand il s'en approche, ce qui donne
un mouvement fluide et naturel sans aucune physique scriptée.
C'est un cas concret où les steering behaviors remplacent complètement une animation codée à la main.

---

### Quels behaviors j'ai utilisés et comment je les ai réglés

**`seek()` — tête du serpent**
La tête cherche la souris en permanence. J'ai mis `maxForce = 0.85` pour qu'elle vire serré
et `minSpeed = 4` pour qu'elle ne s'arrête jamais. Sans `minSpeed`, le serpent freinait
complètement quand la souris était sur lui, ce qui rendait le jeu incontrôlable.

**`arrive()` — corps en chaîne**
Chaque anneau suit le précédent avec `arrive()` et un `rayonZoneDeFreinage` calé sur
`espacement × 3.5`. Trop petit → le corps se contracte. Trop grand → il traîne trop loin.
J'ai trouvé cette valeur par tâtonnement.

**`flee()` — nourriture qui fuit**
Les nourritures or, boost et bouclier fuient la tête dès que le serpent est à moins de 140px.
J'ai pondéré la force avec `map(distance, 0, 140, 1.3, 0.05)` pour que la fuite soit forte
de près et presque nulle de loin. Avant ça, la nourriture filait directement hors écran.
J'ai aussi ajouté un `vel.mult(0.88)` pour l'amortir quand la tête s'éloigne.

**`wander()` — obstacles et rival**
J'ai implémenté le wander de Craig Reynolds : un cercle est projeté devant le véhicule,
et l'angle sur ce cercle varie selon un bruit de Perlin. Résultat : les obstacles dérivent
de manière organique au lieu de faire des lignes droites. Pour le rival, `wander()` sert
de comportement par défaut quand il n'y a pas de nourriture à portée.

**`seek()` mode seeker — obstacles traqueurs**
À partir du niveau 5, certains obstacles appliquent `seek(tête)` via `applyForce()`.
J'ai mis un poids de `0.11` pour que la traque soit lente et anxiogène, pas instantanée.

**Composition de behaviors — `RivalSnake`**
Le rival combine trois behaviors selon la situation :
- si le joueur est à moins de 100px → `flee(joueur)` × 1.5
- sinon si une nourriture est à moins de 260px → `seek(nourriture)` × 1.15
- sinon → `wander()` × 0.95

La priorité est gérée par des `if/else` plutôt qu'une somme pondérée,
ce qui donne un comportement plus lisible et prévisible.

---

### Difficultés rencontrées

**Le serpent traversait ses propres segments**
La collision sur le corps propre était implémentée mais créait des situations frustrantes
(mourir en virant dans un couloir étroit). J'ai choisi de la désactiver pour que le gameplay
reste fluide. La difficulté vient des obstacles et du rival.

**Le corps se disloquait à grande vitesse**
Quand la tête accélérait trop, les segments ne suivaient plus et le corps s'étendait à l'infini.
J'ai ajouté un filtre `if (dist(a, b) > espacement × 4) continue` dans le rendu pour ne pas
dessiner les segments trop éloignés, ce qui masque l'artefact visuellement.

**La nourriture fuyait hors écran**
Avec le behavior `flee()` pur, la nourriture accumulait de la vitesse et sortait.
J'ai résolu ça avec deux choses : `constrain()` sur la position et `vel.mult(0.88)` comme friction.

**Les obstacles stops après refactoring en Vehicle**
En passant `Obstacle` en `extends Vehicle`, le `super.update()` remettait `acc` à zéro,
mais la velocité initiale restait. Le problème était que `wander()` appelait `this.vel.copy()`
sur un vecteur nul au premier frame. J'ai ajouté un fallback :
`let dir = this.vel.mag() > 0.01 ? this.vel.copy() : createVector(1, 0)`.

**La musique procédurale claquait**
Les oscillateurs Web Audio API créaient des clics à chaque note car le gain tombait
à zéro brusquement. J'ai remplacé les `setValueAtTime(0, ...)` par des
`exponentialRampToValueAtTime(0.001, ...)` qui s'approchent de zéro sans jamais l'atteindre exactement.

---

### IDE et outils IA

- **IDE :** VS Code + extension Live Server
- **IA :** Claude Sonnet 4.6 via Claude Code (CLI Anthropic)

L'IA a été utilisée pour générer des blocs de code (classes, behaviors, effets visuels)
et pour déboguer les problèmes de physique des vecteurs.
Toutes les décisions de design (gameplay, équilibrage, mécanique) ont été prises manuellement.

---

## Mécaniques du jeu

| Mécanique | Déclencheur |
|-----------|-------------|
| RAGE MODE | Combo ≥ 5 → vitesse ×1.4, 5 secondes |
| Zone ×2 | Rectangle doré — manger dedans double les points |
| Portails | Niveau 3 — téléportation A ↔ B |
| Serpent rival | Niveau 6 — IA qui concurrence pour la nourriture |
| Obstacles seekers | Niveau 5 — traquent la tête du serpent |
| Bouclier | Nourriture type 4 — absorbe 1 dégât |
| Poison | Nourriture type 3 — −2 pts, rapetisse le corps |
| Expiration | La nourriture or pénalise −1 pt si non ramassée |
