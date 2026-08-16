import CONFIG from '../config.js';
import { Camera } from './camera.js';
import { Particles } from './particles.js';
import { rayHitRect } from '../core/math.js';

const INK = '#1f1a17';
const PAPER = '#f7edd8';
const DMG = '#e63946';
const HEAL = '#06d6a0';

// 缠绕特效（assets/vine.svg 预加载；四叶草装饰用手绘 canvas，不依赖图片加载，电脑/手机一致）
const vineImg = new Image();
vineImg.src = 'assets/vine.svg';

// ★ 职业装饰：必须在球体填充之后绘制（否则被球色盖住——老bug）
// 供对战 drawBall 与卡片图标（ui/ballIcon.js）共用：技能id + 骑士剑方向
export function drawBallDeco(g, x, y, r, skillId, swordAngle) {
  // 魔王：头顶双角（战场干扰球）
  if (skillId === 'demon') {
    g.save();
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(x - 10, y - r + 3); g.lineTo(x - 3, y - r - 18); g.lineTo(x + 2, y - r + 3); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x + 2, y - r + 3); g.lineTo(x + 8, y - r - 18); g.lineTo(x + 14, y - r + 3); g.closePath(); g.fill();
    g.fillStyle = '#ffb703';
    g.beginPath(); g.arc(x - 3, y - r - 18, 3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + 8, y - r - 18, 3, 0, Math.PI * 2); g.fill();
    g.restore();
    return;
  }
  // 骑士：腰间佩剑（剑身指向最近敌球；图标里固定斜 45°）
  if (skillId === 'knight' && swordAngle !== undefined) {
    const dir = swordAngle;
    const bx = x + Math.cos(dir) * r;
    const by = y + Math.sin(dir) * r;
    g.save();
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
    return;
  }
  // 法师：灰色八字胡（球中央偏下，固定不动）
  if (skillId === 'mage') {
    g.save();
    g.strokeStyle = '#7a7a7a';
    g.lineWidth = 3.5;
    g.lineCap = 'round';
    const cx = x, cy = y + r * 0.18;
    g.beginPath();
    g.moveTo(cx - r * 0.06, cy - r * 0.08);
    g.quadraticCurveTo(cx - r * 0.34, cy - r * 0.1, cx - r * 0.42, cy + r * 0.12);
    g.moveTo(cx + r * 0.06, cy - r * 0.08);
    g.quadraticCurveTo(cx + r * 0.34, cy - r * 0.1, cx + r * 0.42, cy + r * 0.12);
    g.stroke();
    g.restore();
    return;
  }
  // 牧师：木头色十字架（球中央偏下，固定不动）
  if (skillId === 'priest') {
    g.save();
    g.strokeStyle = '#8b5a2b';
    g.lineWidth = 5;
    g.lineCap = 'round';
    const cx = x, cy = y + r * 0.18;
    g.beginPath();
    g.moveTo(cx, cy - r * 0.55); g.lineTo(cx, cy + r * 0.55);
    g.moveTo(cx - r * 0.35, cy - r * 0.12); g.lineTo(cx + r * 0.35, cy - r * 0.12);
    g.stroke();
    g.restore();
  }
  // 纳西妲：四叶草（球中央偏左上，固定不动）——canvas 手绘，不依赖 SVG 加载（电脑/手机一致）
  if (skillId === 'nahida') {
    g.save();
    const s = r * 0.5;
    const cx = x - r * 0.28, cy = y - r * 0.42;
    // 叶茎
    g.strokeStyle = '#2E7D32';
    g.lineWidth = Math.max(2, r * 0.1);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx, cy + s * 0.28);
    g.lineTo(cx + s * 0.14, cy + s * 0.95);
    g.stroke();
    // 四片叶子（旋转 90° 分布）
    for (let i = 0; i < 4; i++) {
      g.save();
      g.translate(cx, cy);
      g.rotate(i * Math.PI / 2);
      g.fillStyle = '#2E7D32';
      g.beginPath();
      g.ellipse(0, -s * 0.34, s * 0.28, s * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // 花心
    g.fillStyle = '#1B5E20';
    g.beginPath(); g.arc(cx, cy, s * 0.17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#81C784';
    g.beginPath(); g.arc(cx, cy, s * 0.09, 0, Math.PI * 2); g.fill();
    g.restore();
    return;
  }
}

// Canvas 渲染：手绘涂鸦风（米色纸 + 黑描边 + 纯色块）
// 场地：由 battleMap（js/maps/*）绘制（arena 矩形 / ringHole 外圆+旋转方孔）
// 摄像机：ringHole 大圆场 = 小幅度追踪自己球（不缩放，保持原偏移观感）
// 特效实体（phantoms 随 STATE 同步）：奥术飞弹/魔族/斩击扇形（isSlashFx）——两端渲染一致
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
    this.healNums = [];
    this.slashFx = [];
    this.autoResize = autoResize;
    if (autoResize) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
    } else {
      canvas.width = CONFIG.FIELD.w; canvas.height = CONFIG.FIELD.h;
      this.dpr = 1; this.cssScale = 1;
    }
    // 纳西妲粒子（火种命中爆裂 / 缠绕跳伤绿叶）：单机+房主端；客人端靠 phantoms/effects 同步渲染
    bus.on('fx:seedHit', ({ x, y, color }) => this.particles.spawn(x, y, { color: color || '#44A785', count: 14, speed: 150, size: 3 }));
    bus.on('fx:vineTick', ({ x, y }) => this.particles.spawn(x, y, { color: '#7cb342', count: 6, speed: 60, size: 3 }));
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
  addHealNum(x, y, amount) { this.healNums.push({ x, y, amount, t: 0 }); }
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
    for (let i = this.healNums.length - 1; i >= 0; i--) {
      const d = this.healNums[i];
      d.t += dt;
      if (d.t > 0.5) this.healNums.splice(i, 1);
    }
    for (let i = this.slashFx.length - 1; i >= 0; i--) {
      const fx = this.slashFx[i];
      fx.t += dt;
      if (fx.t > 0.35) this.slashFx.splice(i, 1);
    }
  }
  // render(balls, t, phantoms, battleMap)：battleMap 提供场地绘制（js/maps/*）
  render(balls, t, phantoms = [], battleMap = null) {
    const g = this.g;
    const { w, h } = CONFIG.FIELD;
    g.setTransform(this.dpr * this.cssScale, 0, 0, this.dpr * this.cssScale, 0, 0);
    g.fillStyle = PAPER;
    g.fillRect(-56, -56, w + 112, h + 112);   // 纸底加大：容纳追踪偏移
    g.save();
    this.camera.update(t);
    this.camera.apply(g);
    // ★ 方孔大圆场摄像机：跟随自己球（幅度 65，不缩放）
    if (battleMap?.id === 'ringHole') {
      const me = balls.find(b => b.isPlayer);
      if (me) {
        const cx = w / 2, cy = h / 2;
        const maxShift = 65;
        g.translate(
          -((me.x - cx) / battleMap.radius) * maxShift,
          -((me.y - cy) / battleMap.radius) * maxShift
        );
      }
    }
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
    // 场地绘制：battleMap.draw（arena/ringHole）或默认矩形
    if (battleMap?.draw) battleMap.draw(g, t, w, h);
    else this.drawField(g, w, h);
    for (const a of this.aimLines) this.drawAim(g, a);
    for (const fx of this.lineFx) this.drawLineFx(g, fx);
    for (const fx of this.swapFx) this.drawSwapFx(g, fx);
    for (const ph of phantoms) {
      if (ph.isPearl) this.drawPearl(g, ph);
      else this.drawPhantom(g, ph);
    }
    for (const fx of this.slashFx) this.drawSlashFx(g, fx);
    for (const b of balls) this.drawBall(g, b);
    for (const d of this.dmgNums) this.drawNum(g, d, DMG, '');
    for (const d of this.healNums) this.drawNum(g, d, HEAL, '+');
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
    // 斩击扇形（isSlashFx 实体，随 phantoms 同步——房主/客人渲染一致）
    if (ph.isSlashFx) {
      const a = Math.max(0, 1 - (ph.t || 0) / 0.35);
      const R = (ph.r || 90) + 20;
      g.save();
      g.globalAlpha = a * 0.45;
      g.fillStyle = ph.hit ? '#ffd93d' : '#ffffff';
      g.beginPath();
      g.moveTo(ph.x, ph.y);
      g.arc(ph.x, ph.y, R, ph.dir - Math.PI / 2, ph.dir + Math.PI / 2);
      g.closePath();
      g.fill();
      g.globalAlpha = a * 0.75;
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(ph.x, ph.y);
      g.arc(ph.x, ph.y, R, ph.dir - Math.PI / 2, ph.dir + Math.PI / 2);
      g.closePath();
      g.stroke();
      g.restore();
      return;
    }
    // 奥术飞弹：紫色小弹（蓄能=实心+光晕 / 飞行=拖影）
    if (ph.isMissile) {
      const r = ph.radius || 7;
      g.save();
      if (!ph.charging) {
        g.globalAlpha = 0.3;
        g.fillStyle = ph.color;
        g.beginPath(); g.arc(ph.x - Math.cos(ph.angle) * r * 1.8, ph.y - Math.sin(ph.angle) * r * 1.8, r * 0.7, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
      g.fillStyle = ph.color;
      g.beginPath(); g.arc(ph.x, ph.y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(ph.x, ph.y, r, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath(); g.arc(ph.x - r * 0.25, ph.y - r * 0.25, r * 0.35, 0, Math.PI * 2); g.fill();
      g.restore();
      return;
    }
    // 生命火种（纳西妲）：绿色高速小弹 + 光晕拖影
    if (ph.isSeed) {
      const r = ph.radius || 9;
      g.save();
      g.globalAlpha = 0.3;
      g.fillStyle = ph.color;
      g.beginPath(); g.arc(ph.x - Math.cos(ph.angle) * r * 2.2, ph.y - Math.sin(ph.angle) * r * 2.2, r * 0.7, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.35;
      g.fillStyle = '#a7e8c5';
      g.beginPath(); g.arc(ph.x, ph.y, r * 1.9, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = ph.color;
      g.beginPath(); g.arc(ph.x, ph.y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1f5c3a';
      g.lineWidth = 2;
      g.beginPath(); g.arc(ph.x, ph.y, r, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(ph.x - r * 0.25, ph.y - r * 0.25, r * 0.35, 0, Math.PI * 2); g.fill();
      g.restore();
      return;
    }
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
  // 骑士斩击扇形（本地 slashFx 数组保留：兼容单机/旧调用；主力渲染走 phantoms）
  drawSlashFx(g, fx) {
    const a = Math.max(0, 1 - fx.t / 0.35);
    const R = fx.r + 20;
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
  // 数字：prefix 区分加减血（减血无符号，加血带 +）
  drawNum(g, d, color, prefix) {
    const a = Math.max(0, 1 - d.t / 0.5);
    const y = d.y - d.t * 26;
    const text = prefix + d.amount;
    g.save();
    g.globalAlpha = a;
    g.font = "bold 20px 'ZCOOL KuaiLe', 'Comic Sans MS', sans-serif";
    g.textAlign = 'center';
    g.lineWidth = 4;
    g.strokeStyle = '#fff';
    g.strokeText(text, d.x, y);
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.strokeText(text, d.x, y);
    g.fillStyle = color;
    g.fillText(text, d.x, y);
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
    // 球体基础：填充 + 高光 + 描边
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
    g.restore();
    // ★ 职业装饰：必须在球体填充之后绘制（否则被球色盖住——老bug）
    drawBallDeco(g, b.x, b.y, r, b.skill?.def?.id, b._swordAngle);
    // 缠绕（纳西妲）：藤蔓环绕 + 缓慢旋转（随 effects 同步两端）
    if (b.effects.has('vine_wrap') && vineImg.complete) {
      g.save();
      g.globalAlpha = 0.9;
      g.translate(b.x, b.y);
      g.rotate(performance.now() / 1400);
      g.drawImage(vineImg, -r * 2.1, -r * 2.1, r * 4.2, r * 4.2);
      g.restore();
    }
    // 受击闪白 / 加血闪绿（叠在球体+装饰上）
    g.save();
    if (b.flash > 0) {
      g.globalAlpha = Math.min(1, b.flash);
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    if (b.healFlash > 0) {
      g.globalAlpha = Math.min(1, b.healFlash);
      g.fillStyle = HEAL;
      g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
  }
}
