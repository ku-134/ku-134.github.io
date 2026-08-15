// 球图标生成：卡片/图鉴/轮播用——球体 + 职业装饰（复用对战绘制逻辑）
import { drawBallDeco } from '../rendering/renderer.js';

const cache = new Map();

// 生成职业球图标 dataURL（含装饰：魔王角/骑士剑/法师胡须/牧师十字架）
export function ballIconDataURL(def, size = 64) {
  const key = def.id + '_' + size;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const r = size * 0.30;
  const x = size / 2, y = size / 2;
  // 球体：填充 + 高光 + 描边
  g.fillStyle = def.color;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1f1a17';
  g.lineWidth = Math.max(2, size * 0.04);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  // 职业装饰（骑士图标里剑固定斜 45°）
  drawBallDeco(g, x, y, r, def.id, -Math.PI / 4);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
