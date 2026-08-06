/* ============================================================
   VoidOS · 加载器 (assets/js/loader.js)
   初始化桌面组件 / 读取 Desktop-Process.txt 加载应用 / 入场过渡
   ============================================================ */
(function () {
  'use strict';

  var core = window.__voidCore;
  var sys = window.__voidSystem;

  /* ---------- 初始桌面组件：按组件中心状态加载 ---------- */
  function loadComponentState() {
    try {
      var s = JSON.parse(localStorage.getItem('voidos.components.state'));
      if (s && typeof s === 'object') return s;
    } catch (e) {}
    return {};
  }

  function defaultPos(type) {
    var W = window.innerWidth;
    if (type === 'time') return { x: 30, y: 40, w: 170, h: 92 };
    if (type === 'calendar') {
      var cx = Math.max(30, W - 190);
      // 窄屏：与时间组件重叠时，放到时间下方
      if (cx < 30 + 170 + 12) {
        return { x: 30, y: 40 + 92 + 16, w: 130, h: 108 };
      }
      return { x: cx, y: 40, w: 130, h: 108 };
    }
    return { x: 30, y: 200, w: 160, h: 100 };
  }

  function initWidgets() {
    var state = loadComponentState();
    ['time', 'calendar'].forEach(function (type) {
      if (state[type] !== false) {
        sys.createComponent(type, defaultPos(type));
      }
    });
  }

  // 动态加载应用脚本（script 标签，相对路径基于文档 URL → apos/ 目录）
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('加载失败: ' + src)); };
      document.head.appendChild(s);
    });
  }

  /* ---------- 加载应用（从 Desktop-Process.txt） ---------- */
  async function loadApps() {
    try {
      var response = await fetch('Desktop-Process.txt?t=' + Date.now());
      var text = await response.text();
      var lines = text.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
      for (var i = 0; i < lines.length; i++) {
        var fileName = lines[i];
        try {
          await loadScript('apos/' + fileName + '?t=' + Date.now());
          console.log('✅ 应用加载成功: ' + fileName);
        } catch (err) {
          console.error('❌ 加载应用失败 ' + fileName + ':', err);
        }
      }
    } catch (err) {
      console.warn('无法读取 Desktop-Process.txt:', err);
    }
    sys.renderAppIcons();
  }

  /* ---------- 入场过渡（黑屏亮起） ---------- */
  function entrance() {
    var overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:99999;background:#000;',
      'transition:opacity 1.2s ease;pointer-events:none;opacity:1;'
    ].join('');
    document.body.appendChild(overlay);

    initWidgets();
    loadApps();

    setTimeout(function () { sys.notify('系统提示', '欢迎来到虚空桌面', { icon: '🕳️' }); }, 2500);
    setTimeout(function () { sys.notify('来自世界树', '神经链接已建立', { icon: '🌳' }); }, 8000);

    requestAnimationFrame(function () { overlay.style.opacity = '0'; });
    setTimeout(function () { overlay.remove(); }, 1400);

    console.log('💡 长按桌面元素可拖动，滚轮/双指缩放');
    console.log('💡 虚空之眼：无前台时打开终端；有前台时返回');
    console.log('💡 API: VoidOS.notify / launchApp / createComponent');
  }

  if (document.readyState === 'complete') entrance();
  else window.addEventListener('load', entrance);
})();