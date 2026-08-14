import { bindTap } from './input.js';

// 页面管理：屏幕（全屏切换）与面板（滑入滑出）
export class UIManager {
  constructor() {
    this.screens = {};
    ['home', 'select', 'online', 'game'].forEach(id => {
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
      Object.values(this.screens).forEach(el => el.classList.remove('active'));
      this.hidePanels();
      this.screens[id].classList.add('active');
    } else if (this.panels[id]) {
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
