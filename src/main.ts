// Point d'entrée : boucle de jeu à pas fixe (60 ticks/s, accumulateur) + rendu interpolé.
import { Sound } from './audio';
import { Game, HISTORY_STEP, type Phase } from './game';
import { Input } from './input/input';
import { FxList } from './render/fx';
import { roman } from './render/palette';
import { Renderer } from './render/renderer';
import { CLASS_ORDER } from './sim/content/classes';
import { LOOP_TICKS, ROOMS } from './sim/content/rooms';
import type { SimEvent } from './sim/types';
import { leverHeld, type Frame, type World } from './sim/world';
import { Hud, starsHtml } from './ui/hud';
import './ui/style.css';

const STEP = 1 / 60;

interface Settings {
  speed: number;
  reduceFx: boolean;
  sound: boolean;
}

function loadSettings(): Settings {
  const def: Settings = { speed: 1, reduceFx: false, sound: true };
  try {
    const raw = localStorage.getItem('echos.settings');
    if (raw) return { ...def, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* stockage indisponible */
  }
  return def;
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem('echos.settings', JSON.stringify(s));
  } catch {
    /* stockage indisponible */
  }
}

const settings = loadSettings();
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const stage = document.getElementById('stage') as HTMLElement;
const renderer = new Renderer(canvas);
const hud = new Hud();
const fx = new FxList();
const sound = new Sound();
sound.enabled = settings.sound;
const input = new Input(stage, document.getElementById('joy')!, document.getElementById('knob')!);

const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
const game = new Game(Number.isFinite(urlSeed) && urlSeed > 0 ? urlSeed : 20261101);

let paused = false;
let acc = 0;
let introT = 0;
let rewindT = 0;
let previewTick = 0;
let previewAuto = true;
let lastSecond = 0;
const tutorial = new Set<string>();

function liveFrame(w: World): Frame {
  return {
    tick: w.tick,
    units: w.units,
    projectiles: w.projectiles,
    traps: w.traps,
    leversHeld: w.room.levers.map(([c, r]) => leverHeld(w, c, r)),
  };
}

function resize(): void {
  renderer.resize(game.room);
}
new ResizeObserver(resize).observe(stage);

// ——— Phases ———

function onPhase(p: Phase): void {
  paused = false;
  switch (p) {
    case 'intro': {
      introT = 2.6;
      lastLiveFrame = null;
      fx.clear();
      resize();
      const r = game.room;
      hud.showOverlay(`
        <p class="kicker">Salle ${roman(game.roomIndex)} sur ${roman(ROOMS.length - 1)}</p>
        <h2>${r.name}</h2>
        <p class="body"><strong>${r.objectiveText}.</strong></p>
        <p class="muted">${r.hint}</p>
        <p class="muted">${roman(r.maxLoops - 1)} boucles au plus · 3 étoiles en ${roman(r.par - 1)}</p>
        <div class="row"><button type="button" class="primary" data-action="enter">Entrer</button></div>`);
      break;
    }
    case 'choose':
      hud.hideOverlay();
      previewTick = 0;
      previewAuto = true;
      hud.setCloneMarks(game);
      chooseTutorial();
      break;
    case 'playing':
      hud.hideOverlay();
      hud.hideToast();
      acc = 0;
      lastSecond = 0;
      fx.clear();
      input.reset();
      break;
    case 'rewind':
      rewindT = 0;
      sound.rewind();
      hud.toast(game.lastOutcomeReason === 'death' ? 'Mort pendant la boucle. Elle devient un clone jusqu’à cet instant.' : 'Fin de la boucle. Elle devient un clone.', 2200);
      break;
    case 'won': {
      sound.win();
      const loops = game.loopIndex + 1;
      const stars = game.stars[game.roomIndex] ?? 0;
      const last = game.roomIndex + 1 >= ROOMS.length;
      hud.showOverlay(`
        <p class="kicker">Salle gagnée</p>
        <h2>En ${loops} boucle${loops > 1 ? 's' : ''}</h2>
        <div class="stars">${starsHtml(stars)}</div>
        <p class="muted">${stars === 3 ? 'Coordination parfaite avec toi-même.' : `3 étoiles en ${game.room.par} boucle${game.room.par > 1 ? 's' : ''}.`}</p>
        <div class="row">
          <button type="button" class="secondary" data-action="retry">Rejouer</button>
          <button type="button" class="primary" data-action="next">${last ? 'Terminer' : 'Salle suivante'}</button>
        </div>`);
      break;
    }
    case 'failed':
      sound.fail();
      hud.showOverlay(`
        <p class="kicker">Boucles épuisées</p>
        <h2>La salle recommence</h2>
        <p class="body danger">−2 de stabilité. Tes clones s’effacent.</p>
        <p class="muted">Astuce : fais défiler la frise avant de lancer une boucle pour voir où seront tes clones.</p>
        <div class="row"><button type="button" class="primary" data-action="retry">Recommencer</button></div>`);
      break;
    case 'over':
      sound.fail();
      hud.showOverlay(`
        <p class="kicker">Stabilité à zéro</p>
        <h2>La trame se déchire</h2>
        <p class="body">La run est perdue. Trop de paradoxes, ou trop d’échecs.</p>
        <div class="row"><button type="button" class="primary" data-action="newrun">Nouvelle run</button></div>`);
      break;
    case 'end': {
      const total = game.stars.reduce((a, b) => a + (b ?? 0), 0);
      hud.showOverlay(`
        <p class="kicker">Fin du prototype</p>
        <h2>Le temps te laisse passer</h2>
        <div class="stars">${starsHtml(Math.round(total / ROOMS.length))}</div>
        <p class="body">${total} étoile${total > 1 ? 's' : ''} sur ${ROOMS.length * 3} · stabilité restante ${game.stability}</p>
        <div class="row"><button type="button" class="primary" data-action="newrun">Nouvelle run</button></div>`);
      break;
    }
  }
}

function chooseTutorial(): void {
  if (game.roomIndex === 0 && game.loopIndex === 0 && !tutorial.has('first')) {
    tutorial.add('first');
    hud.toast('Choisis une classe puis lance la boucle. Au bout de 20 s, elle devient un <strong>clone</strong> qui rejoue tes gestes.', 6000);
  } else if (game.loopIndex === 1 && !tutorial.has('clone')) {
    tutorial.add('clone');
    hud.toast('Ton clone I va rejouer ta boucle à l’identique. <strong>Fais glisser la frise</strong> pour voir où il sera à chaque seconde.', 6500);
  } else if (game.roomIndex === 1 && game.loopIndex === 0 && !tutorial.has('paradoxHint')) {
    tutorial.add('paradoxHint');
    hud.toast(game.room.hint, 5000);
  }
}

function onEvents(events: SimEvent[], w: World): void {
  fx.push(events, w);
  for (const e of events) {
    if (e.type === 'paradox') {
      sound.glass();
      const charged = game.charged.has(e.cloneIndex);
      const why = e.reason === 'target' ? 'sa cible a disparu' : 'son chemin est bloqué';
      const first = !tutorial.has('paradox');
      tutorial.add('paradox');
      hud.toast(
        `<strong>Paradoxe · ${roman(e.cloneIndex)}</strong> : ${why}.${charged ? ' −1 stabilité.' : ''}${first ? '<br>Il vise désormais l’entité la plus proche, alliés compris.' : ''}`,
        first ? 5000 : 2600,
        true,
      );
    } else if (e.type === 'death' && e.id === w.playerId) sound.fail();
    else if ((e.type === 'volley' || e.type === 'taunt' || e.type === 'trap') && e.id === w.playerId) sound.scratch();
    else if (e.type === 'shield' && e.from === w.playerId) sound.scratch();
    else if (e.type === 'levers' && e.held > 0) sound.click();
  }
}

game.on({
  onPhase,
  onEvents,
  onStability: (d) => {
    if (d < 0) hud.markStabilityLoss();
  },
});

// ——— Contrôles ———

function launch(): void {
  sound.unlock();
  if (game.launch()) sound.click();
}

hud.onCard = (c) => {
  sound.unlock();
  if (game.canSelect(c)) {
    game.select(c);
    sound.click();
  }
};
hud.launchBtn.addEventListener('click', launch);
hud.abilityBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  input.pressAbility();
});
hud.scrub.addEventListener('input', () => {
  previewAuto = false;
  previewTick = Number(hud.scrub.value);
});
hud.pauseBtn.addEventListener('click', () => togglePause());

hud.overlay.addEventListener('click', (e) => {
  sound.unlock();
  const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
  const action = btn?.dataset.action;
  if (!action && game.phase === 'intro') {
    game.enterChoose();
    return;
  }
  overlayAction(action);
});

function overlayAction(action: string | undefined): void {
  switch (action) {
    case 'enter':
      game.enterChoose();
      break;
    case 'retry':
      game.retryRoom();
      break;
    case 'next':
      game.nextRoom();
      break;
    case 'newrun':
      game.newRun((game.runSeed * 1103515245 + 12345) >>> 0 || 1);
      break;
    case 'resume':
      togglePause(false);
      break;
    case 'speed':
      settings.speed = settings.speed === 1 ? 0.75 : 1;
      saveSettings(settings);
      showPause();
      break;
    case 'fx':
      settings.reduceFx = !settings.reduceFx;
      saveSettings(settings);
      showPause();
      break;
    case 'sound':
      settings.sound = !settings.sound;
      sound.enabled = settings.sound;
      saveSettings(settings);
      showPause();
      break;
    case 'restart':
      togglePause(false);
      game.newRun(game.runSeed);
      break;
  }
}

function showPause(): void {
  hud.showOverlay(`
    <p class="kicker">Pause</p>
    <h2>Le temps retient son souffle</h2>
    <div class="opt"><span>Vitesse de jeu</span><button type="button" class="secondary" data-action="speed">${settings.speed === 1 ? '1×' : '0,75×'}</button></div>
    <div class="opt"><span>Réduire glitch et bavure</span><button type="button" class="secondary" data-action="fx">${settings.reduceFx ? 'Oui' : 'Non'}</button></div>
    <div class="opt"><span>Son</span><button type="button" class="secondary" data-action="sound">${settings.sound ? 'Oui' : 'Non'}</button></div>
    <div class="row">
      <button type="button" class="secondary" data-action="restart">Nouvelle run</button>
      <button type="button" class="primary" data-action="resume">Reprendre</button>
    </div>`);
}

function togglePause(force?: boolean): void {
  if (game.phase !== 'playing' && game.phase !== 'choose') return;
  paused = force ?? !paused;
  if (paused) showPause();
  else hud.hideOverlay();
}

input.onKey = (e) => {
  if (e.code === 'Escape') {
    togglePause();
    return;
  }
  if (paused) {
    if (e.code === 'Enter') togglePause(false);
    return;
  }
  const digit = /^(Digit|Numpad)([1-4])$/.exec(e.code);
  if (digit && game.phase === 'choose') {
    hud.onCard?.(CLASS_ORDER[Number(digit[2]) - 1]!);
    return;
  }
  if (e.code === 'Enter' || (e.code === 'Space' && game.phase === 'choose')) {
    if (game.phase === 'choose') launch();
    else if (game.phase === 'intro') game.enterChoose();
    else {
      const primary = hud.overlay.querySelector<HTMLElement>('.primary[data-action]');
      if (primary) overlayAction(primary.dataset.action);
    }
  }
  if (game.phase === 'choose' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
    previewAuto = false;
    previewTick = Math.max(0, Math.min(LOOP_TICKS, previewTick + (e.code === 'ArrowRight' ? 30 : -30)));
  }
};

// ——— Boucle principale ———

let last = performance.now();
let lastLiveFrame: Frame | null = null;

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const sdt = dt * settings.speed;
  if (!paused) fx.update(sdt);
  const time = now / 1000;
  let shown = 0;
  const base = { room: game.room, records: game.records, time, fx, reduceFx: settings.reduceFx, rewind: 0, preview: false };

  switch (game.phase) {
    case 'intro': {
      introT -= dt;
      if (introT <= 0) game.enterChoose();
      renderer.draw({ ...base, frame: liveFrame(game.world), alpha: 1, trails: 'none', fx: null });
      break;
    }
    case 'choose': {
      if (previewAuto && !paused) previewTick = (previewTick + sdt * 60 * 1.5) % (LOOP_TICKS + 45);
      const t = Math.min(LOOP_TICKS, Math.floor(previewTick));
      hud.scrub.value = String(t);
      const pf = game.preview[Math.min(game.preview.length - 1, Math.floor(t / HISTORY_STEP))] ?? liveFrame(game.world);
      shown = pf.tick;
      renderer.draw({ ...base, frame: pf, alpha: 1, trails: 'full', fx: null, preview: true });
      break;
    }
    case 'playing': {
      if (!paused) {
        acc += sdt;
        while (acc >= STEP && game.phase === 'playing') {
          const s = input.sample();
          game.tick({ tick: game.world.tick, ...s });
          acc -= STEP;
          const sec = Math.floor(game.world.tick / 60);
          if (sec !== lastSecond) {
            lastSecond = sec;
            sound.tick(sec >= 17);
          }
        }
      }
      lastLiveFrame = liveFrame(game.world);
      shown = game.world.tick;
      renderer.draw({ ...base, frame: lastLiveFrame, alpha: game.phase === 'playing' ? Math.min(1, acc / STEP) : 1, trails: 'ahead' });
      break;
    }
    case 'rewind': {
      rewindT += dt;
      const k = Math.min(1, rewindT / 1);
      const h = game.history;
      const f = h[Math.round((1 - k) * (h.length - 1))] ?? liveFrame(game.world);
      shown = f.tick;
      renderer.draw({ ...base, frame: f, alpha: 1, trails: 'none', fx: null, rewind: Math.max(0.01, k) });
      if (k >= 1) game.finishRewind();
      break;
    }
    default: {
      const f = lastLiveFrame ?? liveFrame(game.world);
      shown = f.tick;
      renderer.draw({ ...base, frame: f, alpha: 1, trails: 'none' });
    }
  }
  hud.update(game, shown, now);
  requestAnimationFrame(frame);
}

onPhase(game.phase);
resize();
requestAnimationFrame(frame);

// Accès console pour le réglage : window.echos.game
(window as unknown as { echos: unknown }).echos = { game, settings };
