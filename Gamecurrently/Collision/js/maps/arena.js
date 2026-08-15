import CONFIG from '../config.js';

// 经典角斗场：800×450 手绘矩形场地
// 场地文件职责：出生点位（玩家/战场球随机分配）+ 绘制 + 物理边界
export default {
  id: 'arena',
  name: '经典角斗场',
  desc: '800×450 手绘矩形角斗场，四方开阔，战场球乱入。经典永不过时！',
  color: '#f7edd8',
  // 4 个对称出生点（左/右/上/下）——玩家2球+战场球随机取3个
  spawnPoints: [
    { x: 240, y: 225 },
    { x: 560, y: 225 },
    { x: 400, y: 120 },
    { x: 400, y: 330 },
  ],
  // 场地绘制（Canvas 2D）：矩形边框 + 中虚线 + 内描边
  draw(g, t, w, h) {
    g.strokeStyle = '#1f1a17';
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
  },
  // 物理边界：矩形反弹（返回是否碰撞）
  collide(b) {
    const { w, h } = CONFIG.FIELD;
    const r = b.radiusScaled;
    let hit = false;
    if (b.x < r) { b.x = r; b.setAngle(Math.PI - b.angle); hit = true; }
    else if (b.x > w - r) { b.x = w - r; b.setAngle(Math.PI - b.angle); hit = true; }
    if (b.y < r) { b.y = r; b.setAngle(-b.angle); hit = true; }
    else if (b.y > h - r) { b.y = h - r; b.setAngle(-b.angle); hit = true; }
    return hit;
  },
};
