import CONFIG from '../config.js';
import { rand } from '../core/math.js';

// 摄像机：随机呼吸晃动，让观战不单调
// 每局随机相位/频率，幅度来自配置
export class Camera {
  constructor() {
    this.phase = Math.random() * Math.PI * 2;
    this.freq = rand(...CONFIG.CAMERA.freq);
    this.amp = CONFIG.CAMERA.amp;
    this.ox = 0; this.oy = 0;
  }
  update(t) {
    this.ox = Math.sin(t * this.freq * Math.PI * 2 + this.phase) * this.amp;
    this.oy = Math.cos(t * this.freq * 1.3 + this.phase) * this.amp;
  }
  apply(g) { g.translate(this.ox, this.oy); }
}
