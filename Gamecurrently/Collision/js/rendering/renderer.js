import CONFIG from '../config.js';
import { Camera } from './camera.js';
import { Particles } from './particles.js';
import { rayHitRect } from '../core/math.js';

const INK = '#1f1a17';
const PAPER = '#f7edd8';

// Canvas 渲染：手绘涂鸦风（米色纸 + 黑描边 + 纯色块）
// autoResize=false 用于首页背景（全屏拉伸做氛围）
export class Renderer {
  constructor(canvas, { autoResize = true } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.camera = new Camera();
    this.particles = new Particles();
    this.aimLines = [];
    this.lineFx = [];
    this.autoResize = autoResize;
    if (autoResize) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
    } else {
      canvas.width = CONFIG.FIELD.w; canvas.height = CONFIG.FIELD.h;
      this.dpr = 1; this.cssScale = 1;
    }
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { w, h } = CONFIG.FIELD;
    const scale = Math.min(window.innerWidth / w, window.innerHeight / h);
    this.cssScale = scale; this.dpr = dpr;
    this.canvas.style.width = (w * scale) + 'px';
    this.canvas.style.height = (h * scale) + 'px';
    this.canvas.width = Math.round(w * scale * dpr);
    this.canvas.height = Math.round(h * scale * dpr);
  }
  setAim(inst, on) {
    this.aimLines = this.aimLines.filter(a => a.inst !== inst);
    if (on) this.aimLines.push({ inst });
  }
  // 释放线：记录释放瞬间的起点（不跟随球移动，避免乱飞）
  addLineFx(ball, hit) { this.lineFx.push({ x0: ball.x, y0: ball.y, hit, t: 0 }); }
  update(dt) {
    this.particles.update(dt);
    for (let i = this.lineFx.length - 1; i >= 0; i--) {
      const fx = this.lineFx[i];
      fx.t += dt;
      if (fx.t > 0.45) this.lineFx.splice(i, 1);
    }
  }
  render(balls, t) {
    const g = this.g;
    const { w, h } = CONFIG.FIELD;
    g.setTransform(this.dpr * this.cssScale, 0, 0, this.dpr * this.cssScale, 0, 0);
    g.fillStyle = PAPER;
    g.fillRect(-24, -24, w + 48, h + 48);
    g.save();
    this.camera.update(t);
    this.camera.apply(g);
    this.drawField(g, w, h);
    for (const a of this.aimLines) this.drawAim(g, a);
    for (const fx of this.lineFx) this.drawLineFx(g, fx);
    for (const b of balls) this.drawBall(g, b);
    this.particles.draw(g);
    g.restore();
  }
  drawField(g, w, h) {
    // 粗黑圆角边框（手绘双线感）
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    if (g.roundRect) g.roundRect(3, 3, w - 6, h - 6, 14); else g.rect(3, 3, w - 6, h - 6);
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(31,26,23,0.45)';
    g.beginPath();
    if (g.roundRect) g.roundRect(11, 11, w - 22, h - 22, 9); else g.rect(11, 11, w - 22, h - 22);
    g.stroke();
    // 中线（虚线十字）
    g.save();
    g.setLineDash([10, 10]);
    g.strokeStyle = 'rgba(31,26,23,0.55)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(w / 2, 6); g.lineTo(w / 2, h - 6); g.stroke();
    g.beginPath(); g.moveTo(6, h / 2); g.lineTo(w - 6, h / 2); g.stroke();
    g.restore();
  }
  // 瞄准线：每帧实时计算命中点（绳索时刻指向最近敌球）
  drawAim(g, a) {
    const hit = rayHitRect(a.inst.owner.x, a.inst.owner.y, a.inst.aimDir, CONFIG.FIELD.w, CONFIG.FIELD.h);
    g.save();
    g.setLineDash([8, 8]);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(a.inst.owner.x, a.inst.owner.y); g.lineTo(hit.x, hit.y); g.stroke();
    g.setLineDash([]);
    // 命中点：手绘 X 标记
    const s = 8;
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(hit.x - s, hit.y - s); g.lineTo(hit.x + s, hit.y + s);
    g.moveTo(hit.x + s, hit.y - s); g.lineTo(hit.x - s, hit.y + s);
    g.stroke();
    g.restore();
  }
  drawLineFx(g, fx) {
    g.save();
    g.globalAlpha = Math.max(0, 1 - fx.t / 0.45);
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(fx.x0, fx.y0); g.lineTo(fx.hit.x, fx.hit.y); g.stroke();
    g.fillStyle = '#ffb703';
    g.beginPath(); g.arc(fx.hit.x, fx.hit.y, 10, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  drawBall(g, b) {
    const r = b.radiusScaled;
    if (b.dashing) {
      // 冲刺拖尾：方块涂鸦
      g.save();
      g.globalAlpha = 0.4;
      g.fillStyle = b.color;
      for (let i = 1; i <= 3; i++) {
        const s = r * (1 - i * 0.22);
        g.fillRect(b.x - Math.cos(b.angle) * r * i * 0.9 - s / 2, b.y - Math.sin(b.angle) * r * i * 0.9 - s / 2, s, s);
      }
      g.restore();
    }
    g.save();
    // 纯色球体
    g.fillStyle = b.color;
    g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
    // 手绘高光小白点
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.arc(b.x - r * 0.3, b.y - r * 0.35, r * 0.2, 0, Math.PI * 2); g.fill();
    // 黑描边（巨大化变金色）
    const giant = b.effects.has('giant_form');
    g.lineWidth = giant ? 5 : 3;
    g.strokeStyle = giant ? '#ffb703' : INK;
    if (giant && Math.random() < 0.3) g.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.stroke();
    if (b.flash > 0) {
      g.globalAlpha = Math.min(1, b.flash);
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
  }
}
