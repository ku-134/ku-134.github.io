import CONFIG from '../config.js';

// 对局 HUD：HP条/被动条/技能按钮（手机）/冷却条（电脑）
// 被动技能（如巨人暴怒）：平时显示积攒进度，发动后显示剩余持续时间，循环刷新
export class Hud {
  constructor() {
    this.el = {
      p1name: document.getElementById('p1-name'),
      p1hp: document.getElementById('p1-hp'),
      p1passive: document.getElementById('p1-passive'),
      p2name: document.getElementById('p2-name'),
      p2hp: document.getElementById('p2-hp'),
      p2passive: document.getElementById('p2-passive'),
      skillBtn: document.getElementById('skill-btn'),
      sname: document.querySelector('#skill-btn .sname'),
      scd: document.querySelector('#skill-btn .scd'),
      cdBar: document.getElementById('cd-bar'),
      cdName: document.getElementById('cd-name'),
      cdFill: document.getElementById('cd-fill'),
      cdKey: document.getElementById('cd-key'),
    };
    this.balls = null;
    this.isTouch = false;
  }
  bind(balls, { isTouch, key }) {
    this.balls = balls;
    this.isTouch = isTouch;
    const [p1, p2] = balls;
    this.el.p1name.textContent = `你 · ${p1.skill?.def.name ?? '无'}`;
    this.el.p2name.textContent = `AI · ${p2.skill?.def.name ?? '无'}`;
    if (isTouch) {
      this.el.cdBar.classList.add('hidden');
      this.el.skillBtn.classList.remove('hidden');
    } else {
      this.el.skillBtn.classList.add('hidden');
      this.el.cdBar.classList.remove('hidden');
      this.el.cdKey.textContent = key.replace('Key', '');
    }
    this.tick();
  }
  tick() {
    if (!this.balls) return;
    const [p1, p2] = this.balls;
    this.setBar(this.el.p1hp, p1.hp / p1.maxHp);
    this.setBar(this.el.p2hp, p2.hp / p2.maxHp);
    this.setBar(this.el.p1passive, (p1.skill?.state?.anger ?? 0) / CONFIG.GIANT.angerMax);
    this.setBar(this.el.p2passive, (p2.skill?.state?.anger ?? 0) / CONFIG.GIANT.angerMax);
    this.updateSkillUI(p1);
  }
  // 玩家技能按钮/冷却条：主动=冷却；被动=积攒进度 / 发动剩余时间
  updateSkillUI(ball) {
    const s = ball.skill;
    if (!s) return;
    const isPassive = s.def.type === 'passive' || s.def.type === 'both';
    const giantSt = ball.effects.get('giant_form');
    if (this.isTouch) {
      const btn = this.el.skillBtn;
      if (isPassive) {
        this.el.sname.textContent = giantSt ? '巨大化' : s.def.skillName;
        if (giantSt) {
          const left = Math.max(0, Math.ceil(giantSt.duration - giantSt.t));
          this.el.scd.textContent = left + 's';
          btn.classList.add('on-cd');
        } else {
          this.el.scd.textContent = `${s.state.anger ?? 0}/${CONFIG.GIANT.angerMax}`;
          btn.classList.remove('on-cd');
        }
      } else if (s.cd > 0) {
        this.el.sname.textContent = s.def.skillName;
        this.el.scd.textContent = s.cooldownLeft > 0 ? Math.ceil(s.cooldownLeft) : '⚡';
        btn.classList.toggle('on-cd', s.cooldownLeft > 0);
      }
    } else {
      this.el.cdName.textContent = s.def.skillName;
      if (isPassive) {
        const ratio = giantSt
          ? Math.max(0, (giantSt.duration - giantSt.t) / giantSt.duration)
          : (s.state.anger ?? 0) / CONFIG.GIANT.angerMax;
        this.el.cdFill.style.width = (100 * ratio) + '%';
      } else {
        this.el.cdFill.style.width = (100 * (1 - s.cdRatio)) + '%';
      }
    }
  }
  setBar(el, ratio) {
    el.style.width = Math.max(0, Math.min(100, ratio * 100)) + '%';
  }
  showResult(win) {
    const el = document.getElementById('result');
    el.classList.remove('hidden');
    el.innerHTML = win
      ? '<div class="rwin">🎉 胜利！</div><button id="btn-again" class="btn big">再来一局</button><button id="btn-home2" class="btn">返回首页</button>'
      : '<div class="rlose">💥 惜败…</div><button id="btn-again" class="btn big">再来一局</button><button id="btn-home2" class="btn">返回首页</button>';
  }
  hideResult() { document.getElementById('result').classList.add('hidden'); }
  showCountdown(n) {
    const el = document.getElementById('countdown');
    el.classList.remove('hidden');
    el.textContent = n > 0 ? n : 'GO!';
  }
  hideCountdown() { document.getElementById('countdown').classList.add('hidden'); }
}
