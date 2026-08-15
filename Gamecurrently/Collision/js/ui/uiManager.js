import { bindTap } from './input.js';

// 页面管理：屏幕（全屏切换）与面板（弹窗/滑入）
// ★ 新增战场/面板必须在这里注册，否则切换时残留可见导致重叠
export class UIManager {
  constructor() {
    this.screens = {};
    ['home', 'select', 'battle', 'online', 'game', 'game-online'].forEach(id => {
      this.screens[id] = document.getElementById('screen-' + id);
    });
    this.panels = {};
    ['start', 'bestiary', 'settings'].forEach(id => {
      this.panels[id] = document.getElementById('panel-' + id);
    });
    this.bindBack();
  }
  show(id) {
    if (this.screens[id]) {
      // 切换屏幕：其他屏幕显式隐藏，目标屏幕移除 hidden + 激活
      Object.values(this.screens).forEach(el => {
        el.classList.remove('active');
        if (el !== this.screens[id]) el.classList.add('hidden');
      });
      this.hidePanels();
      const el = this.screens[id];
      el.classList.remove('hidden');
      el.classList.add('active');
    } else if (this.panels[id]) {
      // 面板/弹窗显示时：背景统一切回首页（防止残留联机等界面）
      const home = this.screens['home'];
      Object.values(this.screens).forEach(el => {
        el.classList.remove('active');
        if (el !== home) el.classList.add('hidden');
      });
      if (home) { home.classList.remove('hidden'); home.classList.add('active'); }
      this.hidePanels();
      const el = this.panels[id];
      el.classList.remove('hidden');
      requestAnimationFrame(() => el.classList.add('show'));
    }
  }
  hidePanels() {
    Object.values(this.panels).forEach(el => { el.classList.remove('show'); el.classList.add('hidden'); });
  }
  bindBack() {
    document.querySelectorAll('[data-back]').forEach(btn => {
      bindTap(btn, () => {
        this.show(btn.dataset.back.replace(/^(screen|panel)-/, ''));
      });
    });
  }
}
