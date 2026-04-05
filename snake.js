// ============================================================
// Snake — corps articulé dont la TÊTE est un véhicule
// Suit la structure du cours : extends Vehicle, this.anneaux,
// this.head, move(target), dessineTete(), dessineLesAnneaux()
// ============================================================
class Snake extends Vehicle {

  constructor(x, y) {
    super(x, y);

    this.r          = 13;   // rayon d'un anneau
    this.espacement = 20;   // distance cible entre anneaux

    // --- Tête ---
    this.head          = new Vehicle(x, y);
    this.head.maxSpeed = 7;
    this.head.maxForce = 0.85;  // vire serré → contrôle précis
    this.head.minSpeed = 4;     // ne s'arrête JAMAIS
    this.head.r        = this.r;
    this.head.vel      = createVector(4, 0);

    // --- Tableau de tous les anneaux (head = index 0) ---
    this.anneaux = [this.head];

    // Corps initial : 5 anneaux DÉCALÉS horizontalement (comme la correction)
    for (let i = 1; i <= 5; i++) {
      let anneau = new Vehicle(x - i * this.espacement, y);
      anneau.maxSpeed            = 10;
      anneau.maxForce            = 1.4;
      anneau.r                   = this.r;
      anneau.rayonZoneDeFreinage = this.espacement * 3.5;
      this.anneaux.push(anneau);
    }

    // Historique pour le sillage lumineux (effet visuel)
    this.sillage = [];
  }

  // ----------------------------------------------------------
  // move : déplace la tête vers la cible, le corps en chaîne
  //   target    : p5.Vector — position de la souris
  //   obstacles : tableau d'Obstacle à éviter (optionnel)
  // ----------------------------------------------------------
  move(target, obstacles = []) {
    // Sillage : on mémorise les positions passées de la tête
    this.sillage.unshift(this.head.pos.copy());
    if (this.sillage.length > 20) this.sillage.pop();

    // La tête suit la souris — PAS d'évitement automatique
    // C'est AU JOUEUR d'esquiver les obstacles (sinon → trop facile, pas fun)
    this.head.applyForce(this.head.seek(target));
    this.head.update();

    // Vitesse minimale : le serpent ne s'arrête jamais
    if (this.head.vel.mag() < this.head.minSpeed) {
      this.head.vel.setMag(this.head.minSpeed);
    }
    // Pas de edges() → sortir du canvas = mort

    // Chaque anneau arrive() sur l'anneau précédent
    for (let i = 1; i < this.anneaux.length; i++) {
      let cible = this.anneaux[i - 1].pos;
      let f     = this.anneaux[i].arrive(cible, this.espacement);
      this.anneaux[i].applyForce(f);
      this.anneaux[i].update();
    }
  }

  // ----------------------------------------------------------
  // rapetisser : retire 2 anneaux à la queue (nourriture poison)
  // Conserve toujours au moins tête + 1 anneau.
  // ----------------------------------------------------------
  rapetisser() {
    let n = min(2, this.anneaux.length - 2);
    for (let k = 0; k < n; k++) this.anneaux.pop();
  }

  // ----------------------------------------------------------
  // grandir : ajoute 2 anneaux à la queue (quand on mange)
  // ----------------------------------------------------------
  grandir() {
    for (let k = 0; k < 2; k++) {
      let dernier = this.anneaux[this.anneaux.length - 1];
      let anneau  = new Vehicle(dernier.pos.x, dernier.pos.y);
      anneau.maxSpeed            = 10;
      anneau.maxForce            = 1.4;
      anneau.r                   = this.r;
      anneau.rayonZoneDeFreinage = this.espacement * 3.5;
      this.anneaux.push(anneau);
    }
  }

  // ----------------------------------------------------------
  // aMange : vrai si la tête touche la nourriture
  // ----------------------------------------------------------
  aMange(nourriture) {
    return p5.Vector.dist(this.head.pos, nourriture) < this.r + 12;
  }

  // ----------------------------------------------------------
  // toucheCorps : vrai si la tête touche son propre corps
  // On ignore les 6 premiers segments (trop proches de la tête)
  // ----------------------------------------------------------
  toucheCorps() {
    for (let i = 6; i < this.anneaux.length; i++) {
      if (p5.Vector.dist(this.head.pos, this.anneaux[i].pos) < this.r * 1.4) {
        return true;
      }
    }
    return false;
  }

  // ----------------------------------------------------------
  // horsEcran : vrai si la tête sort du canvas (mort sur mur)
  // ----------------------------------------------------------
  horsEcran() {
    return (
      this.head.pos.x < 0     ||
      this.head.pos.x > width ||
      this.head.pos.y < 0     ||
      this.head.pos.y > height
    );
  }

  // ----------------------------------------------------------
  // toucheObstacle : vrai si la tête heurte un obstacle
  // ----------------------------------------------------------
  toucheObstacle(obstacles) {
    for (let obs of obstacles) {
      if (p5.Vector.dist(this.head.pos, obs.pos) < this.r + obs.r - 4) {
        return true;
      }
    }
    return false;
  }

  // ----------------------------------------------------------
  // show : point d'entrée du rendu (comme la correction)
  // ----------------------------------------------------------
  show() {
    this.dessinerSillage();
    this.dessinerLesAnneaux();
    this.dessinerTete();
    if (Vehicle.debug) this.debugVecteurs();
  }

  // Traîne lumineuse derrière la tête
  dessinerSillage() {
    push();
    noFill();
    strokeCap(ROUND);
    for (let i = 1; i < this.sillage.length; i++) {
      let a = map(i, 0, this.sillage.length, 180, 0);
      let w = map(i, 0, this.sillage.length, this.r * 1.2, 1);
      stroke(0, 255, 120, a);
      strokeWeight(w);
      line(
        this.sillage[i - 1].x, this.sillage[i - 1].y,
        this.sillage[i].x,     this.sillage[i].y
      );
    }
    pop();
  }

  // Corps : tube néon dont la COULEUR change selon la vitesse
  //   lent  → vert
  //   rapide → cyan
  //   boost  → blanc-bleu
  dessinerLesAnneaux() {
    // Ratio vitesse 0-1
    let vr = constrain(map(this.head.vel.mag(), 0, this.head.maxSpeed, 0, 1), 0, 1);

    // Couleurs interpolées selon vitesse
    let cTete  = lerpColor(color(0, 210, 80),  color(0, 190, 255), vr);
    let cQueue = lerpColor(color(0, 70, 20),   color(0, 40, 120),  vr);
    let glowR  = lerp(0,   0,   vr);
    let glowG  = lerp(255, 180, vr);
    let glowB  = lerp(80,  255, vr);

    push();
    strokeCap(ROUND);
    noFill();

    // Passe 1 : tube principal avec glow coloré
    for (let i = 1; i < this.anneaux.length; i++) {
      let a = this.anneaux[i - 1].pos;
      let b = this.anneaux[i].pos;
      if (p5.Vector.dist(a, b) > this.espacement * 4) continue;

      let t   = map(i, 0, this.anneaux.length - 1, 0, 1);
      let ga  = lerp(0.85, 0.1, t);

      drawingContext.shadowBlur  = 22;
      drawingContext.shadowColor = `rgba(${glowR},${glowG},${glowB},${ga})`;

      stroke(lerpColor(cTete, cQueue, t));
      strokeWeight(this.r * 1.8);
      line(a.x, a.y, b.x, b.y);
    }
    drawingContext.shadowBlur = 0;

    // Passe 2 : reflet brillant au centre
    for (let i = 1; i < this.anneaux.length; i++) {
      let a = this.anneaux[i - 1].pos;
      let b = this.anneaux[i].pos;
      if (p5.Vector.dist(a, b) > this.espacement * 4) continue;

      let t = map(i, 0, this.anneaux.length - 1, 0, 1);
      stroke(200, 255, lerp(210, 255, vr), lerp(200, 40, t));
      strokeWeight(this.r * 0.35);
      line(a.x, a.y, b.x, b.y);
    }
    pop();
  }

  // Tête : triangle véhicule néon (tourne dans la direction du mouvement)
  dessinerTete() {
    push();
    translate(this.head.pos.x, this.head.pos.y);
    if (this.head.vel.mag() > 0.1) rotate(this.head.vel.heading());

    let r = this.r;

    // Aura pulsante
    let pulse = sin(frameCount * 0.12) * 5;
    noStroke();
    fill(0, 255, 100, 25);
    circle(0, 0, r * 4 + pulse);

    // Glow fort
    drawingContext.shadowBlur  = 45;
    drawingContext.shadowColor = 'rgba(0,255,120,1)';

    // Triangle principal
    fill(60, 255, 110);
    stroke(200, 255, 215);
    strokeWeight(2);
    triangle(-r, -r * 0.65, -r, r * 0.65, r * 1.2, 0);

    // Reflet avant
    stroke(255, 255, 255, 160);
    strokeWeight(1.5);
    line(0, -r * 0.4, r * 1.2, 0);

    drawingContext.shadowBlur = 0;

    // Yeux
    fill(0, 15, 0);
    noStroke();
    circle(r * 0.3, -r * 0.27, r * 0.45);
    circle(r * 0.3,  r * 0.27, r * 0.45);

    // Pupilles néon
    drawingContext.shadowBlur  = 8;
    drawingContext.shadowColor = 'rgba(0,255,80,1)';
    fill(0, 255, 80);
    circle(r * 0.32, -r * 0.29, r * 0.22);
    circle(r * 0.32,  r * 0.25, r * 0.22);
    drawingContext.shadowBlur = 0;

    // Reflets
    fill(255, 255, 255, 200);
    circle(r * 0.38, -r * 0.33, r * 0.09);
    circle(r * 0.38,  r * 0.21, r * 0.09);

    pop();
  }

  // Debug : vecteurs vitesse de chaque anneau
  debugVecteurs() {
    push();
    stroke(255, 80, 80);
    strokeWeight(1.5);
    for (let anneau of this.anneaux) {
      let fin = p5.Vector.add(anneau.pos, p5.Vector.mult(anneau.vel, 8));
      line(anneau.pos.x, anneau.pos.y, fin.x, fin.y);
    }
    pop();
  }
}
