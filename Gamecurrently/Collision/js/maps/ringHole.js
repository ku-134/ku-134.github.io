import CONFIG from '../config.js';

// 方孔大圆场：大圆内部、旋转方孔外部游走（圆超出显示框，由摄像机追踪展示）
// 场地文件职责：出生点位 + 绘制（外圆 + 顺时针旋转方孔）+ 物理边界（外圆反弹 + 方孔推出）
// 旋转：方孔绕中心顺时针自转（spin rad/s），球撞孔边反弹、被推入孔内则推出
// ★ 反弹方向：法线指向球外，球向孔移动时 v·n < 0 → 反射（原代码写反导致无反弹）
export default {
  id: 'ringHole',
  name: '方孔大圆场',
  desc: '大圆场地中央有顺时针旋转的方孔——球只能在大圆内部、方孔外部游走，孔边旋转会把球刮走，走位更有讲究！',
  color: '#efe3cf',
  radius: CONFIG.RINGHOLE.radius,      // 外圆半径（大于显示框，摄像机追踪）
  holeSize: CONFIG.RINGHOLE.holeSize,  // 方孔边长
  spin: CONFIG.RINGHOLE.spin,          // 方孔旋转角速度（rad/s，顺时针）
  spawnPoints: [
    { x: 400 + 150, y: 225 },
    { x: 400 - 150, y: 225 },
    { x: 400, y: 225 + 150 },
    { x: 400, y: 225 - 150 },
  ],
  // 方孔当前旋转角（顺时针）
  holeAngle(t) { return (t * this.spin) % (Math.PI * 2); },
  // 场地绘制：外圆 + 旋转方孔（纸色洞 + 黑框 + 右缘标记点显旋转）
  draw(g, t, w, h) {
    const cx = w / 2, cy = h / 2;
    // 外圆（超出画布部分自然裁掉）
    g.save();
    g.strokeStyle = '#1f1a17';
    g.lineWidth = 6;
    g.beginPath(); g.arc(cx, cy, this.radius, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(31,26,23,0.45)';
    g.beginPath(); g.arc(cx, cy, this.radius - 8, 0, Math.PI * 2); g.stroke();
    // 旋转方孔
    const ang = this.holeAngle(t);
    g.save();
    g.translate(cx, cy);
    g.rotate(ang);
    g.fillStyle = '#f7edd8';
    g.fillRect(-this.holeSize / 2, -this.holeSize / 2, this.holeSize, this.holeSize);
    g.strokeStyle = '#1f1a17';
    g.lineWidth = 4;
    g.strokeRect(-this.holeSize / 2, -this.holeSize / 2, this.holeSize, this.holeSize);
    // 右缘标记点：让旋转肉眼可见
    g.fillStyle = '#1f1a17';
    g.beginPath(); g.arc(this.holeSize / 2, 0, 5, 0, Math.PI * 2); g.fill();
    g.restore();
    // 中心小点
    g.fillStyle = 'rgba(31,26,23,0.5)';
    g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    g.restore();
  },
  // 物理边界：外圆反弹 + 方孔推出/反弹（返回是否碰撞）
  collide(b, t) {
    const { w, h } = CONFIG.FIELD;
    const cx = w / 2, cy = h / 2;
    const r = b.radiusScaled;
    let hit = false;
    // 1) 外圆：距圆心 <= R - r
    const dx = b.x - cx, dy = b.y - cy;
    const d = Math.hypot(dx, dy) || 0.001;
    const maxD = this.radius - r;
    if (d > maxD) {
      const nx = dx / d, ny = dy / d;
      b.x = cx + nx * maxD;
      b.y = cy + ny * maxD;
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) b.setAngle(Math.atan2(b.vy - 2 * vn * ny, b.vx - 2 * vn * nx));
      hit = true;
    }
    // 2) 内方孔（旋转）：球心到旋转矩形最近点距离 >= r
    const ang = this.holeAngle(t);
    const cos = Math.cos(-ang), sin = Math.sin(-ang);
    const lx = dx * cos - dy * sin;   // 球心在孔局部坐标
    const ly = dx * sin + dy * cos;
    const half = this.holeSize / 2;
    const qx = Math.max(-half, Math.min(half, lx));
    const qy = Math.max(-half, Math.min(half, ly));
    const ddx = lx - qx, ddy = ly - qy;
    const dist = Math.hypot(ddx, ddy);
    if (dist < r) {
      // 目标位置（孔局部）：球心到矩形最近点（或最近边）向外 r
      let nx2, ny2, px, py;
      if (dist < 0.001) {
        // 球心在孔内：沿最近边法线推出到边外 r（防止只推 r 仍卡孔内）
        const dL = lx + half, dR = half - lx, dT = ly + half, dB = half - ly;
        const m = Math.min(dL, dR, dT, dB);
        if (m === dL) { nx2 = -1; ny2 = 0; px = -half - r; py = Math.max(-half, Math.min(half, ly)); }
        else if (m === dR) { nx2 = 1; ny2 = 0; px = half + r; py = Math.max(-half, Math.min(half, ly)); }
        else if (m === dT) { nx2 = 0; ny2 = -1; py = -half - r; px = Math.max(-half, Math.min(half, lx)); }
        else { nx2 = 0; ny2 = 1; py = half + r; px = Math.max(-half, Math.min(half, lx)); }
      } else {
        nx2 = ddx / dist; ny2 = ddy / dist;
        px = qx + nx2 * r; py = qy + ny2 * r;
      }
      // 位置修正（孔局部）→ 世界
      b.x = cx + px * Math.cos(ang) - py * Math.sin(ang);
      b.y = cy + px * Math.sin(ang) + py * Math.cos(ang);
      // ★ 反弹：法线指向球外，球向孔移动（v·n < 0）→ 反射（原写 vn>0 导致无反弹）
      const wnx = nx2 * Math.cos(ang) - ny2 * Math.sin(ang);
      const wny = nx2 * Math.sin(ang) + ny2 * Math.cos(ang);
      const vn = b.vx * wnx + b.vy * wny;
      if (vn < 0) b.setAngle(Math.atan2(b.vy - 2 * vn * wny, b.vx - 2 * vn * wnx));
      hit = true;
    }
    return hit;
  },
};
