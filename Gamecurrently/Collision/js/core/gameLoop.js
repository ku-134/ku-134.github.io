// 固定步长主循环：保证物理确定性（为联机快照同步打基础）
export class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.acc = 0;
    this.last = 0;
    this.step = 1 / 60;
    this.time = 0;
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick.bind(this));
  }
  stop() { this.running = false; }
  tick(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.acc += dt;
    while (this.acc >= this.step) {
      this.update(this.step);
      this.acc -= this.step;
      this.time += this.step;
    }
    this.render(this.time, dt);
    requestAnimationFrame(this.tick.bind(this));
  }
}
