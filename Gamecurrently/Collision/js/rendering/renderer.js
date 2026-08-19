import CONFIG from '../config.js';
import { Camera } from './camera.js';
import { Particles } from './particles.js';
import { rayHitRect } from '../core/math.js';
import { bus } from '../core/eventBus.js';

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
  // 狂战士：6块腹肌（球中央偏下，固定不动；颜色比球体更深）
  if (skillId === 'berserker') {
    g.save();
    g.fillStyle = '#000000';
    const cx = x, cy = y + r * 0.22;
    const w = r * 0.15, h = r * 0.12, gapX = r * 0.14, gapY = r * 0.04;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const bx = cx + (col === 0 ? -gapX / 2 - w / 2 : gapX / 2 + w / 2);
        const by = cy + (row - 1) * (h + gapY);
        g.beginPath();
        g.roundRect(bx - w / 2, by - h / 2, w, h, h * 0.4);
        g.fill();
      }
    }
    g.restore();
    return;
  }
  // 太阳：八道光芒射线 + 深橙日珥斑（3倍大战场球）
  if (skillId === 'sun') {
    g.save();
    // 光芒（八道三角射线）
    g.fillStyle = '#FFC300';
    for (let i = 0; i < 8; i++) {
      const a0 = i / 8 * Math.PI * 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a0) * r * 1.02, y + Math.sin(a0) * r * 1.02);
      g.lineTo(x + Math.cos(a0 + 0.13) * r * 1.55, y + Math.sin(a0 + 0.13) * r * 1.55);
      g.lineTo(x + Math.cos(a0 + 0.26) * r * 1.02, y + Math.sin(a0 + 0.26) * r * 1.02);
      g.closePath();
      g.fill();
    }
    // 深橙日珥斑
    g.fillStyle = '#E65100';
    const spots = [[0.2, -0.25, 0.22], [-0.3, 0.12, 0.16], [0.25, 0.32, 0.15], [-0.1, -0.05, 0.1]];
    for (const [dx, dy, sz] of spots) {
      g.beginPath();
      g.ellipse(x + dx * r, y + dy * r, sz * r, sz * r * 0.8, 0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }
  // 地球：海洋色打底 + 绿色板块（球内固定位置，像大陆）
  if (skillId === 'earth') {
    g.save();
    g.fillStyle = '#3E8E41';
    const plates = [
      [0.18, -0.30, 0.30],
      [-0.30, 0.05, 0.22],
      [0.30, 0.30, 0.18],
      [-0.05, 0.32, 0.14],
      [0.10, 0.02, 0.10],
    ];
    for (const [dx, dy, sz] of plates) {
      g.beginPath();
      g.ellipse(x + dx * r, y + dy * r, sz * r, sz * r * 0.72, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }
  // 火星：橘红底 + 三个陨石坑（无极冠）
  if (skillId === 'mars') {
    g.save();
    g.fillStyle = '#8a2e0a';
    // 三个陨石坑（左上 / 右中 / 右下）
    g.beginPath(); g.ellipse(x - r * 0.28, y - r * 0.3, r * 0.24, r * 0.17, 0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + r * 0.3, y + r * 0.02, r * 0.2, r * 0.14, -0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + r * 0.05, y + r * 0.38, r * 0.16, r * 0.12, 0.2, 0, Math.PI * 2); g.fill();
    g.restore();
    return;
  }
  // 死灵术士：球内深红色尸斑（大小不一、固定位置、不超出球体）
  if (skillId === 'necromancer') {
    g.save();
    g.fillStyle = '#7a0f1e';
    const spots = [
      [0.12, -0.32, 0.24],
      [-0.28, 0.08, 0.18],
      [0.28, 0.26, 0.14],
      [-0.08, -0.02, 0.10],
      [0.02, 0.34, 0.12],
    ];
    for (const [dx, dy, sz] of spots) {
      g.beginPath();
      g.ellipse(x + dx * r, y + dy * r, sz * r, sz * r * 0.78, 0.5, 0, Math.PI * 2);
      g.fill();
    }
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
    this.labels = [];
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
    // 地球【文明】事件文字提示（生态修复/战争破坏/对外开拓/流浪地球）
    bus.on('fx:earthLabel', ({ x, y, text }) => this.addLabel(x, y, text));
    // 太阳燃烧跳伤：橙红火星
    bus.on('fx:sunBurn', ({ x, y }) => this.particles.spawn(x, y, { color: '#FF6D00', count: 8, speed: 70, size: 3 }));
    // 有限太空：陨石撞击 / 激光边界 / 球撞大陨石
    bus.on('fx:meteorHit', ({ x, y }) => this.particles.spawn(x, y, { color: '#b0b0b0', count: 16, speed: 180, size: 4 }));
    bus.on('fx:laserHit', ({ x, y }) => this.particles.spawn(x, y, { color: '#e8f4ff', count: 10, speed: 120, size: 2 }));
    bus.on('fx:meteorBounce', ({ x, y }) => this.particles.spawn(x, y, { color: '#9a9a9a', count: 8, speed: 100, size: 3 }));
    // 火星沙尘伤害：橘红沙粒
    bus.on('fx:dustTick', ({ x, y }) => this.particles.spawn(x, y, { color: '#f5a35c', count: 6, speed: 50, size: 2 }));
    // 土星冰晶：敌球被冰晶块砸中 / 自己拾取冰晶块
    bus.on('fx:iceShardHit', ({ x, y }) => this.particles.spawn(x, y, { color: '#b8e0ff', count: 12, speed: 140, size: 3 }));
    bus.on('fx:icePick', ({ x, y }) => this.particles.spawn(x, y, { color: '#e0f4ff', count: 8, speed: 70, size: 2 }));
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
  addDmgNum(x, y, amount) { this.dmgNums.push({ x, y, amount: Math.round(amount), t: 0 }); }
  addHealNum(x, y, amount) { this.healNums.push({ x, y, amount, t: 0 }); }
  addSlashFx(x, y, dir, r, hit) { this.slashFx.push({ x, y, dir, r, hit, t: 0 }); }
  addLabel(x, y, text) { this.labels.push({ x, y, text, t: 0 }); }
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
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const d = this.labels[i];
      d.t += dt;
      if (d.t > 0.9) this.labels.splice(i, 1);
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
    // ★ 有限太空摄像机：随玩家球离中心越远逐渐放大（中心视野 1600×900，角落聚焦 800×450）
    if (battleMap?.id === 'finiteSpace') {
      const me = balls.find(b => b.isPlayer);
      const { w: FW, h: FH } = battleMap.size;
      const cx = FW / 2, cy = FH / 2;
      const maxD = Math.hypot(FW / 2, FH / 2);
      const d = me ? Math.hypot(me.x - cx, me.y - cy) : 0;
      const zoom = 0.5 + (d / maxD) * 0.5;
      g.translate(w / 2 - (me ? me.x : cx) * zoom, h / 2 - (me ? me.y : cy) * zoom);
      g.scale(zoom, zoom);
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
    for (const d of this.labels) this.drawLabel(g, d);
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
    // 地球探测器（对外开拓）：绿色追踪弹 + 光晕（帧追踪由 host sim 驱动）
    if (ph.isEarthProbe) {
      const r = ph.radius || 9;
      g.save();
      g.globalAlpha = 0.35;
      g.fillStyle = '#a7e8c5';
      g.beginPath(); g.arc(ph.x, ph.y, r * 1.8, 0, Math.PI * 2); g.fill();
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
    // 太阳激光：从太阳到目标的金色/橙红射线（0.4s 淡出；positive=补充能量金色 / 毁灭橙红）
    if (ph.isSunLaser) {
      const a = Math.max(0, 1 - (ph.t || 0) / 0.4);
      g.save();
      g.globalAlpha = a;
      g.strokeStyle = ph.positive ? '#FFD93D' : '#FF6D00';
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(ph.x, ph.y); g.lineTo(ph.tx, ph.ty); g.stroke();
      g.strokeStyle = '#FFF3C4';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(ph.x, ph.y); g.lineTo(ph.tx, ph.ty); g.stroke();
      g.fillStyle = ph.positive ? '#FFD93D' : '#FF6D00';
      g.beginPath(); g.arc(ph.tx, ph.ty, 8, 0, Math.PI * 2); g.fill();
      g.restore();
      return;
    }
    // 冰晶块（土星）：冰蓝菱形弹幕（缓慢旋转；飞行后停住原地）
    if (ph.isIceShard) {
      const s2 = 9;
      g.save();
      g.translate(ph.x, ph.y);
      g.rotate((ph.t || 0) * 2 + (ph.noise || 0));
      g.fillStyle = 'rgba(160,215,255,0.92)';
      g.beginPath();
      g.moveTo(0, -s2); g.lineTo(s2, 0); g.lineTo(0, s2); g.lineTo(-s2, 0);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(70,140,220,0.85)';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath(); g.arc(-s2 * 0.2, -s2 * 0.2, s2 * 0.25, 0, Math.PI * 2); g.fill();
      g.restore();
      return;
    }
    // 铁锈沙尘暴（火星）：红橙半透明旋转云 + 颗粒（渐影阶段 alpha 1→0）
    if (ph.isDustStorm) {
      const r = ph.radius || 70;
      const alpha = ph.hiding ? Math.max(0, 1 - (ph.hideT || 0) / 5) : 0.85;
      g.save();
      g.globalAlpha = alpha * 0.45;
      g.fillStyle = '#e0772a';
      g.beginPath(); g.arc(ph.x, ph.y, r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = alpha;
      g.fillStyle = '#f5a35c';
      for (let i = 0; i < 22; i++) {
        const a0 = i / 22 * Math.PI * 2 + (ph.t || 0) * 1.5;
        const rr = r * (0.25 + ((i * 13 + (ph.noise || 0)) % 10) / 12);
        g.beginPath();
        g.arc(ph.x + Math.cos(a0) * rr, ph.y + Math.sin(a0) * rr * 0.85, 3 + ((i * 7) % 3), 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(200,90,30,0.7)';
      g.lineWidth = 3;
      g.setLineDash([6, 6]);
      g.beginPath(); g.arc(ph.x, ph.y, r, 0, Math.PI * 2); g.stroke();
      g.restore();
      return;
    }
    // 陨石（有限太空）：灰色不规则球体（边缘凹凸、整体仍是圆）
    if (ph.isSmallMeteor || ph.isBigMeteor) {
      const r = ph.radius || 14;
      const noise = ph.noise || 0;
      g.save();
      g.fillStyle = '#8a8a8a';
      g.beginPath();
      const n = 12;
      for (let i = 0; i <= n; i++) {
        const a = i / n * Math.PI * 2;
        const rr = r * (0.85 + ((i * 7 + noise) % 5) / 10);
        const px = ph.x + Math.cos(a) * rr;
        const py = ph.y + Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = '#4a4a4a';
      g.lineWidth = 2.5;
      g.stroke();
      // 陨石坑斑点
      g.fillStyle = '#5c5c5c';
      g.beginPath(); g.arc(ph.x - r * 0.25, ph.y - r * 0.2, r * 0.22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6e6e6e';
      g.beginPath(); g.arc(ph.x + r * 0.3, ph.y + r * 0.25, r * 0.16, 0, Math.PI * 2); g.fill();
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
  // 文字提示（地球文明事件名）：与加减血数字同款描边样式，缓慢上飘淡出
  drawLabel(g, d) {
    const a = Math.max(0, 1 - d.t / 0.9);
    const y = d.y - d.t * 30;
    g.save();
    g.globalAlpha = a;
    g.font = "bold 16px 'ZCOOL KuaiLe', 'Comic Sans MS', sans-serif";
    g.textAlign = 'center';
    g.lineWidth = 4;
    g.strokeStyle = '#fff';
    g.strokeText(d.text, d.x, y);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeText(d.text, d.x, y);
    g.fillStyle = INK;
    g.fillText(d.text, d.x, y);
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
    // 自己的球：头顶持续显示黑色倒三角标记（死灵术士=当前意识球）
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
    // 燃烧（太阳）：橙红火焰粒子环绕（区别于毒液绿泡）
    if (b.effects.has('sun_burn')) {
      g.save();
      g.fillStyle = '#FF6D00';
      for (let i = 0; i < 6; i++) {
        const a0 = i / 6 * Math.PI * 2 + performance.now() / 300;
        const fl = r + 8 + Math.sin(performance.now() / 200 + i) * 4;
        g.beginPath();
        g.arc(b.x + Math.cos(a0) * fl, b.y + Math.sin(a0) * fl, 4 + Math.sin(performance.now() / 150 + i * 2) * 1.5, 0, Math.PI * 2);
        g.fill();
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
    // 土星：冰蓝渐变光环（画在球体之下——先画光环再画球，球体盖住光环内侧，只露出外圈，不遮挡球）
    if (b.skill?.def?.id === 'saturn') {
      const cr = b.crystal || 0;
      const thick = 3 + Math.min(1, cr / CONFIG.SATURN.autoCap) * 7;
      g.save();
      const grad = g.createRadialGradient(b.x, b.y, r + 8, b.x, b.y, r + 8 + thick * 2);
      grad.addColorStop(0, 'rgba(170,215,255,0.9)');
      grad.addColorStop(0.5, 'rgba(135,206,235,0.45)');
      grad.addColorStop(1, 'rgba(135,206,235,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(b.x, b.y, r + 8 + thick * 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(190,230,255,0.95)';
      g.lineWidth = thick;
      g.beginPath(); g.arc(b.x, b.y, r + 8 + thick / 2, 0, Math.PI * 2); g.stroke();
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