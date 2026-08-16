import CONFIG from '../config.js';
import { rand, angleTo, normAngle } from '../core/math.js';
// AI 对手：随机游走 + 主动技能智能释放（瞄准带随机偏差）
// setBall：意识转移（死灵术士）后切换 AI 控制的当前球
export class AIController {
  constructor(ball, ctx, { skillChance = CONFIG.AI.skillChance } = {}) {
    this.ball = ball;
    this.ctx = ctx;
    this.skillChance = skillChance;
    this.thinkTimer = rand(...CONFIG.AI.thinkInterval);
  }
  setBall(ball) { this.ball = ball; this.thinkTimer = 0; }
  update(dt) {
    this.thinkTimer -= dt;
    if (this.thinkTimer > 0) return;
    this.thinkTimer = rand(...CONFIG.AI.thinkInterval);
    const skill = this.ball.skill;
    if (!skill || !skill.canUse()) return;
    if (Math.random() > this.skillChance) return;
    const enemy = this.ctx.getEnemy(this.ball);
    if (!enemy) return;
    const dir = normAngle(angleTo(this.ball.x, this.ball.y, enemy.x, enemy.y)
      + rand(-CONFIG.AI.aimJitter, CONFIG.AI.aimJitter));
    skill.forceUse(dir);
  }
}
