// キーボード＋タッチスティックの入力。値は画面基準（x: 右が+、y: 上が+）。

export class Input {
  constructor() {
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.onStart = null; // Enter / Space 用のコールバック

    window.addEventListener('keydown', (e) => {
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (!e.repeat && (k === 'Enter' || k === 'Space') && this.onStart) this.onStart();
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    this._setupStick();
  }

  _setupStick() {
    const base = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');
    if (!base || !knob) return;
    let activeId = null;

    const update = (e) => {
      const r = base.getBoundingClientRect();
      const radius = r.width / 2;
      let dx = e.clientX - (r.left + radius);
      let dy = e.clientY - (r.top + radius);
      const len = Math.hypot(dx, dy);
      if (len > radius) {
        dx = (dx / len) * radius;
        dy = (dy / len) * radius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 0.12;
      let nx = dx / radius;
      let ny = -dy / radius;
      if (Math.hypot(nx, ny) < dead) {
        nx = 0;
        ny = 0;
      }
      this.stick.x = nx;
      this.stick.y = ny;
    };
    const end = (e) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      knob.style.transform = 'translate(0px, 0px)';
      this.stick.x = 0;
      this.stick.y = 0;
    };
    base.addEventListener('pointerdown', (e) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      base.setPointerCapture(e.pointerId);
      update(e);
      e.preventDefault();
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId === activeId) update(e);
    });
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  // 移動入力ベクトル（長さ 1 以下に正規化）
  getVector() {
    const k = this.keys;
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let y = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
    x += this.stick.x;
    y += this.stick.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}
