// ============================================================
//  Vehicle — comportements de pilotage (steering behaviors)
//  Auteur  : cours de M. Buffa
// ============================================================
//
//  ÉTAPE 1 — Vitesse désirée  : direction vers la cible
//  ÉTAPE 2 — Pilotage         : force = vitesseDésirée − vitesseActuelle
//
//  Méthodes disponibles :
//    seek(target)                → va vers une cible à pleine vitesse
//    flee(target)                → fuit une cible
//    arrive(target, d)           → seek avec ralentissement progressif
//                                  d = distance minimale à maintenir
//    eviterObstacles(obstacles)  → obstacle avoidance (Craig Reynolds)
//    applyForce(force)           → accumule une force dans l'accélération
//    update()                    → intègre acc → vel → pos (appelé 60×/s)
//    edges()                     → réapparition côté opposé du canvas
//    show()                      → dessine le véhicule (triangle)
// ============================================================

class Vehicle {

  // ── Attribut de classe ──────────────────────────────────
  // Vehicle.debug = true  →  affiche les feelers et vecteurs
  static debug = false;

  // ── Constructeur ────────────────────────────────────────
  constructor(x, y) {
    // Vecteurs fondamentaux
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);

    // Paramètres de pilotage
    this.maxSpeed = 4;    // vitesse maximale  (pixels / frame)
    this.minSpeed = 0;    // vitesse minimale  (0 = peut s'arrêter)
    this.maxForce = 0.2;  // force maximale    (pixels / frame²)
    this.r        = 12;   // rayon du véhicule (pour le dessin)

    // Rayon de la zone de freinage utilisé par arrive()
    this.rayonZoneDeFreinage = 100;
  }

  // ── seek ────────────────────────────────────────────────
  // Dirige le véhicule vers target.
  //   arrival : si true, active le freinage à l'approche
  //   d       : distance minimale cible (utile pour les chaînes de segments)
  seek(target, arrival = false, d = 0) {

    // ÉTAPE 1 : vitesse désirée = direction vers la cible
    let vitesseDesiree = this.maxSpeed;

    if (arrival) {
      let distance = p5.Vector.dist(this.pos, target);

      // Dans la zone de freinage → on ralentit proportionnellement
      if (distance < this.rayonZoneDeFreinage) {
        vitesseDesiree = map(distance, d, this.rayonZoneDeFreinage, 0, this.maxSpeed);
        vitesseDesiree = max(0, vitesseDesiree);
      }
    }

    // Vecteur pointant vers la cible, normé à vitesseDesiree
    let desiredSpeed = p5.Vector.sub(target, this.pos);
    desiredSpeed.setMag(vitesseDesiree);

    // ÉTAPE 2 : formule magique  force = vitDésirée − vitActuelle
    let force = p5.Vector.sub(desiredSpeed, this.vel);
    force.limit(this.maxForce);
    return force;
  }

  // ── wander ──────────────────────────────────────────────
  // Déambulation autonome — Craig Reynolds
  // Un cercle est projeté devant le véhicule ; l'angle sur ce cercle
  // varie selon un bruit de Perlin → mouvement continu, sans à-coups.
  wander() {
    const RAYON_CERCLE = 35;
    const DIST_CERCLE  = 70;
    let theta        = noise(this.pos.x * 0.004, this.pos.y * 0.004, frameCount * 0.01) * TWO_PI * 2;
    let dir          = this.vel.mag() > 0.01 ? this.vel.copy() : createVector(1, 0);
    let centreCircle = dir.setMag(DIST_CERCLE).add(this.pos);
    let cible        = createVector(
      centreCircle.x + cos(theta) * RAYON_CERCLE,
      centreCircle.y + sin(theta) * RAYON_CERCLE
    );
    return this.seek(cible);
  }

  // ── flee ────────────────────────────────────────────────
  // Inverse de seek : fuit la cible.
  flee(target) {
    let desiredSpeed = p5.Vector.sub(this.pos, target); // direction opposée
    desiredSpeed.setMag(this.maxSpeed);

    let force = p5.Vector.sub(desiredSpeed, this.vel);
    force.limit(this.maxForce);
    return force;
  }

  // ── arrive ──────────────────────────────────────────────
  // Raccourci : seek avec freinage activé.
  // d = distance minimale à maintenir entre ce véhicule et target
  arrive(target, d = 0) {
    return this.seek(target, true, d);
  }

  // ── eviterObstacles ─────────────────────────────────────
  // Obstacle Avoidance — Craig Reynolds
  //
  // Principe :
  //   On projette deux "feelers" (antennes) devant le véhicule :
  //     · ahead  = position + vel normé × LONGUEUR_REGARD
  //     · ahead2 = ahead × 0.5  (feeler plus court)
  //   Si l'un des feelers est à l'intérieur d'un obstacle,
  //   on calcule une force qui pousse le véhicule loin du centre
  //   de l'obstacle le plus menaçant (le plus proche).
  //
  // Paramètre : tableau d'objets { pos: p5.Vector, r: number }
  // Retourne  : p5.Vector — force d'évitement (vecteur nul si rien)
  eviterObstacles(obstacles) {
    const LONGUEUR_REGARD = max(60, this.vel.mag() * 14);

    // Calcul des deux feelers
    let direction = this.vel.copy();
    direction.setMag(LONGUEUR_REGARD);

    let ahead  = p5.Vector.add(this.pos, direction);
    let ahead2 = p5.Vector.add(this.pos, direction.copy().mult(0.5));

    // Trouver l'obstacle le plus menaçant dans le champ de vision
    let plusMenacant = null;
    let distMin      = Infinity;

    for (let obs of obstacles) {
      // L'obstacle est menaçant si ahead OU ahead2 est dans son rayon
      let d1 = p5.Vector.dist(ahead,  obs.pos);
      let d2 = p5.Vector.dist(ahead2, obs.pos);
      let d0 = p5.Vector.dist(this.pos, obs.pos);

      let toucheFeeler = (d1 < obs.r + this.r)
                      || (d2 < obs.r + this.r)
                      || (d0 < obs.r + this.r); // déjà dedans !

      if (toucheFeeler && d0 < distMin) {
        distMin      = d0;
        plusMenacant = obs;
      }
    }

    // ── Dessin debug ──────────────────────────────────────
    if (Vehicle.debug) {
      push();
      // Feeler principal
      stroke(255, 220, 0, 140);
      strokeWeight(1.5);
      noFill();
      line(this.pos.x, this.pos.y, ahead.x, ahead.y);
      circle(ahead.x, ahead.y, 6);

      // Feeler secondaire
      stroke(255, 180, 0, 80);
      strokeWeight(1);
      line(this.pos.x, this.pos.y, ahead2.x, ahead2.y);

      // Obstacle menaçant en surbrillance rouge
      if (plusMenacant) {
        stroke(255, 0, 0, 200);
        strokeWeight(2);
        circle(plusMenacant.pos.x, plusMenacant.pos.y, plusMenacant.r * 2);
      }
      pop();
    }

    // ── Calcul de la force d'évitement ───────────────────
    if (plusMenacant) {
      // Pousser dans la direction opposée à l'obstacle
      let forceEvitement = p5.Vector.sub(ahead, plusMenacant.pos);
      forceEvitement.setMag(this.maxSpeed);

      // Formule magique
      let force = p5.Vector.sub(forceEvitement, this.vel);

      // L'évitement est prioritaire : on le pondère fortement
      force.limit(this.maxForce * 6);
      return force;
    }

    return createVector(0, 0); // aucun obstacle → force nulle
  }

  // ── applyForce ──────────────────────────────────────────
  applyForce(force) {
    this.acc.add(force);
  }

  // ── update ──────────────────────────────────────────────
  // Intègre les vecteurs : acc → vel → pos (appelé 60×/s)
  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
  }

  // ── edges ───────────────────────────────────────────────
  // Réapparition du côté opposé du canvas
  edges() {
    if      (this.pos.x >  width  + this.r) this.pos.x = -this.r;
    else if (this.pos.x < -this.r)           this.pos.x =  width  + this.r;
    if      (this.pos.y >  height + this.r) this.pos.y = -this.r;
    else if (this.pos.y < -this.r)           this.pos.y =  height + this.r;
  }

  // ── show ────────────────────────────────────────────────
  // Triangle blanc orienté dans la direction du mouvement.
  // Surchargée dans Snake pour le rendu néon.
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    if (this.vel.mag() > 0.1) rotate(this.vel.heading());
    stroke(255);
    strokeWeight(1.5);
    fill(200);
    triangle(-this.r, -this.r / 2, -this.r, this.r / 2, this.r, 0);
    pop();

    if (Vehicle.debug) {
      push();
      stroke(255, 0, 0);
      strokeWeight(2);
      let fin = p5.Vector.add(this.pos, p5.Vector.mult(this.vel, 10));
      line(this.pos.x, this.pos.y, fin.x, fin.y);
      pop();
    }
  }
}
