# AGENTS.md — Snake Steering Behaviors (p5.js · Craig Reynolds)

## Contexte du projet

Jeu Snake avec corps articulé dont la **tête est un Vehicle autonome**.
Tous les objets animés étendent la classe `Vehicle`.
Moteur graphique : **p5.js**. Pas de physique externe, pas de chemins scriptés.

---

## Architecture des fichiers

| Fichier       | Rôle |
|---------------|------|
| `vehicle.js`  | Classe de base (seek, flee, arrive, wander, eviterObstacles) |
| `snake.js`    | `Snake extends Vehicle` — corps articulé, tête Vehicle |
| `sketch.js`   | Boucle principale + toutes les classes du jeu |

---

## Classes animées (toutes extends Vehicle)

| Classe          | Behaviors utilisés                          | Rôle |
|-----------------|---------------------------------------------|------|
| `Snake`         | `seek(souris)` · `arrive(segment précédent)`| Joueur — tête pourchasse la souris, corps en chaîne |
| `RivalSnake`    | `seek(nourriture)` · `flee(joueur)` · `wander()` | IA rival — traque nourriture, fuit si trop proche du joueur |
| `Obstacle`      | `seek(tête snake)` (seeker) · `wander()` (normal) | Obstacles mobiles |
| `Nourriture`    | `flee(tête snake)` (types 1,2,4)            | Nourriture qui s'enfuit |

---

## Behaviors de pilotage implémentés

### `seek(target)` — Vehicle.js
```
desired = (target - pos).normalize() × maxSpeed
steering = desired - vel
steering.limit(maxForce)
```
Utilisé : tête du snake, obstacles seekers, rival cherchant de la nourriture.

### `flee(target)` — Vehicle.js
```
desired = (pos - target).normalize() × maxSpeed
steering = desired - vel
```
Utilisé : nourriture or/boost/bouclier qui s'enfuit de la tête, rival fuyant le joueur.

### `arrive(target, d)` — Vehicle.js
Identique à seek mais avec freinage progressif dans la zone de freinage.
Utilisé : segments du corps (chain following), corps du rival.

### `wander()` — Vehicle.js
```
theta = noise(pos.x, pos.y, frameCount) × 2π
cercle = vel.normalize() × DIST_CERCLE + pos
cible  = cercle + (cos(θ), sin(θ)) × RAYON_CERCLE
steering = seek(cible)
```
Mouvement continu sans à-coups (bruit de Perlin). Utilisé : obstacles normaux, rival en mode errant.

### `eviterObstacles(obstacles)` — Vehicle.js
Feelers (antennes) projetées devant. Si un feeler entre dans un obstacle → force de répulsion.
Implémenté dans Vehicle, disponible pour tous les subclasses.

---

## Règles INVIOLABLES

### Tout objet animé = Vehicle subclass
```js
class Snake    extends Vehicle {}  // ✅
class Obstacle extends Vehicle {}  // ✅
class Nourriture extends Vehicle {}// ✅
class RivalSnake extends Vehicle {}// ✅
```

### Loi de pilotage fondamentale
```
steering = vitesse_désirée − vitesse_actuelle
```
**Ne jamais contourner** cette formule. Ne jamais modifier directement `this.pos`.

### Composition de forces
```js
let force = createVector(0, 0);
force.add(this.seek(cible).mult(1.2));
force.add(this.flee(danger).mult(1.5));
this.applyForce(force);
```

### Ne jamais modifier Vehicle.js
Toute extension se fait par `extends Vehicle` + surcharge de `move()` / `show()`.

---

## Mécanique du jeu

| Mécanique          | Déclencheur                         |
|--------------------|-------------------------------------|
| RAGE MODE          | combo ≥ 5 → vitesse ×1.4, 5s       |
| Zone ×2            | Rectangle doré — mange dedans = ×2  |
| Portails           | Niveau 3 — téléportation entre A↔B |
| Rival IA           | Niveau 6 — serpent rouge concurrent |
| Obstacles seekers  | Niveau 5 + 40% chance — traquent la tête |
| Bouclier           | Nourriture type 4 — absorbe 1 dégât |
| Poison             | Nourriture type 3 — −2 pts, rapetisse |

---

## Checklist avant chaque génération de code

- [ ] L'entité utilise-t-elle `applyForce()` + `update()` ?
- [ ] Respecte-t-elle `steering = desired − vel` ?
- [ ] Étend-elle `Vehicle` ?
- [ ] Les behaviors sont-ils composables et indépendants ?
- [ ] `Vehicle.js` est-il intact ?

Si **une** réponse est NON → corriger avant de répondre.
