// ============================================================
// Snake — Steering Behaviors  ·  p5.js  ·  Thème Néon
// ------------------------------------------------------------
//  R / Esc  — Menu
//  D        — Debug
//  M        — Mute sons          B — Mute musique
//  O / P    — + / - obstacle
//  1/2/3    — Difficulté (menu)
// ============================================================

// ── État ─────────────────────────────────────────────────
let etat          = 'menu';
let causeDefaite  = '';
let difficulte    = 'normal';
let gameOverAlpha = 0;
let temps         = 0;

// ── Jeu ──────────────────────────────────────────────────
let snake;
let nourritures = [];
let obstacles   = [];
let score       = 0;
let highScore   = parseInt(localStorage.getItem('snakeHS') || '0');
let niveau      = 1;
let combo       = 1;
let lastEatTime = 0;
let speedBoost  = 0;

// ── Bouclier ─────────────────────────────────────────────
let bouclierActif = false;
let bouclierTimer = 0;
const BOUCLIER_DUR = 240;

// ── RAGE MODE ────────────────────────────────────────────
let rageActif    = false;
let rageTimer    = 0;
let rageDeclenche = false;   // évite double déclenchement par combo
const RAGE_DUR   = 300;      // 5 s
const RAGE_SEUIL = 5;        // combo min pour déclencher

// ── Zone bonus ───────────────────────────────────────────
let zoneBonus = null;        // créée dès niveau 2

// ── Portails & Rival ─────────────────────────────────────
let portail = null;          // paire de téléporteurs (niveau 3)
let rival   = null;          // serpent IA rival (niveau 6)

// ── Fond ─────────────────────────────────────────────────
let etoiles = [];   // générées dans setup()

// ── Effets ───────────────────────────────────────────────
let particules  = [];
let ondes       = [];
let scoreTextes = [];
let msgNiveau   = null;
let flashAlpha  = 0;
let flashCol    = null;

// ── Shake ────────────────────────────────────────────────
let shakeDur = 0, shakeAmt = 0;

// ── Audio ────────────────────────────────────────────────
let audioCtx = null;
let sonActif = true, musiqueON = true;
const BASS_MIDI = [45, 40, 48, 43];
const ARP_MIDI  = [69, 72, 76, 79, 76, 72];
let   musicStep = 0;

// ─────────────────────────────────────────────────────────
// CONFIG DIFFICULTÉ
// ─────────────────────────────────────────────────────────
function cfg() {
  if (difficulte === 'facile') return {
    vitesse: 5, maxForce: 0.55, nbObs: 1, obsVit: [0.3, 0.7],
    timerFood: 720, poisonProb: 0, shieldProb: 0.10, baseBPM: 85
  };
  if (difficulte === 'enfer') return {
    vitesse: 9, maxForce: 0.90, nbObs: 5, obsVit: [0.9, 2.0],
    timerFood: 300, poisonProb: 0.18, shieldProb: 0.05, baseBPM: 130
  };
  return {
    vitesse: 7, maxForce: 0.75, nbObs: 3, obsVit: [0.4, 1.1],
    timerFood: 540, poisonProb: 0.10, shieldProb: 0.07, baseBPM: 100
  };
}

// Fenêtre combo (raccourcit avec le niveau)
function fenetreCombo() {
  if (niveau >= 7) return 1500;
  if (niveau >= 4) return 2000;
  return 2500;
}

// ─────────────────────────────────────────────────────────
// SETUP / DRAW
// ─────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  _genererEtoiles();
}

function _genererEtoiles() {
  etoiles = [];
  for (let i = 0; i < 150; i++) {
    etoiles.push({
      x:     random(width),
      y:     random(height),
      r:     random(0.4, 2.4),
      phase: random(TWO_PI),
      freq:  random(0.012, 0.055)
    });
  }
}

function draw() {
  temps++;
  background(8, 13, 22);
  dessinerNebuleuse();
  dessinerEtoiles();
  dessinerGrille();
  dessinerScanlines();
  dessinerVignette();

  // Screen shake
  if (shakeDur > 0) {
    translate(random(-shakeAmt*(shakeDur/20), shakeAmt*(shakeDur/20)),
              random(-shakeAmt*(shakeDur/20), shakeAmt*(shakeDur/20)));
    shakeDur--;
  }

  if      (etat === 'menu')  { dessinerMenu(); return; }
  else if (etat === 'perdu') { dessinerGameOverFrame(); return; }

  // ──────────── MODE JEU ───────────────────────────────

  // Flash overlay
  if (flashAlpha > 0) {
    push(); noStroke();
    let c = flashCol || color(0,255,80);
    fill(red(c),green(c),blue(c), flashAlpha);
    rect(0,0,width,height);
    flashAlpha = max(0, flashAlpha - 12);
    pop();
  }

  // ── RAGE overlay ──────────────────────────────────────
  if (rageActif) {
    rageTimer--;
    if (rageTimer <= 0) { rageActif = false; rageDeclenche = false; }
    let rPulse = sin(temps * 0.22) * 0.5 + 0.5;
    push(); noStroke();
    fill(255, 60, 0, 20 + rPulse * 25);
    rect(0,0,width,height);
    // Bordure rage
    drawingContext.shadowBlur  = 40;
    drawingContext.shadowColor = `rgba(255,80,0,${0.6+rPulse*0.3})`;
    noFill(); stroke(255, 80 + rPulse*60, 0, 180 + rPulse*60);
    strokeWeight(6);
    rect(6,6,width-12,height-12,8);
    drawingContext.shadowBlur = 0;
    pop();
  }

  // ── Vitesse max dynamique ──────────────────────────────
  if (speedBoost > 0) {
    push(); noStroke();
    fill(0,150,255, sin(temps*0.3)*18+12);
    rect(0,0,width,height); pop();
    speedBoost--;
    snake.head.maxSpeed = min(18, cfg().vitesse * 2);
  } else {
    let baseV = cfg().vitesse + score * 0.35;
    snake.head.maxSpeed = min(difficulte==='enfer'?16:14,
                              rageActif ? baseV * 1.4 : baseV);
  }
  snake.head.maxForce = min(cfg().maxForce + 0.3,
                            cfg().maxForce + score * 0.012);

  dessinerBordureDanger();

  // Zone bonus
  if (zoneBonus) { zoneBonus.update(); zoneBonus.show(); }

  // Portails
  if (portail) portail.update();

  for (let obs of obstacles) obs.update();
  for (let n of nourritures) n.update();

  // Rival IA
  if (rival) { rival.move(); rival.mangeFoods(); }

  for (let i = ondes.length-1; i>=0; i--) {
    ondes[i].update(); ondes[i].show();
    if (ondes[i].estMorte()) ondes.splice(i,1);
  }

  if (portail) portail.show();
  for (let n of nourritures) n.show();
  for (let o of obstacles)   o.show();
  if (rival) rival.show();

  for (let i = particules.length-1; i>=0; i--) {
    particules[i].update(); particules[i].show();
    if (particules[i].estMorte()) particules.splice(i,1);
  }
  for (let i = scoreTextes.length-1; i>=0; i--) {
    scoreTextes[i].update(); scoreTextes[i].show();
    if (scoreTextes[i].estMort()) scoreTextes.splice(i,1);
  }
  if (msgNiveau) {
    msgNiveau.update(); msgNiveau.show();
    if (msgNiveau.estMort()) msgNiveau = null;
  }

  // Bouclier timer
  if (bouclierActif) {
    bouclierTimer--;
    if (bouclierTimer <= 0) { bouclierActif=false; jouerSon('bouclierExpire'); }
  }

  miseAJourMusique();
  snake.move(createVector(mouseX, mouseY), obstacles);

  // ── Morts ─────────────────────────────────────────────
  if (snake.horsEcran()) {
    if (bouclierActif) absorberDegat('mur'); else { mourir('mur'); return; }
  }
  // (collision corps désactivée — on traverse son propre corps)
  if (snake.toucheObstacle(obstacles)) {
    if (bouclierActif) absorberDegat('obstacle'); else { mourir('obstacle'); return; }
  }

  // ── Collision avec le rival ───────────────────────────
  if (rival && rival.toucheJoueur()) {
    rival.cooldownHit = 60;
    if (bouclierActif) {
      absorberDegat('rival');
    } else {
      score = max(0, score - 3); combo = 1;
      demarrerTremblement(8, 15);
      flashAlpha = 100; flashCol = color(255, 60, 0);
      jouerSon('rivalHit');
      scoreTextes.push(new ScoreTexte(snake.head.pos.x, snake.head.pos.y-44, '-3  🐍 RIVAL !', 3));
    }
  }

  // ── Nourriture ────────────────────────────────────────
  for (let i = nourritures.length-1; i>=0; i--) {
    if (!snake.aMange(nourritures[i].pos)) continue;

    let nx   = nourritures[i].pos.x;
    let ny   = nourritures[i].pos.y;
    let type = nourritures[i].type;
    let val  = nourritures[i].valeur;

    if (type === 3) {
      score = max(0, score - 2);
      snake.rapetisser();
      flashAlpha = 80; flashCol = color(180,0,255);
      demarrerTremblement(5,10);
      scoreTextes.push(new ScoreTexte(nx, ny, '-2  ☠️', 3));
      for (let p=0;p<16;p++) particules.push(new Etincelle(nx,ny,3));
      jouerSon('poison');

    } else if (type === 4) {
      bouclierActif = true; bouclierTimer = BOUCLIER_DUR;
      flashAlpha = 50; flashCol = color(200,230,255);
      scoreTextes.push(new ScoreTexte(nx, ny, '🛡️ BOUCLIER', 4));
      for (let p=0;p<20;p++) particules.push(new Etincelle(nx,ny,4));
      jouerSon('shield');

    } else {
      let maintenant = millis();
      combo = (maintenant - lastEatTime < fenetreCombo()) ? combo+1 : 1;
      lastEatTime = maintenant;

      // Multiplicateur zone bonus
      let multZone = (zoneBonus && zoneBonus.estDedans(snake.head.pos)) ? 2 : 1;
      if (multZone === 2) {
        scoreTextes.push(new ScoreTexte(nx, ny-50, '🌟 ZONE ×2', 5));
        jouerSon('zoneBonus');
        demarrerTremblement(3,7);
      }

      // Multiplicateur rage
      let multRage = rageActif ? 1.5 : 1;

      let points = floor(val * combo * multZone * multRage);
      score += points;
      if (score > highScore) { highScore = score; localStorage.setItem('snakeHS', highScore); }

      flashAlpha = 55; flashCol = color(0,255,80);
      ondes.push(new Onde(nx,ny));
      for (let p=0;p<22;p++) particules.push(new Etincelle(nx,ny,type));
      demarrerTremblement(3.5,8);

      let label = combo>1 ? `+${points}  ×${combo}` : `+${points}`;
      if (rageActif) label += '  🔥';
      scoreTextes.push(new ScoreTexte(nx, ny-10, label, type));

      if      (type === 1) jouerSon('mangerOr');
      else if (combo  > 1) jouerSon('combo');
      else                 jouerSon('manger');

      if (type === 2) {
        speedBoost = 180;
        scoreTextes.push(new ScoreTexte(nx, ny-50, '⚡ BOOST !', 2));
        jouerSon('boost');
      }

      // ── RAGE MODE déclenchement ────────────────────────
      if (combo >= RAGE_SEUIL && !rageDeclenche) {
        rageActif     = true;
        rageTimer     = RAGE_DUR;
        rageDeclenche = true;
        scoreTextes.push(new ScoreTexte(width/2, height/2+20, '🔥 RAGE MODE !', 6));
        demarrerTremblement(14, 30);
        jouerSon('rage');
      }

      snake.grandir();
      snake.head.maxSpeed = min(difficulte==='enfer'?16:14, cfg().vitesse + score*0.35);
    }

    nourritures.splice(i,1);
    nourritures.push(new Nourriture());

    let nvNiveau = floor(score/10)+1;
    if (nvNiveau > niveau) {
      niveau = nvNiveau;
      obstacles.push(spawnerObstacle());
      msgNiveau = new NiveauTexte(niveau);
      jouerSon('niveauUp');
      demarrerTremblement(7,18);
      if (niveau >= 2 && !zoneBonus) zoneBonus = new ZoneBonus();
      if (niveau >= 3 && !portail)   portail   = new Portail();
      if (niveau >= 6 && !rival)     rival     = new RivalSnake(random(150,width-150), random(150,height-150));
    }
  }

  snake.show();
  dessinerBouclier();
  dessinerHUD();
}

// ─────────────────────────────────────────────────────────
// MENU
// ─────────────────────────────────────────────────────────
function dessinerMenu() {
  push();
  textAlign(CENTER, CENTER);
  let titre = 'SNAKE';
  for (let i = 0; i < titre.length; i++) {
    let x = width/2 + (i-2)*72;
    let y = height/2 - 160 + sin(temps*0.05 + i*0.8)*12;
    drawingContext.shadowBlur  = 55;
    drawingContext.shadowColor = 'rgba(0,255,100,0.9)';
    fill(0,255,120); textStyle(BOLD); textSize(88 + sin(temps*0.05+i)*5);
    text(titre[i], x, y);
  }
  drawingContext.shadowBlur = 0;

  textSize(17); textStyle(NORMAL); fill(0,160,80);
  text('Steering Behaviors · p5.js · Néon', width/2, height/2-78);

  if (highScore > 0) {
    drawingContext.shadowBlur  = 18; drawingContext.shadowColor = 'rgba(255,200,0,0.8)';
    textSize(18); fill(255,210,0);
    text(`🏆  Record : ${nf(highScore,2)}`, width/2, height/2-42);
    drawingContext.shadowBlur = 0;
  }

  // Boutons
  let diffs = ['FACILE', 'NORMAL', 'ENFER 🔥'];
  let cols  = [color(0,220,100), color(0,160,255), color(255,70,20)];
  let descs = ['Obstacles lents · pas de poison',
               'Équilibré · poison rare · rage',
               'Rapide · obstacles seekers · chaos'];
  let bW=190, bH=58, gap=28, totalW=3*bW+2*gap;
  let bx0 = width/2-totalW/2, by = height/2+18;

  for (let i=0; i<3; i++) {
    let bx    = bx0 + i*(bW+gap);
    let hover = mouseX>bx&&mouseX<bx+bW&&mouseY>by&&mouseY<by+bH;
    let sel   = difficulte === ['facile','normal','enfer'][i];

    drawingContext.shadowBlur  = hover||sel ? 35 : 12;
    drawingContext.shadowColor = `rgba(${red(cols[i])},${green(cols[i])},${blue(cols[i])},0.9)`;
    stroke(cols[i]); strokeWeight(hover||sel?3:1.5);
    fill(red(cols[i]),green(cols[i]),blue(cols[i]), hover||sel?70:25);
    rect(bx,by,bW,bH,10);
    drawingContext.shadowBlur = 0;

    noStroke(); fill(cols[i]); textSize(21); textStyle(BOLD);
    text(diffs[i], bx+bW/2, by+bH/2-2);

    if (sel) {
      textSize(11); textStyle(NORMAL);
      fill(red(cols[i]),green(cols[i]),blue(cols[i]),160);
      text(descs[i], bx+bW/2, by+bH+14);
    }
  }

  let pulse = sin(temps*0.07)*0.4+0.6;
  textSize(15); textStyle(NORMAL); fill(100,180,140, 200*pulse);
  text('Clique ou  1 / 2 / 3  pour commencer', width/2, height/2+118);
  pop();
}

// ─────────────────────────────────────────────────────────
// INIT JEU
// ─────────────────────────────────────────────────────────
function demarrerJeu() {
  snake = new Snake(width/2, height/2);
  nourritures=[]; obstacles=[]; score=0; niveau=1; combo=1;
  speedBoost=0; particules=[]; ondes=[]; scoreTextes=[];
  flashAlpha=0; flashCol=null; msgNiveau=null; etat='jeu';
  causeDefaite=''; gameOverAlpha=0; shakeDur=0;
  bouclierActif=false; bouclierTimer=0; musicStep=0;
  rageActif=false; rageTimer=0; rageDeclenche=false;
  zoneBonus = null; portail = null; rival = null;

  let c=cfg();
  snake.head.maxSpeed = c.vitesse;
  snake.head.maxForce = c.maxForce;

  for (let i=0;i<3;i++) nourritures.push(new Nourriture());
  for (let i=0;i<c.nbObs;i++) obstacles.push(spawnerObstacle());
}

function spawnerObstacle() {
  let m=120, c=cfg();
  let seekMode = niveau>=5 && random()<0.4;
  return new Obstacle(
    random(m, width-m), random(m, height-m),
    random(22,42), c.obsVit, seekMode
  );
}

// ─────────────────────────────────────────────────────────
// ZONE BONUS (rectangle doré ×2)
// ─────────────────────────────────────────────────────────
class ZoneBonus {
  constructor() { this._spawn(); }
  _spawn() {
    let m = 120;
    this.x = random(m, width  - m - 180);
    this.y = random(m, height - m - 130);
    this.w = random(130, 200);
    this.h = random(90,  140);
    this.timer    = 900;
    this.timerMax = 900;
  }
  estDedans(pos) {
    return pos.x > this.x && pos.x < this.x+this.w &&
           pos.y > this.y && pos.y < this.y+this.h;
  }
  update() {
    this.timer--;
    if (this.timer <= 0) {
      jouerSon('zoneMove');
      this._spawn();
    }
  }
  show() {
    let ratio  = this.timer / this.timerMax;
    let pulse  = sin(temps*0.06)*0.3+0.7;
    let urgent = ratio < 0.2;
    push();
    drawingContext.shadowBlur  = urgent ? 40 : 22;
    drawingContext.shadowColor = urgent ? 'rgba(255,80,0,0.8)' : 'rgba(255,200,0,0.6)';
    noFill();
    stroke(urgent ? color(255,100,0,200) : color(255,200,0,170*pulse));
    strokeWeight(urgent ? 3 : 2);
    // Dashes manuels
    for (let dx=0; dx<this.w; dx+=18) {
      let a = this.x+dx, b = min(this.x+dx+11, this.x+this.w);
      line(a, this.y, b, this.y);
      line(a, this.y+this.h, b, this.y+this.h);
    }
    for (let dy=0; dy<this.h; dy+=18) {
      let a = this.y+dy, b = min(this.y+dy+11, this.y+this.h);
      line(this.x, a, this.x, b);
      line(this.x+this.w, a, this.x+this.w, b);
    }
    // Fond semi-transparent
    fill(255,200,0, urgent ? 8+pulse*12 : 6+pulse*8);
    rect(this.x, this.y, this.w, this.h, 6);

    // Label
    drawingContext.shadowBlur  = 18;
    drawingContext.shadowColor = 'rgba(255,220,0,0.9)';
    noStroke(); fill(255,220,0, 180*pulse); textStyle(BOLD);
    textAlign(CENTER, CENTER); textSize(22);
    text('× 2', this.x+this.w/2, this.y+this.h/2);

    // Barre de temps
    noFill(); stroke(255,200,0,80); strokeWeight(1.5);
    let barW = this.w*ratio;
    line(this.x, this.y+this.h+8, this.x+barW, this.y+this.h+8);
    drawingContext.shadowBlur = 0;
    pop();
  }
}

// ─────────────────────────────────────────────────────────
// PORTAIL — paire de téléporteurs (apparaît au niveau 3)
// ─────────────────────────────────────────────────────────
class Portail {
  constructor() { this._spawner(); }
  _spawner() {
    let m = 110;
    this.posA     = createVector(random(m, width/2 - m),  random(m, height-m));
    this.posB     = createVector(random(width/2+m, width-m), random(m, height-m));
    this.r        = 28;
    this.cooldown = 0;
    this.anim     = 0;
  }
  update() {
    this.anim += 0.04;
    if (this.cooldown > 0) { this.cooldown--; return; }
    if (!snake || etat !== 'jeu') return;
    let dA = p5.Vector.dist(snake.head.pos, this.posA);
    let dB = p5.Vector.dist(snake.head.pos, this.posB);
    if (dA < this.r * 0.9) {
      snake.head.pos.set(this.posB.x, this.posB.y);
      this.cooldown = 40; jouerSon('portail');
      demarrerTremblement(5, 12);
      flashAlpha = 90; flashCol = color(100, 60, 255);
      scoreTextes.push(new ScoreTexte(this.posB.x, this.posB.y-45, '🌀 PORTAIL !', 7));
    } else if (dB < this.r * 0.9) {
      snake.head.pos.set(this.posA.x, this.posA.y);
      this.cooldown = 40; jouerSon('portail');
      demarrerTremblement(5, 12);
      flashAlpha = 90; flashCol = color(100, 60, 255);
      scoreTextes.push(new ScoreTexte(this.posA.x, this.posA.y-45, '🌀 PORTAIL !', 7));
    }
  }
  show() {
    this._dessinerPorte(this.posA, color(130, 60, 255), 0);
    this._dessinerPorte(this.posB, color(0,   200, 255), PI);
    // Ligne reliant les deux portails
    push();
    let a = sin(this.anim) * 0.3 + 0.4;
    stroke(140, 100, 255, 35 * a); strokeWeight(1); noFill();
    line(this.posA.x, this.posA.y, this.posB.x, this.posB.y);
    pop();
  }
  _dessinerPorte(pos, col, offset) {
    let pulse = sin(this.anim * 1.4 + offset) * 0.3 + 0.7;
    push(); translate(pos.x, pos.y);
    drawingContext.shadowBlur  = 45;
    drawingContext.shadowColor = `rgba(${red(col)},${green(col)},${blue(col)},0.85)`;
    noFill(); stroke(col); strokeWeight(3);
    circle(0, 0, this.r * 2);
    strokeWeight(1.5); stroke(red(col), green(col), blue(col), 140 * pulse);
    circle(0, 0, this.r * 1.4);
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = `rgba(${red(col)},${green(col)},${blue(col)},1)`;
    noStroke(); fill(red(col), green(col), blue(col), 200 * pulse);
    for (let i = 0; i < 5; i++) {
      let a = TWO_PI/5 * i + this.anim * 1.5 + offset;
      circle(cos(a) * this.r * 0.7, sin(a) * this.r * 0.7, 5);
    }
    fill(red(col), green(col), blue(col), 18 * pulse);
    noStroke(); circle(0, 0, this.r * 1.8);
    drawingContext.shadowBlur = 0;
    pop();
  }
}

// ─────────────────────────────────────────────────────────
// SERPENT RIVAL — IA autonome (extends Vehicle)
//   Comportements de pilotage (Craig Reynolds) :
//   · seek(nourriture) — fonce vers la nourriture proche
//   · flee(joueur)     — s'éloigne si le joueur est trop près
//   · wander()         — déambulation Perlin quand rien à faire
// ─────────────────────────────────────────────────────────
class RivalSnake extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.r          = 11;
    this.espacement = 18;

    this.head          = new Vehicle(x, y);
    this.head.maxSpeed = 4.5;
    this.head.maxForce = 0.65;
    this.head.minSpeed = 2.5;
    this.head.r        = this.r;
    this.head.vel      = p5.Vector.random2D().mult(3);

    this.anneaux = [this.head];
    for (let i = 1; i <= 4; i++) {
      let a = new Vehicle(x - i * this.espacement, y);
      a.maxSpeed = 10; a.maxForce = 1.2; a.r = this.r;
      a.rayonZoneDeFreinage = this.espacement * 3;
      this.anneaux.push(a);
    }
    this.cooldownHit = 0;
  }

  _choisirCible() {
    if (!nourritures.length) return null;
    let nearest = null, dMin = Infinity;
    for (let nf of nourritures) {
      if (nf.type === 3 || nf.type === 4) continue;
      let d = p5.Vector.dist(this.head.pos, nf.pos);
      if (d < dMin) { dMin = d; nearest = nf; }
    }
    return nearest;
  }

  move() {
    let force = createVector(0, 0);
    let cible = this._choisirCible();
    let dp    = snake ? p5.Vector.dist(this.head.pos, snake.head.pos) : 9999;

    if (dp < 100) {
      // flee() : s'éloigne du joueur (Vehicle)
      force.add(this.head.flee(snake.head.pos).mult(1.5));
    } else if (cible && p5.Vector.dist(this.head.pos, cible.pos) < 260) {
      // seek() : fonce vers la nourriture (Vehicle)
      force.add(this.head.seek(cible.pos).mult(1.15));
    } else {
      // wander() : déambulation Perlin (Vehicle)
      force.add(this.head.wander().mult(0.95));
    }

    this.head.applyForce(force);
    this.head.update();
    if (this.head.vel.mag() < this.head.minSpeed) this.head.vel.setMag(this.head.minSpeed);

    // Rebond sur les murs
    if (this.head.pos.x < 20 || this.head.pos.x > width - 20) {
      this.head.vel.x *= -1;
      this.head.pos.x  = constrain(this.head.pos.x, 20, width - 20);
    }
    if (this.head.pos.y < 20 || this.head.pos.y > height - 20) {
      this.head.vel.y *= -1;
      this.head.pos.y  = constrain(this.head.pos.y, 20, height - 20);
    }

    // Corps en chaîne : arrive() sur l'anneau précédent (Vehicle)
    for (let i = 1; i < this.anneaux.length; i++) {
      let f = this.anneaux[i].arrive(this.anneaux[i-1].pos, this.espacement);
      this.anneaux[i].applyForce(f);
      this.anneaux[i].update();
    }
    if (this.cooldownHit > 0) this.cooldownHit--;
  }

  grandir() {
    let d = this.anneaux[this.anneaux.length - 1];
    let a = new Vehicle(d.pos.x, d.pos.y);
    a.maxSpeed = 10; a.maxForce = 1.2; a.r = this.r;
    a.rayonZoneDeFreinage = this.espacement * 3;
    this.anneaux.push(a);
  }

  mangeFoods() {
    for (let i = nourritures.length - 1; i >= 0; i--) {
      let nf = nourritures[i];
      if (nf.type === 3 || nf.type === 4) continue;
      if (p5.Vector.dist(this.head.pos, nf.pos) < this.r + 12) {
        this.grandir();
        for (let p = 0; p < 12; p++) particules.push(new Etincelle(nf.pos.x, nf.pos.y, 6));
        nourritures.splice(i, 1);
        nourritures.push(new Nourriture());
        return true;
      }
    }
    return false;
  }

  // Tête du joueur touche un anneau du rival → pénalité
  toucheJoueur() {
    if (this.cooldownHit > 0 || !snake) return false;
    for (let ann of this.anneaux) {
      if (p5.Vector.dist(snake.head.pos, ann.pos) < snake.r + this.r * 0.9) return true;
    }
    return false;
  }

  show() {
    push();
    strokeCap(ROUND); noFill();
    // Corps rouge/orange
    for (let i = 1; i < this.anneaux.length; i++) {
      let a = this.anneaux[i-1].pos, b = this.anneaux[i].pos;
      if (p5.Vector.dist(a, b) > this.espacement * 4) continue;
      let t = map(i, 0, this.anneaux.length - 1, 0, 1);
      drawingContext.shadowBlur  = 20;
      drawingContext.shadowColor = `rgba(255,60,0,${lerp(0.8, 0.1, t)})`;
      stroke(lerpColor(color(255, 80, 0), color(100, 20, 0), t));
      strokeWeight(this.r * 1.6);
      line(a.x, a.y, b.x, b.y);
    }
    drawingContext.shadowBlur = 0;
    // Reflet
    for (let i = 1; i < this.anneaux.length; i++) {
      let a = this.anneaux[i-1].pos, b = this.anneaux[i].pos;
      if (p5.Vector.dist(a, b) > this.espacement * 4) continue;
      let t = map(i, 0, this.anneaux.length - 1, 0, 1);
      stroke(255, 200, 150, lerp(180, 30, t));
      strokeWeight(this.r * 0.28);
      line(a.x, a.y, b.x, b.y);
    }
    // Tête
    push();
    translate(this.head.pos.x, this.head.pos.y);
    if (this.head.vel.mag() > 0.1) rotate(this.head.vel.heading());
    let r     = this.r;
    let pulse = sin(frameCount * 0.12) * 4;
    noStroke(); fill(255, 60, 0, 22);
    circle(0, 0, r * 3.8 + pulse);
    drawingContext.shadowBlur = 40; drawingContext.shadowColor = 'rgba(255,80,0,1)';
    fill(255, 80, 0); stroke(255, 180, 100); strokeWeight(2);
    triangle(-r, -r * .62, -r, r * .62, r * 1.15, 0);
    drawingContext.shadowBlur = 0;
    fill(10, 0, 0); noStroke();
    circle(r * .3, -r * .26, r * .42);
    circle(r * .3,  r * .26, r * .42);
    drawingContext.shadowBlur = 8; drawingContext.shadowColor = 'rgba(255,0,0,1)';
    fill(255, 0, 0);
    circle(r * .32, -r * .28, r * .2);
    circle(r * .32,  r * .24, r * .2);
    drawingContext.shadowBlur = 0;
    pop();
    pop();
  }
}

// ─────────────────────────────────────────────────────────
// NOURRITURE — 5 types  (extends Vehicle → flee steering)
//   0 rouge  +1
//   1 or     +3 (fuit via flee())
//   2 boost  +1+vitesse (fuit via flee())
//   3 poison -2
//   4 bouclier (fuit via flee())
// ─────────────────────────────────────────────────────────
class Nourriture extends Vehicle {
  constructor() {
    let m = 80;
    super(random(m,width-m), random(m,height-m));
    this.maxSpeed = 2.8;
    this.maxForce = 0.5;
    this.a   = random(TWO_PI);
    let c=cfg(), r=random(), p=c.poisonProb, s=c.shieldProb;
    if      (r < p)           { this.type=3; this.valeur=0; }
    else if (r < p+s)         { this.type=4; this.valeur=0; }
    else if (r < p+s+0.12)    { this.type=2; this.valeur=1; }
    else if (r < p+s+0.30)    { this.type=1; this.valeur=3; }
    else                      { this.type=0; this.valeur=1; }
    this.timerMax = cfg().timerFood;
    this.timer    = this.timerMax;
    this.expired  = false;
  }
  update() {
    this.a += (this.type===1) ? 0.055 : 0.04;

    // flee() — comportement de pilotage (Craig Reynolds)
    if ((this.type===1||this.type===2||this.type===4) && snake) {
      let d = p5.Vector.dist(this.pos, snake.head.pos);
      if (d < 140) {
        let poids = map(d, 0, 140, 1.3, 0.05);
        this.applyForce(this.flee(snake.head.pos).mult(poids));
      }
    }
    // Friction : la nourriture statique ne dérive pas
    if (!(this.type===1||this.type===2||this.type===4)) {
      this.vel.set(0, 0);
    } else {
      this.vel.mult(0.88); // amortissement progressif
    }
    super.update(); // intègre acc → vel → pos
    this.pos.x = constrain(this.pos.x, 40, width-40);
    this.pos.y = constrain(this.pos.y, 40, height-40);

    this.timer--;
    if (this.timer <= 0) {
      // ── Pénalité expiration ──────────────────────────
      if (!this.expired) {
        this.expired = true;
        if (this.type === 1) { // Or : -1 pt
          score = max(0, score-1);
          scoreTextes.push(new ScoreTexte(this.pos.x, this.pos.y, '-1  ⌛', 3));
          jouerSon('expiration');
          flashAlpha = 35; flashCol = color(255,80,0);
          for (let p=0;p<10;p++) particules.push(new Etincelle(this.pos.x,this.pos.y,3));
        } else if (this.type === 0) { // Rouge : juste flash
          jouerSon('expirationBase');
        }
      }
      let m=80;
      this.pos = createVector(random(m,width-m), random(m,height-m));
      this.vel.set(0, 0); // reset vitesse au respawn
      this.timer = this.timerMax;
      this.expired = false;
    }
  }
  show() {
    let ratio  = this.timer / this.timerMax;
    let urgent = ratio < 0.25;
    // Arc countdown
    if (ratio < 0.75) {
      push(); translate(this.pos.x, this.pos.y); noFill();
      stroke(urgent ? color(255,50,50,230) : color(255,200,50,140));
      strokeWeight(urgent?2.5:1.8);
      if (urgent) { drawingContext.shadowBlur=12; drawingContext.shadowColor='rgba(255,0,0,0.9)'; }
      let arcR = (this.type===1)?30:23;
      arc(0,0,arcR*2,arcR*2,-HALF_PI,-HALF_PI+TWO_PI*ratio);
      drawingContext.shadowBlur=0; pop();
    }
    push(); translate(this.pos.x,this.pos.y); rotate(this.a); noStroke();

    if (this.type===0) {
      let p=sin(temps*0.09)*4;
      drawingContext.shadowBlur=50; drawingContext.shadowColor='rgba(255,50,100,0.85)';
      fill(220,40,80); etoile(0,0,6+p*.4,13+p,5);
      drawingContext.shadowBlur=18; drawingContext.shadowColor='rgba(255,200,220,1)';
      fill(255,170,195); etoile(0,0,3+p*.2,7+p*.5,5);

    } else if (this.type===1) {
      let p=sin(temps*0.07)*5;
      drawingContext.shadowBlur=65; drawingContext.shadowColor='rgba(255,210,0,1)';
      fill(255,190,0); etoile(0,0,8+p*.4,20+p,6);
      drawingContext.shadowBlur=25; drawingContext.shadowColor='rgba(255,255,150,1)';
      fill(255,245,120); etoile(0,0,4+p*.2,11+p*.5,6);
      drawingContext.shadowBlur=0;
      fill(80,40,0); rotate(-this.a); textAlign(CENTER,CENTER); textStyle(BOLD); textSize(11); text('×3',0,0);

    } else if (this.type===2) {
      let p=sin(temps*0.12)*4;
      drawingContext.shadowBlur=55; drawingContext.shadowColor='rgba(0,180,255,0.95)';
      fill(0,160,255); etoile(0,0,5+p*.4,15+p,4);
      drawingContext.shadowBlur=20; drawingContext.shadowColor='rgba(150,230,255,1)';
      fill(150,220,255); etoile(0,0,3+p*.2,8+p*.5,4);
      drawingContext.shadowBlur=0;
      fill(0,20,60); rotate(-this.a); textAlign(CENTER,CENTER); textSize(13); text('⚡',0,1);

    } else if (this.type===3) {
      let p=sin(temps*0.11)*3;
      drawingContext.shadowBlur=45; drawingContext.shadowColor='rgba(180,0,255,0.9)';
      fill(120,0,200); circle(0,0,20+p);
      drawingContext.shadowBlur=18; drawingContext.shadowColor='rgba(80,255,80,0.7)';
      fill(60,220,60); circle(0,0,10+p*.5);
      drawingContext.shadowBlur=0;
      fill(230,230,50); rotate(-this.a); textAlign(CENTER,CENTER); textSize(12); text('☠',0,1);

    } else if (this.type===4) {
      let p=sin(temps*0.08)*5;
      drawingContext.shadowBlur=60; drawingContext.shadowColor='rgba(180,230,255,1)';
      stroke(200,230,255,220); strokeWeight(2); fill(100,180,255,60); hexagone(0,0,16+p);
      drawingContext.shadowBlur=20; drawingContext.shadowColor='rgba(255,255,255,1)';
      noStroke(); fill(220,240,255); hexagone(0,0,9+p*.4);
      drawingContext.shadowBlur=0;
      fill(10,20,50); rotate(-this.a); textAlign(CENTER,CENTER); textSize(13); text('🛡',0,1);
    }
    drawingContext.shadowBlur=0;
    pop();
  }
}

// ─────────────────────────────────────────────────────────
// OBSTACLE — extends Vehicle
//   mode normal  : wander()  — déambulation Perlin (Craig Reynolds)
//   mode seeker  : seek()    — traque la tête du serpent
// ─────────────────────────────────────────────────────────
class Obstacle extends Vehicle {
  constructor(x, y, r, vitRange=[0.4,1.1], seeker=false) {
    super(x, y);
    this.r         = r;
    this.maxSpeed  = vitRange[1] * 1.15;
    this.maxForce  = seeker ? 0.09 : 0.16;
    this.vel       = p5.Vector.random2D().mult(random(vitRange[0], vitRange[1]));
    this.angle     = random(TWO_PI);
    this.seeker    = seeker;
    this.seekSpeed = random(0.4, 0.85);
  }
  update() {
    if (this.seeker && snake && etat === 'jeu') {
      // seek() : force = vitesseDésirée − vitesseActuelle (Vehicle)
      this.applyForce(this.seek(snake.head.pos).mult(0.11));
    } else {
      // wander() : déambulation Perlin continue (Vehicle)
      this.applyForce(this.wander().mult(0.20));
    }
    super.update(); // intègre acc → vel → pos
    if (this.seeker) this.vel.limit(this.seekSpeed);
    this.angle += 0.03;
    if (this.pos.x<this.r||this.pos.x>width-this.r)  { this.vel.x*=-1; this.pos.x=constrain(this.pos.x,this.r,width-this.r); }
    if (this.pos.y<this.r||this.pos.y>height-this.r)  { this.vel.y*=-1; this.pos.y=constrain(this.pos.y,this.r,height-this.r); }
  }
  show() {
    let distTete = snake ? p5.Vector.dist(this.pos, snake.head.pos) : 9999;
    let proche   = distTete < this.r + 110;
    let gi       = proche ? map(distTete,this.r,this.r+110,1.8,0.7) : 0.7;
    push();
    translate(this.pos.x, this.pos.y);

    // Couleur selon mode
    let clr = this.seeker ? color(255, 30, 200) : color(255, 90, 20);
    drawingContext.shadowBlur  = 35*gi;
    drawingContext.shadowColor = `rgba(${red(clr)},${green(clr)},${blue(clr)},${0.7*gi})`;
    stroke(clr); strokeWeight(proche?3:2);
    fill(red(clr)*0.25,0,blue(clr)*0.1, 180);
    circle(0,0,this.r*2);

    // Anneau d'alerte pour seekers
    if (this.seeker) {
      if (proche && sin(temps*0.25)>0) {
        drawingContext.shadowBlur  = 25;
        drawingContext.shadowColor = 'rgba(255,0,200,1)';
        stroke(255,0,200, 200); strokeWeight(1.5);
        circle(0,0,this.r*3);
      }
      // Petite flèche pointant vers la tête
      if (snake) {
        let a = p5.Vector.sub(snake.head.pos, this.pos).heading();
        push(); rotate(a);
        stroke(clr); strokeWeight(2); fill(clr);
        let ar = this.r*0.55;
        triangle(ar,0, ar*0.4,-5, ar*0.4,5);
        pop();
      }
    } else if (proche && sin(temps*0.25)>0) {
      drawingContext.shadowBlur=20; drawingContext.shadowColor='rgba(255,0,0,1)';
      stroke(255,30,30,190); strokeWeight(1.5); circle(0,0,this.r*2.8);
    }
    drawingContext.shadowBlur=0;
    rotate(this.angle);
    let d=this.r*0.6;
    stroke(clr,200); strokeWeight(2); line(-d,0,d,0); line(0,-d,0,d);
    rotate(PI/4); stroke(clr,90); strokeWeight(1); line(-d*.7,0,d*.7,0); line(0,-d*.7,0,d*.7);
    pop();
  }
}

// ─────────────────────────────────────────────────────────
// FOND
// ─────────────────────────────────────────────────────────

// Nébuleuses : 3 blobs colorés qui dérivent lentement (Perlin)
function dessinerNebuleuse() {
  const blobs = [
    { tx:0.0008, ty:0.0012, tc:0.0010, r:180, g:0,   b:255, sz:340 },
    { tx:0.0015, ty:0.0007, tc:0.0018, r:0,   g:90,  b:210, sz:300 },
    { tx:0.0010, ty:0.0016, tc:0.0006, r:0,   g:170, b:130, sz:270 },
  ];
  let t = temps * 0.5;
  for (let blob of blobs) {
    let cx   = noise(t * blob.tx)          * width;
    let cy   = noise(t * blob.ty + 50)     * height;
    let size = blob.sz * (noise(t * blob.tc + 100) * 0.35 + 0.82);
    let alp  = noise(t * blob.tc + 200) * 0.055 + 0.025;
    let r = rageActif ? lerp(blob.r, 255, 0.55) : blob.r;
    let g = rageActif ? lerp(blob.g, 50,  0.55) : blob.g;
    let b = rageActif ? lerp(blob.b, 0,   0.55) : blob.b;
    let gr = drawingContext.createRadialGradient(cx, cy, 0, cx, cy, size);
    gr.addColorStop(0,   `rgba(${r|0},${g|0},${b|0},${alp})`);
    gr.addColorStop(0.45,`rgba(${r|0},${g|0},${b|0},${alp*0.28})`);
    gr.addColorStop(1,   'rgba(0,0,0,0)');
    drawingContext.fillStyle = gr;
    drawingContext.fillRect(0, 0, width, height);
  }
}

// Étoiles scintillantes
function dessinerEtoiles() {
  push(); noStroke();
  for (let e of etoiles) {
    let alpha = map(sin(temps * e.freq + e.phase), -1, 1, 15, 190);
    let r     = e.r * map(sin(temps * e.freq * 1.5 + e.phase + 1), -1, 1, 0.65, 1.35);
    fill(e.r < 1.3 ? color(210,220,255,alpha) : color(170,205,255,alpha));
    circle(e.x, e.y, r * 2);
    if (e.r > 1.8) {             // halo doux sur les grosses étoiles
      fill(190, 215, 255, alpha * 0.18);
      circle(e.x, e.y, r * 5.5);
    }
  }
  pop();
}

// Grille néon — réagit au RAGE MODE (orange) et au combo (légèrement dorée)
function dessinerGrille() {
  let pulse = sin(temps * 0.018) * 0.4 + 0.6, CELL = 40;
  let gr = rageActif ? 140 : 0;
  let gg = rageActif ?  22 : 55;
  let gb = rageActif ?   0 : 100;
  push();
  stroke(gr, gg, gb, 58 * pulse); strokeWeight(0.5);
  for (let x=0; x<width;  x+=CELL) line(x, 0, x, height);
  for (let y=0; y<height; y+=CELL) line(0, y, width, y);
  stroke(gr*1.4, gg*1.5, gb*1.6, 40 * pulse); strokeWeight(1);
  for (let x=0; x<width;  x+=CELL*4) line(x, 0, x, height);
  for (let y=0; y<height; y+=CELL*4) line(0, y, width, y);
  pop();
}

function dessinerScanlines() {
  push(); noStroke();
  for (let y=0; y<height; y+=4) { fill(0,0,0,16); rect(0,y,width,2); }
  pop();
}

function dessinerVignette() {
  let g = drawingContext.createRadialGradient(width/2,height/2,height*.25,width/2,height/2,height*.85);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
  drawingContext.fillStyle = g; drawingContext.fillRect(0, 0, width, height);
}

function dessinerBordureDanger() {
  let m=80, hx=snake.head.pos.x, hy=snake.head.pos.y;
  let d=min(hx,hy,width-hx,height-hy);
  if (d>m) return;
  let intensite=map(d,0,m,255,0), pulse=sin(temps*0.25)*.5+.5;
  push(); noFill();
  drawingContext.shadowBlur=30; drawingContext.shadowColor='rgba(255,0,0,0.8)';
  stroke(255,30,30, intensite*pulse); strokeWeight(map(d,0,m,12,2));
  rect(4,4,width-8,height-8,6); drawingContext.shadowBlur=0; pop();
}

// ─────────────────────────────────────────────────────────
// BOUCLIER VISUEL
// ─────────────────────────────────────────────────────────
function dessinerBouclier() {
  if (!bouclierActif) return;
  let ratio=bouclierTimer/BOUCLIER_DUR, pulse=sin(temps*0.18)*6;
  push();
  drawingContext.shadowBlur=35; drawingContext.shadowColor=`rgba(180,220,255,${ratio})`;
  noFill(); stroke(180,220,255,ratio*220); strokeWeight(3);
  circle(snake.head.pos.x,snake.head.pos.y,snake.r*4.5+pulse);
  noStroke();
  for (let i=0;i<6;i++) {
    let a=TWO_PI/6*i+temps*0.04, r=snake.r*2.5;
    fill(200,230,255,ratio*180);
    push(); translate(snake.head.pos.x+cos(a)*r,snake.head.pos.y+sin(a)*r);
    rotate(a+HALF_PI); triangle(-4,-6,4,-6,0,6); pop();
  }
  drawingContext.shadowBlur=0; pop();
}

function absorberDegat(cause) {
  bouclierActif=false; bouclierTimer=0;
  demarrerTremblement(8,12); flashAlpha=120; flashCol=color(200,230,255);
  jouerSon('bouclierBrise');
  scoreTextes.push(new ScoreTexte(snake.head.pos.x,snake.head.pos.y-30,'🛡️ ABSORBÉ !',4));
  if (cause==='mur') {
    snake.head.vel.mult(-1.2);
    snake.head.pos.x=constrain(snake.head.pos.x,20,width-20);
    snake.head.pos.y=constrain(snake.head.pos.y,20,height-20);
  }
}

// ─────────────────────────────────────────────────────────
// FORMES
// ─────────────────────────────────────────────────────────
function etoile(x,y,r1,r2,n) {
  let a=TWO_PI/n; beginShape();
  for (let i=0;i<n;i++) {
    let a1=a*i-HALF_PI, a2=a1+a/2;
    vertex(x+cos(a1)*r2,y+sin(a1)*r2); vertex(x+cos(a2)*r1,y+sin(a2)*r1);
  }
  endShape(CLOSE);
}
function hexagone(x,y,r) {
  beginShape();
  for (let i=0;i<6;i++) { let a=TWO_PI/6*i-PI/6; vertex(x+cos(a)*r,y+sin(a)*r); }
  endShape(CLOSE);
}

// ─────────────────────────────────────────────────────────
// HUD
// ─────────────────────────────────────────────────────────
function dessinerHUD() {
  push();
  let enBoost=speedBoost>0;

  // Score principal
  drawingContext.shadowBlur  = rageActif?50:enBoost?35:18;
  drawingContext.shadowColor = rageActif?'rgba(255,80,0,0.95)':enBoost?'rgba(0,180,255,0.9)':'rgba(0,255,100,0.7)';
  textAlign(RIGHT,TOP); textStyle(BOLD); textSize(52);
  fill(rageActif?color(255,100,0):enBoost?color(0,200,255):color(0,255,110));
  text(nf(score,2), width-30, 18);
  drawingContext.shadowBlur=0;

  textSize(14); textStyle(NORMAL); fill(0,160,80);
  text(`MEILLEUR  ${nf(highScore,2)}`, width-30, 82);
  text(`SEGMENTS  ${snake.anneaux.length}`,        width-30, 102);
  text(`NIVEAU    ${niveau}`,                       width-30, 122);
  let dcol=difficulte==='facile'?color(0,220,100):difficulte==='enfer'?color(255,80,20):color(0,160,255);
  fill(dcol); text(difficulte.toUpperCase(), width-30, 142);

  if (combo>1) {
    drawingContext.shadowBlur=22; drawingContext.shadowColor='rgba(255,200,0,0.9)';
    textSize(22); textStyle(BOLD); fill(255,210,0);
    text(`COMBO  ×${combo}`, width-30, 170);
    // Fenêtre combo visualisée
    let cwin=fenetreCombo(), elapsed=millis()-lastEatTime;
    if (elapsed<cwin) {
      let bx=width-170, by=196;
      fill(0,30,20); noStroke(); rect(bx,by,140,5,3);
      drawingContext.shadowBlur=8; drawingContext.shadowColor='rgba(255,200,0,0.7)';
      fill(255,200,0); rect(bx,by,map(elapsed,0,cwin,140,0),5,3);
      drawingContext.shadowBlur=0;
    }
  }

  // Barre RAGE
  if (rageActif) {
    let bx=width-170, by=height-90;
    fill(40,10,0); noStroke(); rect(bx,by,140,10,5);
    drawingContext.shadowBlur=18; drawingContext.shadowColor='rgba(255,60,0,0.9)';
    fill(255,80,0); rect(bx,by,map(rageTimer,0,RAGE_DUR,0,140),10,5);
    drawingContext.shadowBlur=0;
    fill(255,120,0); textAlign(RIGHT,BOTTOM); textSize(13); textStyle(BOLD);
    text('🔥 RAGE', width-30, by-4);
  }

  // Barre boost
  if (enBoost) {
    let bx=width-170, by=height-72;
    fill(0,30,50); noStroke(); rect(bx,by,140,8,4);
    drawingContext.shadowBlur=12; drawingContext.shadowColor='rgba(0,180,255,0.9)';
    fill(0,180,255); rect(bx,by,map(speedBoost,0,180,0,140),8,4);
    drawingContext.shadowBlur=0;
    fill(0,140,200); textAlign(RIGHT,BOTTOM); textStyle(NORMAL); textSize(12);
    text('⚡ BOOST', width-30, by-4);
  }

  // Barre bouclier
  if (bouclierActif) {
    let bx=width-170, by=height-88;
    fill(20,30,50); noStroke(); rect(bx,by,140,8,4);
    drawingContext.shadowBlur=12; drawingContext.shadowColor='rgba(180,220,255,0.9)';
    fill(180,220,255); rect(bx,by,map(bouclierTimer,0,BOUCLIER_DUR,0,140),8,4);
    drawingContext.shadowBlur=0;
    fill(150,200,255); textAlign(RIGHT,BOTTOM); textSize(12);
    text('🛡️ BOUCLIER', width-30, by-4);
  }

  // Barre vitesse
  let vit=snake.head.vel.mag(), bx=width-170, by2=height-40;
  fill(0,40,20); noStroke(); rect(bx,by2,140,8,4);
  drawingContext.shadowBlur=10; drawingContext.shadowColor='rgba(0,255,80,0.8)';
  fill(0,255,100); rect(bx,by2,map(vit,0,snake.head.maxSpeed,0,140),8,4);
  drawingContext.shadowBlur=0;
  fill(0,160,80); textAlign(RIGHT,BOTTOM); textStyle(NORMAL); textSize(12);
  text(`VITESSE  ${nf(vit,1,1)}`, width-30, by2-4);

  // Légende
  textAlign(LEFT,TOP); textStyle(NORMAL); textSize(12);
  fill(200,60,80);  text('★  +1',              20,20);
  fill(220,180,0);  text('★  +3 bonus',        20,38);
  fill(0,150,220);  text('⚡ boost',            20,56);
  fill(160,0,220);  text('☠  poison −2',        20,74);
  fill(160,210,255);text('🛡  bouclier 4s',     20,92);
  fill(255,200,0);  text('🌟 zone ×2',          20,110);
  if (portail) { fill(130,80,255); text('🌀 portails',      20,128); }
  if (rival)   { fill(255,80,0);   text(`🐍 rival  ${rival.anneaux.length} seg`, 20, portail?146:128); }

  let hy = rival ? (portail ? 163 : 146) : (portail ? 146 : 135);
  fill(sonActif  ? color(0,200,100):color(80,80,80)); text(sonActif ?'🔊 M':'🔇 M',20,hy);
  fill(musiqueON ? color(0,200,100):color(80,80,80)); text(musiqueON?'🎵 B':'🔕 B',55,hy);

  fill(30,60,50); textAlign(LEFT,BOTTOM); textSize(12);
  text('R — Menu   D — Debug   O / P — Obstacles', 20, height-20);
  pop();
}

// ─────────────────────────────────────────────────────────
// EFFETS
// ─────────────────────────────────────────────────────────
class Onde {
  constructor(x,y) { this.pos=createVector(x,y); this.r=10; this.alpha=200; }
  update() { this.r+=4; this.alpha-=14; }
  show() {
    push(); drawingContext.shadowBlur=15; drawingContext.shadowColor='rgba(0,255,80,0.5)';
    noFill(); stroke(0,255,100,this.alpha); strokeWeight(2);
    circle(this.pos.x,this.pos.y,this.r*2); pop();
  }
  estMorte() { return this.alpha<=0; }
}

class Etincelle {
  constructor(x,y,type=0) {
    this.pos  = createVector(x,y);
    this.vel  = p5.Vector.random2D().mult(random(1.5,7));
    this.alpha= 255; this.r=random(2,7);
    if      (type===1) this.col=color(255,random(180,220),0);
    else if (type===2) this.col=color(0,random(150,200),255);
    else if (type===3) this.col=color(random(160,220),0,255);
    else if (type===4) this.col=color(180,220,255);
    else if (type===5) this.col=color(255,210,0);
    else if (type===6) this.col=color(255,random(60,140),0);
    else this.col=random()>.5?color(255,random(50,120),50):color(255,220,50);
  }
  update() { this.pos.add(this.vel); this.vel.mult(0.90); this.alpha-=11; }
  show() {
    push();
    drawingContext.shadowBlur=10;
    drawingContext.shadowColor=`rgba(${red(this.col)},${green(this.col)},${blue(this.col)},0.6)`;
    noStroke(); fill(red(this.col),green(this.col),blue(this.col),this.alpha);
    circle(this.pos.x,this.pos.y,this.r); pop();
  }
  estMorte() { return this.alpha<=0; }
}

class ScoreTexte {
  constructor(x,y,label='+1',type=0) {
    this.pos=createVector(x,y); this.label=label; this.alpha=255;
    this.vy=-2.5; this.taille=label.length>8?20:26;
    this.col=type===1?color(255,210,0):type===2?color(0,200,255):
             type===3?color(200,0,255):type===4?color(180,220,255):
             type===5?color(255,215,0):type===6?color(255,80,0):
             type===7?color(140,80,255):color(0,255,120);
  }
  update() { this.pos.y+=this.vy; this.vy*=0.94; this.alpha-=4; }
  show() {
    push();
    drawingContext.shadowBlur=14;
    drawingContext.shadowColor=`rgba(${red(this.col)},${green(this.col)},${blue(this.col)},0.8)`;
    noStroke(); fill(red(this.col),green(this.col),blue(this.col),this.alpha);
    textAlign(CENTER,CENTER); textStyle(BOLD); textSize(this.taille);
    text(this.label,this.pos.x,this.pos.y); pop();
  }
  estMort() { return this.alpha<=0; }
}

class NiveauTexte {
  constructor(n) { this.n=n; this.alpha=255; this.sc=0.3; }
  update() { this.alpha-=1.8; this.sc=min(1.2,this.sc+0.055); }
  show() {
    push();
    drawingContext.shadowBlur=45; drawingContext.shadowColor='rgba(0,255,80,0.9)';
    noStroke(); fill(0,255,120,this.alpha); textAlign(CENTER,CENTER); textStyle(BOLD);
    textSize(64*this.sc); text(`NIVEAU ${this.n}`,width/2,height/2);
    textSize(22*this.sc); fill(0,200,100,this.alpha*.8);
    let seeker = niveau>=5 ? ' · obstacles seekers !' : ' · nouvel obstacle !';
    text(seeker, width/2, height/2+55*this.sc);
    drawingContext.shadowBlur=0; pop();
  }
  estMort() { return this.alpha<=0; }
}

// ─────────────────────────────────────────────────────────
// MORT
// ─────────────────────────────────────────────────────────
function mourir(cause) {
  etat='perdu'; causeDefaite=cause; gameOverAlpha=0;
  demarrerTremblement(15,28); jouerSon('mort');
  for (let p=0;p<60;p++) particules.push(new Etincelle(snake.head.pos.x,snake.head.pos.y,0));
  for (let w=0;w<3;w++) ondes.push(new Onde(snake.head.pos.x,snake.head.pos.y));
}

function dessinerGameOverFrame() {
  gameOverAlpha=min(220,gameOverAlpha+6);
  push(); noStroke(); fill(0,0,0,gameOverAlpha*.85); rect(0,0,width,height);
  for (let i=particules.length-1;i>=0;i--) {
    particules[i].update(); particules[i].show();
    if (particules[i].estMorte()) particules.splice(i,1);
  }
  for (let i=ondes.length-1;i>=0;i--) {
    ondes[i].update(); ondes[i].show();
    if (ondes[i].estMorte()) ondes.splice(i,1);
  }
  let sc=map(gameOverAlpha,0,220,0.4,1.0);
  drawingContext.shadowBlur=50; drawingContext.shadowColor='rgba(255,30,60,0.95)';
  fill(255,40,70,gameOverAlpha); textAlign(CENTER,CENTER); textStyle(BOLD); textSize(80*sc);
  text('GAME OVER',width/2,height/2-80*sc);
  drawingContext.shadowBlur=20; drawingContext.shadowColor='rgba(255,100,100,0.7)';
  textSize(22*sc); fill(255,150,150,gameOverAlpha);
  let msg=causeDefaite==='mur'?'💀  Tu as percuté le mur':
          causeDefaite==='obstacle'?'💀  Tu as percuté un obstacle':
          '💀  Tu t\'es mordu la queue';
  text(msg,width/2,height/2-20*sc);
  drawingContext.shadowBlur=25; drawingContext.shadowColor='rgba(0,255,100,0.8)';
  fill(0,255,120,gameOverAlpha); textSize(44*sc);
  text(`Score  ${nf(score,2)}`,width/2,height/2+50*sc);
  if (score>=highScore&&score>0) {
    drawingContext.shadowBlur=30; drawingContext.shadowColor='rgba(255,215,0,0.9)';
    fill(255,215,0,gameOverAlpha); textSize(24*sc);
    text('🏆  NOUVEAU RECORD !',width/2,height/2+100*sc);
  } else {
    drawingContext.shadowBlur=0; fill(0,180,80,gameOverAlpha*.8); textSize(20*sc);
    text(`Meilleur  ${nf(highScore,2)}`,width/2,height/2+100*sc);
  }
  drawingContext.shadowBlur=0;
  fill(100,140,120,gameOverAlpha*.7); textSize(15*sc);
  text(`Segments : ${snake.anneaux.length}   Niveau : ${niveau}   Difficulté : ${difficulte.toUpperCase()}`,
       width/2,height/2+135*sc);
  if (sin(temps*.1)>0) {
    fill(200,200,200,gameOverAlpha*.7); textSize(17*sc);
    text('R — Recommencer  ·  Esc — Menu',width/2,height/2+168*sc);
  }
  drawingContext.shadowBlur=0; pop();
}

function demarrerTremblement(force,duree) { shakeAmt=force; shakeDur=duree; }

// ─────────────────────────────────────────────────────────
// MUSIQUE PROCÉDURALE
// ─────────────────────────────────────────────────────────
function miseAJourMusique() {
  if (!musiqueON||!sonActif||!audioCtx||audioCtx.state==='suspended') return;
  let bpm=cfg().baseBPM+niveau*6+(rageActif?30:0);
  let beatF=max(10,floor(3600/bpm));
  if (temps%beatF===0) {
    let ni=musicStep%BASS_MIDI.length;
    playMusicNote(midiToHz(BASS_MIDI[ni]),'bass',beatF/60*.75);
    musicStep++;
  }
  let halfB=max(5,floor(beatF/2));
  if (temps%halfB===floor(halfB*.5)) {
    let ni=floor(temps/halfB)%ARP_MIDI.length;
    playMusicNote(midiToHz(ARP_MIDI[ni]),'arp',halfB/60*.5);
  }
}
function midiToHz(m) { return 440*Math.pow(2,(m-69)/12); }
function playMusicNote(freq,type,dur) {
  if (!audioCtx) return;
  const t=audioCtx.currentTime;
  if (type==='bass') {
    let osc=audioCtx.createOscillator(),filt=audioCtx.createBiquadFilter(),env=audioCtx.createGain();
    osc.connect(filt); filt.connect(env); env.connect(audioCtx.destination);
    osc.type='sine'; filt.type='lowpass'; filt.frequency.value=350; osc.frequency.value=freq;
    env.gain.setValueAtTime(0.055,t); env.gain.linearRampToValueAtTime(0.04,t+dur*.4);
    env.gain.exponentialRampToValueAtTime(0.001,t+dur); osc.start(t); osc.stop(t+dur);
  } else {
    let osc=audioCtx.createOscillator(),env=audioCtx.createGain();
    osc.connect(env); env.connect(audioCtx.destination);
    osc.type='triangle'; osc.frequency.value=freq;
    env.gain.setValueAtTime(0.028,t); env.gain.exponentialRampToValueAtTime(0.001,t+dur);
    osc.start(t); osc.stop(t+dur);
  }
}

// ─────────────────────────────────────────────────────────
// SONS
// ─────────────────────────────────────────────────────────
function initAudio() {
  if (audioCtx) return;
  try { audioCtx=new(window.AudioContext||window.webkitAudioContext)(); }
  catch(e) { sonActif=false; }
}

function jouerSon(type) {
  if (!sonActif||!audioCtx) return;
  if (audioCtx.state==='suspended') audioCtx.resume();
  const t=audioCtx.currentTime;

  if (type==='manger') {
    let osc=audioCtx.createOscillator(),env=audioCtx.createGain();
    osc.connect(env); env.connect(audioCtx.destination); osc.type='sine';
    osc.frequency.setValueAtTime(520,t); osc.frequency.exponentialRampToValueAtTime(1040,t+.08);
    env.gain.setValueAtTime(0.22,t); env.gain.exponentialRampToValueAtTime(0.001,t+.13);
    osc.start(t); osc.stop(t+.13);

  } else if (type==='mangerOr') {
    [440,554,659].forEach((fr,i)=>{
      let o=audioCtx.createOscillator(),e=audioCtx.createGain();
      o.connect(e); e.connect(audioCtx.destination); o.type='sine'; o.frequency.value=fr;
      let d=t+i*.07;
      e.gain.setValueAtTime(0,d); e.gain.linearRampToValueAtTime(0.13,d+.04);
      e.gain.exponentialRampToValueAtTime(0.001,d+.32); o.start(d); o.stop(d+.32);
    });

  } else if (type==='combo') {
    let pitch=330*Math.pow(1.3,Math.min(combo-2,6));
    let o=audioCtx.createOscillator(),e=audioCtx.createGain();
    o.connect(e); e.connect(audioCtx.destination); o.type='square';
    o.frequency.setValueAtTime(pitch,t); o.frequency.exponentialRampToValueAtTime(pitch*1.6,t+.14);
    e.gain.setValueAtTime(0.10,t); e.gain.exponentialRampToValueAtTime(0.001,t+.18);
    o.start(t); o.stop(t+.18);

  } else if (type==='boost') {
    let o=audioCtx.createOscillator(),f=audioCtx.createBiquadFilter(),e=audioCtx.createGain();
    o.connect(f); f.connect(e); e.connect(audioCtx.destination);
    o.type='sawtooth'; f.type='lowpass';
    f.frequency.setValueAtTime(150,t); f.frequency.exponentialRampToValueAtTime(5000,t+.32);
    o.frequency.setValueAtTime(60,t); o.frequency.exponentialRampToValueAtTime(350,t+.32);
    e.gain.setValueAtTime(0.18,t); e.gain.exponentialRampToValueAtTime(0.001,t+.38);
    o.start(t); o.stop(t+.38);

  } else if (type==='poison') {
    let o=audioCtx.createOscillator(),e=audioCtx.createGain();
    o.connect(e); e.connect(audioCtx.destination); o.type='sawtooth';
    o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(80,t+.25);
    e.gain.setValueAtTime(0.22,t); e.gain.exponentialRampToValueAtTime(0.001,t+.3);
    o.start(t); o.stop(t+.3);

  } else if (type==='expiration') {
    let o=audioCtx.createOscillator(),e=audioCtx.createGain();
    o.connect(e); e.connect(audioCtx.destination); o.type='square';
    o.frequency.setValueAtTime(200,t); o.frequency.exponentialRampToValueAtTime(60,t+.22);
    e.gain.setValueAtTime(0.14,t); e.gain.exponentialRampToValueAtTime(0.001,t+.25);
    o.start(t); o.stop(t+.25);

  } else if (type==='expirationBase') {
    let o=audioCtx.createOscillator(),e=audioCtx.createGain();
    o.connect(e); e.connect(audioCtx.destination); o.type='sine';
    o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(150,t+.1);
    e.gain.setValueAtTime(0.06,t); e.gain.exponentialRampToValueAtTime(0.001,t+.12);
    o.start(t); o.stop(t+.12);

  } else if (type==='rage') {
    // Grosse montée + arpège
    let o=audioCtx.createOscillator(),d2=audioCtx.createDynamicsCompressor(),e=audioCtx.createGain();
    o.connect(d2); d2.connect(e); e.connect(audioCtx.destination);
    o.type='sawtooth';
    o.frequency.setValueAtTime(55,t); o.frequency.exponentialRampToValueAtTime(220,t+.4);
    e.gain.setValueAtTime(0.35,t); e.gain.exponentialRampToValueAtTime(0.001,t+.55);
    o.start(t); o.stop(t+.55);
    // Arpège ascendant
    [220,330,440,660].forEach((fr,i)=>{
      let o2=audioCtx.createOscillator(),e2=audioCtx.createGain();
      o2.connect(e2); e2.connect(audioCtx.destination); o2.type='triangle'; o2.frequency.value=fr;
      let d=t+.35+i*.06;
      e2.gain.setValueAtTime(0,d); e2.gain.linearRampToValueAtTime(0.12,d+.04);
      e2.gain.exponentialRampToValueAtTime(0.001,d+.3); o2.start(d); o2.stop(d+.3);
    });

  } else if (type==='zoneBonus') {
    let o=audioCtx.createOscillator(),e=audioCtx.createGain();
    o.connect(e); e.connect(audioCtx.destination); o.type='triangle';
    o.frequency.setValueAtTime(880,t); o.frequency.exponentialRampToValueAtTime(1760,t+.15);
    e.gain.setValueAtTime(0.12,t); e.gain.exponentialRampToValueAtTime(0.001,t+.18);
    o.start(t); o.stop(t+.18);

  } else if (type==='zoneMove') {
    let o=audioCtx.createOscillator(),e=audioCtx.createGain();
    o.connect(e); e.connect(audioCtx.destination); o.type='sine';
    o.frequency.setValueAtTime(660,t); o.frequency.exponentialRampToValueAtTime(440,t+.14);
    e.gain.setValueAtTime(0.08,t); e.gain.exponentialRampToValueAtTime(0.001,t+.16);
    o.start(t); o.stop(t+.16);

  } else if (type==='shield') {
    [880,1100,1320].forEach((fr,i)=>{
      let o=audioCtx.createOscillator(),e=audioCtx.createGain();
      o.connect(e); e.connect(audioCtx.destination); o.type='triangle'; o.frequency.value=fr;
      let d=t+i*.06;
      e.gain.setValueAtTime(0.08,d); e.gain.exponentialRampToValueAtTime(0.001,d+.22);
      o.start(d); o.stop(d+.22);
    });

  } else if (type==='bouclierBrise') {
    let o=audioCtx.createOscillator(),e=audioCtx.createGain();
    o.connect(e); e.connect(audioCtx.destination); o.type='square';
    o.frequency.setValueAtTime(1200,t); o.frequency.exponentialRampToValueAtTime(200,t+.35);
    e.gain.setValueAtTime(0.18,t); e.gain.exponentialRampToValueAtTime(0.001,t+.4);
    o.start(t); o.stop(t+.4);

  } else if (type==='bouclierExpire') {
    let o=audioCtx.createOscillator(),e=audioCtx.createGain();
    o.connect(e); e.connect(audioCtx.destination); o.type='sine'; o.frequency.value=440;
    o.frequency.linearRampToValueAtTime(220,t+.2);
    e.gain.setValueAtTime(0.10,t); e.gain.exponentialRampToValueAtTime(0.001,t+.22);
    o.start(t); o.stop(t+.22);

  } else if (type==='mort') {
    let o=audioCtx.createOscillator(),e=audioCtx.createGain();
    o.connect(e); e.connect(audioCtx.destination); o.type='sawtooth';
    o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(28,t+.7);
    e.gain.setValueAtTime(0.38,t); e.gain.exponentialRampToValueAtTime(0.001,t+.75);
    o.start(t); o.stop(t+.75);
    let sz=audioCtx.sampleRate*.28,buf=audioCtx.createBuffer(1,sz,audioCtx.sampleRate);
    let da=buf.getChannelData(0); for(let i=0;i<sz;i++) da[i]=Math.random()*2-1;
    let src=audioCtx.createBufferSource(),nv=audioCtx.createGain();
    src.buffer=buf; src.connect(nv); nv.connect(audioCtx.destination);
    nv.gain.setValueAtTime(0.28,t); nv.gain.exponentialRampToValueAtTime(0.001,t+.28);
    src.start(t);

  } else if (type==='niveauUp') {
    [261,329,392,523].forEach((fr,i)=>{
      let o=audioCtx.createOscillator(),e=audioCtx.createGain();
      o.connect(e); e.connect(audioCtx.destination); o.type='triangle'; o.frequency.value=fr;
      let d=t+i*.1;
      e.gain.setValueAtTime(0,d); e.gain.linearRampToValueAtTime(0.18,d+.05);
      e.gain.exponentialRampToValueAtTime(0.001,d+.42); o.start(d); o.stop(d+.42);
    });

  } else if (type==='portail') {
    // Whoosh électronique : montée puis descente filtrée
    let o=audioCtx.createOscillator(),f=audioCtx.createBiquadFilter(),e=audioCtx.createGain();
    o.connect(f); f.connect(e); e.connect(audioCtx.destination);
    o.type='sine'; f.type='bandpass'; f.Q.value=6;
    o.frequency.setValueAtTime(200,t); o.frequency.exponentialRampToValueAtTime(1800,t+.18);
    o.frequency.exponentialRampToValueAtTime(400,t+.42);
    f.frequency.setValueAtTime(400,t); f.frequency.exponentialRampToValueAtTime(2200,t+.2);
    e.gain.setValueAtTime(0.26,t); e.gain.exponentialRampToValueAtTime(0.001,t+.46);
    o.start(t); o.stop(t+.46);
    // Harmonie
    let o2=audioCtx.createOscillator(),e2=audioCtx.createGain();
    o2.connect(e2); e2.connect(audioCtx.destination); o2.type='triangle';
    o2.frequency.setValueAtTime(800,t); o2.frequency.exponentialRampToValueAtTime(3200,t+.18);
    e2.gain.setValueAtTime(0.09,t); e2.gain.exponentialRampToValueAtTime(0.001,t+.28);
    o2.start(t); o2.stop(t+.28);

  } else if (type==='rivalHit') {
    // Choc bref descendant
    let o=audioCtx.createOscillator(),e=audioCtx.createGain();
    o.connect(e); e.connect(audioCtx.destination); o.type='sawtooth';
    o.frequency.setValueAtTime(380,t); o.frequency.exponentialRampToValueAtTime(90,t+.28);
    e.gain.setValueAtTime(0.22,t); e.gain.exponentialRampToValueAtTime(0.001,t+.32);
    o.start(t); o.stop(t+.32);
  }
}

// ─────────────────────────────────────────────────────────
// ÉVÉNEMENTS
// ─────────────────────────────────────────────────────────
function keyPressed() {
  initAudio();
  if (key==='r'||key==='R') { if(etat!=='menu') etat='menu'; }
  if (keyCode===ESCAPE&&etat!=='menu') etat='menu';
  if (key==='d'||key==='D') Vehicle.debug=!Vehicle.debug;
  if (key==='m'||key==='M') sonActif  =!sonActif;
  if (key==='b'||key==='B') musiqueON =!musiqueON;
  if ((key==='o'||key==='O')&&etat==='jeu') obstacles.push(spawnerObstacle());
  if ((key==='p'||key==='P')&&etat==='jeu'&&obstacles.length>1) obstacles.pop();
  if (etat==='menu') {
    if (key==='1') { difficulte='facile'; demarrerJeu(); }
    if (key==='2') { difficulte='normal'; demarrerJeu(); }
    if (key==='3') { difficulte='enfer';  demarrerJeu(); }
  }
}
function mousePressed() {
  initAudio();
  if (etat!=='menu') return;
  let bW=190,bH=58,gap=28,totalW=3*bW+2*gap;
  let bx0=width/2-totalW/2, by=height/2+18;
  let diffs=['facile','normal','enfer'];
  for (let i=0;i<3;i++) {
    let bx=bx0+i*(bW+gap);
    if (mouseX>bx&&mouseX<bx+bW&&mouseY>by&&mouseY<by+bH) {
      difficulte=diffs[i]; demarrerJeu(); return;
    }
  }
}
function windowResized() { resizeCanvas(windowWidth,windowHeight); _genererEtoiles(); }
