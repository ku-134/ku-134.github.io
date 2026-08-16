import CONFIG from '../config.js';

// 有限太空：3200×1600 超大矩形太空（摄像机随玩家离中心越远逐渐放大）
// 背景：黑色星空 + 星星点缀；边框：白色激光
// 特殊机制（MatchSim 管理）：
//   - 激光边界：每次触碰边界造成 5 伤（0.5s 防抖）
//   - 小陨石群：每秒 3~4 颗（场上≤10），从边界外高速横穿矩形（存在时间上限 2.5~3s），撞玩家球 20 伤并消失
//   - 大陨石群：3~4 颗场内缓慢游荡、碰边界反弹；被球撞击不移动不转向，但会把撞击的球反弹走
// 陨石外观：灰色不规则球体（边缘凹凸、整体仍是圆）
export default {
  id: 'finiteSpace',
  name: '有限太空',
  desc: '3200×1600 超大太空：黑色星空 + 白色激光边界（触碰5伤）。小陨石高速横穿（撞20伤）、大陨石缓慢游荡（碰球反弹）。摄像机随你离中心越远逐渐放大。',
  color: '#05070f',
  size: { w: 3200, h: 1600 },
  // 5 个出生点（中心 + 四方位）——玩家2球 + 战场球随机取 3 个
  spawnPoints: [
    { x: 1600, y: 800 },
    { x: 1000, y: 800 },
    { x: 2200, y: 800 },
    { x: 1600, y: 450 },
    { x: 1600, y: 1150 },
  ],
  // 场地绘制：黑色星空背景 + 星星 + 白色激光边框 + 中心十字参考
  draw(g, t, w, h) {
    const { w: FW, h: FH } = this.size;
    // 黑色太空背景
    g.fillStyle = '#05070f';
    g.fillRect(0, 0, FW, FH);
    // 星星点缀（固定伪随机布局，闪烁）
    g.fillStyle = '#ffffff';
    let s = 24601;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < 300; i++) {
      const sx = rnd() * FW, sy = rnd() * FH;
      const tw = 0.75 + 0.25 * Math.sin(t * 1.5 + i * 1.7);
      g.globalAlpha = (0.25 + rnd() * 0.6) * tw;
      g.beginPath(); g.arc(sx, sy, rnd() < 0.88 ? 1 : 2.2, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // 白色激光边框（双层发光）
    g.strokeStyle = 'rgba(232,244,255,0.35)';
    g.lineWidth = 16;
    g.strokeRect(0, 0, FW, FH);
    g.strokeStyle = '#e8f4ff';
    g.lineWidth = 5;
    g.strokeRect(3, 3, FW - 6, FH - 6);
    // 中心十字参考（淡蓝虚线）
    g.strokeStyle = 'rgba(232,244,255,0.14)';
    g.lineWidth = 2;
    g.setLineDash([40, 40]);
    g.beginPath(); g.moveTo(FW / 2, 0); g.lineTo(FW / 2, FH); g.stroke();
    g.beginPath(); g.moveTo(0, FH / 2); g.lineTo(FW, FH / 2); g.stroke();
    g.setLineDash([]);
  },
  // 物理边界：3200×1600 矩形反弹（激光伤害由 MatchSim 处理）
  collide(b) {
    const { w: FW, h: FH } = this.size;
    const r = b.radiusScaled;
    let hit = false;
    if (b.x < r) { b.x = r; b.setAngle(Math.PI - b.angle); hit = true; }
    else if (b.x > FW - r) { b.x = FW - r; b.setAngle(Math.PI - b.angle); hit = true; }
    if (b.y < r) { b.y = r; b.setAngle(-b.angle); hit = true; }
    else if (b.y > FH - r) { b.y = FH - r; b.setAngle(-b.angle); hit = true; }
    return hit;
  },
};
