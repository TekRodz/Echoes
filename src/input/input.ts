// Clavier + joystick tactile flottant -> entrée quantifiée (-127..127) consommée par la sim.

export interface InputSample {
  moveX: number;
  moveY: number;
  ability: boolean;
}

const KEYS = {
  up: ['KeyW', 'ArrowUp'], // KeyW = touche Z en AZERTY (code physique)
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'], // KeyA = touche Q en AZERTY
  right: ['KeyD', 'ArrowRight'],
};

export class Input {
  private down = new Set<string>();
  private abilityLatch = false;
  private joy: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private readonly radius = 56;
  onKey: ((e: KeyboardEvent) => void) | null = null;

  constructor(private stage: HTMLElement, private joyEl: HTMLElement, private knobEl: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat && e.code === 'Space') return;
      this.down.add(e.code);
      if (e.code === 'Space') this.abilityLatch = true;
      if (Object.values(KEYS).flat().includes(e.code) || e.code === 'Space') e.preventDefault();
      this.onKey?.(e);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.endJoy();
    });

    stage.addEventListener('pointerdown', (e) => {
      if (this.joy || (e.target as HTMLElement).closest('button, input, .overlay, .panel')) return;
      const r = stage.getBoundingClientRect();
      // Joystick flottant : on glisse dans la moitié basse (ou n'importe où à la souris).
      if (e.pointerType === 'touch' && e.clientY < r.top + r.height * 0.35) return;
      this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      stage.setPointerCapture(e.pointerId);
      this.showJoy();
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!this.joy || e.pointerId !== this.joy.id) return;
      this.joy.x = e.clientX;
      this.joy.y = e.clientY;
      this.showJoy();
    });
    const end = (e: PointerEvent): void => {
      if (this.joy && e.pointerId === this.joy.id) this.endJoy();
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  pressAbility(): void {
    this.abilityLatch = true;
  }

  private endJoy(): void {
    this.joy = null;
    this.joyEl.hidden = true;
  }

  private showJoy(): void {
    if (!this.joy) return;
    const r = this.stage.getBoundingClientRect();
    this.joyEl.hidden = false;
    this.joyEl.style.left = `${this.joy.ox - r.left}px`;
    this.joyEl.style.top = `${this.joy.oy - r.top}px`;
    let dx = this.joy.x - this.joy.ox;
    let dy = this.joy.y - this.joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) {
      dx = (dx / d) * this.radius;
      dy = (dy / d) * this.radius;
    }
    this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  /** Échantillonne l'entrée pour un tick. La compétence est « verrouillée » jusqu'au tick suivant. */
  sample(): InputSample {
    let mx = 0;
    let my = 0;
    const any = (codes: string[]): boolean => codes.some((c) => this.down.has(c));
    if (any(KEYS.left)) mx -= 127;
    if (any(KEYS.right)) mx += 127;
    if (any(KEYS.up)) my -= 127;
    if (any(KEYS.down)) my += 127;
    if (this.joy) {
      const dx = this.joy.x - this.joy.ox;
      const dy = this.joy.y - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > 8) {
        const k = Math.min(1, d / this.radius);
        mx = Math.round((dx / d) * 127 * k);
        my = Math.round((dy / d) * 127 * k);
      }
    }
    const ability = this.abilityLatch;
    this.abilityLatch = false;
    return { moveX: mx, moveY: my, ability };
  }

  reset(): void {
    this.abilityLatch = false;
  }
}
