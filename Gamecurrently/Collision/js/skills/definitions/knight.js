import CONFIG from '../../config.js';

// 骑士【斩击】：被动范围近战——每4秒自动向最近的敌球方向挥出扇形斩击
// 斩击：球外延伸90的半透明白色扇形（半圆，面向敌球），瞬时命中40伤
// 命中音效：预加载 + 复用 Audio 实例 + play().catch()（修复自动播放策略导致无声）
// 剑的装饰（腰间佩剑，对局中剑身指向敌球）由 renderer 绘制（b.skill.def.id === 'knight'）
// 冷却型被动：无 effectId → passiveActive 恒 false → 每 cooldown 秒循环触发
let slashAudios = null;
function playSlashSfx() {
  try {
    if (!slashAudios) {
      slashAudios = [
        new Audio('audio/slash1.ogg'),
        new Audio('audio/slash2.ogg'),
      ];
    }
    const a = slashAudios[Math.random() < 0.5 ? 0 : 1];
    a.currentTime = 0;
    a.play().catch(() => { /* 自动播放被拦截时静默 */ });
  } catch { /* 无音频环境（Node 测试等） */ }
}

export default {
  id: 'knight',
  name: '骑士',
  type: 'passive',
  category: '剑与魔法',
  skillName: '斩击',
  desc: '被动【斩击】(每4秒自动)：自动向最近的敌球方向挥出半透明白色扇形斩击（延伸90范围），命中造成40点伤害并播放命中音效；腰间佩剑的剑身始终对准敌球。范围近战，贴身就是输出。',
  color: '#4A4A4A',
  passive: {
    cooldown: CONFIG.KNIGHT.cooldown,
    onTrigger(owner, inst, ctx) {
      const enemy = ctx.getEnemy(owner);
      if (!enemy) return;
      const dir = Math.atan2(enemy.y - owner.y, enemy.x - owner.x);
      const d = Math.hypot(enemy.x - owner.x, enemy.y - owner.y);
      const reach = CONFIG.KNIGHT.range + owner.radiusScaled + enemy.radiusScaled;
      const hit = d <= reach;
      if (hit) {
        enemy.takeDamage(CONFIG.KNIGHT.damage, ctx, owner);
        playSlashSfx();
      }
      // 斩击扇形特效（命中=金色，未命中=白色）
      ctx.events.emit('fx:slash', { x: owner.x, y: owner.y, dir, r: CONFIG.KNIGHT.range, hit });
    }
  }
};
