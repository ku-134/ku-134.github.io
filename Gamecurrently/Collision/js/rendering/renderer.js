import CONFIG from '../config.js';
import { Camera } from './camera.js';
import { Particles } from './particles.js';
import { rayHitRect } from '../core/math.js';

const INK = '#1f1a17';
const PAPER = '#f7edd8';
const DMG = '#e63946';

// Canvas 渲染：手绘涂鸦风（米色纸 + 黑描边 + 纯色块）
// 骑士：腰间佩剑（剑身始终指向敌球）+ 斩击扇形特效
// 魔王：紫色大球（1.5倍）+ 头顶双角；魔族：深紫小眷属（游走/冲刺）
export class Renderer {
  constructor(canvas, { autoResize = true } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.camera = new Camera();
    this.particles = new Particles();
    this.aimLines = [];
    this.lineFx = [];
    this.swapFx = [];
    this.dmgNums = [];
    this.slashFx = [];
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
  addLineFx(ball, hit) { this.lineFx.push({ x0: ball.x, y0: ball.y, hit, t: 0 }); }
  addSwapFx(a, b) { this.swapFx.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, t: 0 }); }
  addDmgNum(x, y, amount) { this.dmgNums.push({ x, y, amount, t: 0 }); }
  addSlashFx(x, y, dir, r, hit) { this.slashFx.push({ x, y, dir, r, hit, t: 0 }); }
  update(dt) {
    this.particles.update(dt);
    for (let i = this.lineFx.length - 1; i >= 0; i--) {
      const fx = this.lineFx[i];
      fx.t += dt;
      if (fx.t > 0.45) this.lineFx.splice(i, 1);
    }
    for (let i = this.swapFx.length - 1; i >= 0; i--) {
      const fx = this.swapFx[i];
      fx.t += dt;
      if (fx.t > 0.5) this.swapFx.splice(i, 1);
    }
    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const d = this.dmgNums[i];
      d.t += dt;
      if (d.t > 0.5) this.dmgNums.splice(i, 1);
    }
    for (let i = this.slashFx.length - 1; i >= 0; i--) {
      const fx = this.slashFx[i];
      fx.t += dt;
      if (fx.t > 0.35) this.slashFx.splice(i, 1);
    }
  }
  render(balls, t, phantoms = []) {
    const g = this.g;
    const { w, h } = CONFIG.FIELD;
    g.setTransform(this.dpr * this.cssScale, 0, 0, this.dpr * this.cssScale, 0, 0);
    g.fillStyle = PAPER;
    g.fillRect(-24, -24, w + 48, h + 48);
    g.save();
    this.camera.update(t);
    this.camera.apply(g);
    // 骑士佩剑方向：剑身指向最近的敌球
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.skill?.def?.id === 'knight') {
        let other = null; let bd = Infinity;
        for (let j = 0; j < balls.length; j++) {
          if (j === i) continue;
          const d = Math.hypot(balls[j].x - b.x, balls[j].y - b.y);
          if (d < bd) { bd = d; other = balls[j]; }
        }
        b._swordAngle = other ? Math.atan2(other.y - b.y, other.x - b.x) : b.angle;
      }
    }
    this.drawField(g, w, h);
    for (const a of this.aimLines) this.drawAim(g, a);
    for (const fx of this.lineFx) this.drawLineFx(g, fx);
    for (const fx of this.swapFx) this.drawSwapFx(g, fx);
    for (const ph of phantoms) {
      if (ph.isPearl) this.drawPearl(g, ph);
      else this.drawPhantom(g, ph);
    }
    for (const fx of this.slashFx) this.drawSlashFx(g, fx);
    for (const b of balls) this.drawBall(g, b);
    for (const d of this.dmgNums) this.drawDmgNum(g, d);
    this.particles.draw(g);
    g.restore();
  }
  drawField(g, w, h) {
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
    g.save();
    g.setLineDash([10, 10]);
    g.strokeStyle = 'rgba(31,26,23,0.55)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(w / 2, 6); g.lineTo(w / 2, h - 6); g.stroke();
    g.beginPath(); g.moveTo(6, h / 2); g.lineTo(w - 6, h / 2); g.stroke();
    g.restore();
  }
  drawAim(g, a) {
    const hit = rayHitRect(a.inst.owner.x, a.inst.owner.y, a.inst.aimDir, CONFIG.FIELD.w, CONFIG.FIELD.h);
    g.save();
    g.setLineDash([8, 8]);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(a.inst.owner.x, a.inst.owner.y); g.lineTo(hit.x, hit.y); g.stroke();
    g.setLineDash([]);
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
  drawSwapFx(g, fx) {
    const a = Math.max(0, 1 - fx.t / 0.5);
    g.save();
    g.globalAlpha = a;
    g.strokeStyle = '#00b4d8';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(fx.x1, fx.y1);
    g.quadraticCurveTo((fx.x1 + fx.x2) / 2, (fx.y1 + fx.y2) / 2 - 40, fx.x2, fx.y2);
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(fx.x1, fx.y1, 8, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(fx.x2, fx.y2, 8, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  drawPhantom(g, ph) {
    // 魔族（魔王眷属）：深紫实心小眷属 + 双角，冲刺时带拖影
    if (ph.isMinion) {
      const r = ph.radius;
      g.save();
      if (ph.dashing) {
        g.globalAlpha = 0.35;
        g.fillStyle = ph.color;
        g.beginPath(); g.arc(ph.x - Math.cos(ph.dashAngle) * r * 1.4, ph.y - Math.sin(ph.dashAngle) * r * 1.4, r * 0.7, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
      g.fillStyle = ph.color;
      g.beginPath(); g.arc(ph.x, ph.y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(ph.x, ph.y, r, 0, Math.PI * 2); g.stroke();
      // 双角
      g.fillStyle = INK;
      g.beginPath(); g.moveTo(ph.x - 6, ph.y - r + 2); g.lineTo(ph.x - 2, ph.y - r - 9); g.lineTo(ph.x + 1, ph.y - r + 2); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(ph.x + 1, ph.y - r + 2); g.lineTo(ph.x + 5, ph.y - r - 9); g.lineTo(ph.x + 8, ph.y - r + 2); g.closePath(); g.fill();
      g.restore();
      return;
    }
    // 幻影分身：半透明虚影
    const r = ph.radius;
    g.save();
    g.globalAlpha = 0.25;
    g.fillStyle = ph.color;
    g.beginPath(); g.arc(ph.x - Math.cos(ph.angle) * r * 0.9, ph.y - Math.sin(ph.angle) * r * 0.9, r * 0.8, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.65;
    g.fillStyle = ph.color;
    g.beginPath(); g.arc(ph.x, ph.y, r, 0, Math.PI * 2); g.fill();
    g.setLineDash([6, 6]);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.beginPath(); g.arc(ph.x, ph.y, r, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
  drawPearl(g, p) {
    const r = p.radius;
    g.save();
    g.globalAlpha = 0.35;
    g.fillStyle = '#00b4d8';
    g.beginPath(); g.arc(p.x - Math.cos(p.angle) * r * 2, p.y - Math.sin(p.angle) * r * 2, r * 0.6, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = '#e0fbfc';
    g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(0,180,216,0.6)';
    g.beginPath(); g.arc(p.x - r * 0.25, p.y - r * 0.25, r * 0.4, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // 骑士斩击扇形：半透明白（命中=金色），面向 dir 的 180° 半圆
  drawSlashFx(g, fx) {
    const a = Math.max(0, 1 - fx.t / 0.35);
    const R = fx.r + 20;   // 从球边延伸 fx.r
    g.save();
    g.globalAlpha = a * 0.45;
    g.fillStyle = fx.hit ? '#ffd93d' : '#ffffff';
    g.beginPath();
    g.moveTo(fx.x, fx.y);
    g.arc(fx.x, fx.y, R, fx.dir - Math.PI / 2, fx.dir + Math.PI / 2);
    g.closePath();
    g.fill();
    g.globalAlpha = a * 0.75;
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(fx.x, fx.y);
    g.arc(fx.x, fx.y, R, fx.dir - Math.PI / 2, fx.dir + Math.PI / 2);
    g.closePath();
    g.stroke();
    g.restore();
  }
  drawDmgNum(g, d) {
    const a = Math.max(0, 1 - d.t / 0.5);
    const y = d.y - d.t * 26;
    g.save();
    g.globalAlpha = a;
    g.font = "bold 20px 'ZCOOL KuaiLe', 'Comic Sans MS', sans-serif";
    g.textAlign = 'center';
    g.lineWidth = 4;
    g.strokeStyle = '#fff';
    g.strokeText(d.amount, d.x, y);
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.strokeText(d.amount, d.x, y);
    g.fillStyle = DMG;
    g.fillText(d.amount, d.x, y);
    g.restore();
  }
  drawBall(g, b) {
    const r = b.radiusScaled;
    // 自己的球：头顶持续显示黑色倒三角标记
    if (b.isPlayer) {
      g.save();
      const bob = Math.sin(performance.now() / 280) * 3;
      g.fillStyle = INK;
      g.beginPath();
      g.moveTo(b.x, b.y - r - 24 + bob);
      g.lineTo(b.x - 9, b.y - r - 11 + bob);
      g.lineTo(b.x + 9, b.y - r - 11 + bob);
      g.closePath();
      g.fill();
      g.restore();
    }
    // 魔王：头顶双角（战场干扰球）
    if (b.skill?.def?.id === 'demon') {
      g.save();
      g.fillStyle = INK;
      g.beginPath(); g.moveTo(b.x - 10, b.y - r + 3); g.lineTo(b.x - 3, b.y - r - 18); g.lineTo(b.x + 2, b.y - r + 3); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(b.x + 2, b.y - r + 3); g.lineTo(b.x + 8, b.y - r - 18); g.lineTo(b.x + 14, b.y - r + 3); g.closePath(); g.fill();
      g.fillStyle = '#ffb703';
      g.beginPath(); g.arc(b.x - 3, b.y - r - 18, 3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(b.x + 8, b.y - r - 18, 3, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // 骑士：腰间佩剑（剑身指向最近的敌球）
    if (b.skill?.def?.id === 'knight' && b._swordAngle !== undefined) {
      g.save();
      const dir = b._swordAngle;
      const bx = b.x + Math.cos(dir) * r;
      const by = b.y + Math.sin(dir) * r;
      g.strokeStyle = '#c8c8c8';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(dir) * r * 0.9, by + Math.sin(dir) * r * 0.9);
      g.stroke();
      g.fillStyle = '#f0f0f0';
      g.beginPath(); g.arc(bx + Math.cos(dir) * r * 0.9, by + Math.sin(dir) * r * 0.9, 3.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#8a6d3b';
      g.lineWidth = 4;
      const hx = bx + Math.cos(dir) * r * 0.25;
      const hy = by + Math.sin(dir) * r * 0.25;
      const px = Math.cos(dir + Math.PI / 2) * 7;
      const py = Math.sin(dir + Math.PI / 2) * 7;
      g.beginPath();
      g.moveTo(hx - px, hy - py);
      g.lineTo(hx + px, hy + py);
      g.stroke();
      g.restore();
    }
    // 荆棘盾：金色锯齿环
    if (b.effects.has('shield')) {
      g.save();
      g.strokeStyle = '#b8a24a';
      g.lineWidth = 3;
      for (let i = 0; i < 14; i++) {
        const a0 = i / 14 * Math.PI * 2 + performance.now() / 1000 * 1.5;
        g.beginPath();
        g.moveTo(b.x + Math.cos(a0) * (r + 5), b.y + Math.sin(a0) * (r + 5));
        g.lineTo(b.x + Math.cos(a0 + 0.14) * (r + 12), b.y + Math.sin(a0 + 0.14) * (r + 12));
        g.stroke();
      }
      g.restore();
    }
    // 引力场：虚线范围圈 + 方向线
    const magnet = b.effects.get('tether');
    if (magnet) {
      g.save();
      g.setLineDash([6, 6]);
      g.strokeStyle = 'rgba(95,39,205,0.55)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(b.x, b.y, CONFIG.MAGNET.range, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      const a0 = magnet.t * 3;
      for (let i = 0; i < 6; i++) {
        const a = a0 + i / 6 * Math.PI * 2;
        g.strokeStyle = 'rgba(95,39,205,0.4)';
        g.beginPath();
        g.moveTo(b.x + Math.cos(a) * 30, b.y + Math.sin(a) * 30);
        g.lineTo(b.x + Math.cos(a) * 46, b.y + Math.sin(a) * 46);
        g.stroke();
      }
      g.restore();
    }
    // 腐蚀：绿色气泡描边
    if (b.effects.has('poison')) {
      g.save();
      g.strokeStyle = 'rgba(106,153,78,0.75)';
      g.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a0 = i / 8 * Math.PI * 2;
        g.beginPath();
        g.arc(b.x + Math.cos(a0) * (r + 3), b.y + Math.sin(a0) * (r + 3), 4, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }
    if (b.dashing) {
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
    g.fillStyle = b.color;
    g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.arc(b.x - r * 0.3, b.y - r * 0.35, r * 0.2, 0, Math.PI * 2); g.fill();
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
