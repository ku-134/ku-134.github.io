/* ============================================================
   VoidOS · 应用系统 (assets/js/apps.js)
   应用注册 / 启动 / 窗口模式 / 全屏前台模式 / 视图返回栈 / 应用SDK
   ============================================================ */
(function () {
  'use strict';

  var core = window.__voidCore;
  var desktop = document.getElementById('desktop');
  var appRegistry = {};
  var foreground = null;        // 当前前台应用 {id, def, root, stage, backBtn}
  var foregroundStack = [];     // 前台应用内视图栈（返回上级）

  /* ============================================================
     注册应用
     def: { id, name, icon, fullscreen?:bool,
            mount?(body, api)        窗口模式挂载
            fullscreen?(stage, api)  全屏前台模式
            onOpen?(api) / onClose?(api) }
     ============================================================ */
  function registerApp(id, def) {
    def = def || {};
    def.id = id;
    appRegistry[id] = def;
    return def;
  }

  function getApp(id) { return appRegistry[id] || null; }

  /* ============================================================
     启动应用
     launchApp(id, { fullscreen }) 
     全屏条件：显式要求 / 应用声明 fullscreen / 未实现 mount
     ============================================================ */
  function launchApp(id, opts) {
    var def = appRegistry[id];
    if (!def) {
      window.VoidOS && window.VoidOS.notify ? window.VoidOS.notify('VoidOS', '应用 "' + id + '" 未注册', { icon: '⚠️' }) : alert('应用未注册: ' + id);
      return null;
    }
    opts = opts || {};
    if (opts.fullscreen || def.fullscreen || typeof def.mount !== 'function') {
      return openForeground(id);
    }
    return openWindow(id, def, opts);
  }

  /* ---------- 窗口模式：应用气泡窗口 ---------- */
  function openWindow(id, def, opts) {
    var w = opts.w || 320;
    var h = opts.h || 240;
    var data = core.createElement({
      type: 'app-window',
      appId: id,
      x: opts.x, y: opts.y, w: w, h: h,
      closable: true
    });
    var el = data.el;
    el.classList.add('app-window');
    el.innerHTML = '';
    // 标题栏
    var bar = document.createElement('div');
    bar.className = 'app-window-bar';
    bar.innerHTML = '<span class="app-window-dot"></span><span class="app-window-title">' +
      (def.icon || '') + ' ' + core.escapeHtml(def.name || id) + '</span>';
    el.appendChild(bar);
    // 窗口体
    var body = document.createElement('div');
    body.className = 'app-window-body';
    el.appendChild(body);

    var api = makeAppApi(id, def, { window: true, root: el, body: body });
    if (def.mount) def.mount(body, api);
    if (def.onOpen) def.onOpen(api);
    data.onClose = function () { if (def.onClose) def.onClose(api); };
    return api;
  }

  /* ---------- 全屏前台模式 ---------- */
  function openForeground(id) {
    var def = appRegistry[id];
    if (!def) return null;
    if (foreground) closeForeground();

    var root = document.createElement('div');
    root.className = 'app-foreground';
    root.style.zIndex = '9000';
    // 顶栏：返回按钮 + 标题
    var bar = document.createElement('div');
    bar.className = 'app-fg-bar';
    var backBtn = document.createElement('button');
    backBtn.className = 'app-fg-back';
    backBtn.textContent = '←';
    backBtn.title = '返回（也可点虚空之眼）';
    var title = document.createElement('span');
    title.className = 'app-fg-title';
    title.textContent = (def.icon ? def.icon + ' ' : '') + (def.name || id);
    bar.appendChild(backBtn);
    bar.appendChild(title);
    root.appendChild(bar);

    var stage = document.createElement('div');
    stage.className = 'app-fg-stage';
    root.appendChild(stage);

    desktop.appendChild(root);

    foreground = { id: id, def: def, root: root, stage: stage, backBtn: backBtn };
    foregroundStack = [];

    backBtn.addEventListener('click', function () { goBack(); });
    // 前台应用内部点击不冒泡到桌面
    root.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    var api = makeAppApi(id, def, { fullscreen: true, root: root, stage: stage });
    if (def.fullscreen) def.fullscreen(stage, api);
    else if (def.mount) def.mount(stage, api);
    if (def.onOpen) def.onOpen(api);

    if (window.__voidSystem) window.__voidSystem.updateHomeEye();
    return api;
  }

  /* ---------- 返回：先退视图栈，再关前台 ---------- */
  function goBack() {
    if (!foreground) return false;
    if (foregroundStack.length > 0) {
      var prev = foregroundStack.pop();
      renderView(prev);
      return true;
    }
    closeForeground();
    return true;
  }

  function closeForeground() {
    if (!foreground) return;
    var def = foreground.def;
    if (def.onClose) def.onClose(makeAppApi(foreground.id, def, { fullscreen: true, root: foreground.root }));
    foreground.root.remove();
    foreground = null;
    foregroundStack = [];
    if (window.__voidSystem) window.__voidSystem.updateHomeEye();
  }

  function closeApp(id) {
    if (foreground && foreground.id === id) closeForeground();
    core.elements.forEach(function (item) {
      if (item.appId === id && item.type === 'app-window') core.removeElement(item.el);
    });
  }

  function getForeground() {
    return foreground ? { id: foreground.id, name: foreground.def.name } : null;
  }

  /* ---------- 视图栈（应用内多页面：返回上级） ---------- */
  function pushView(view) {
    if (!foreground) return false;
    foregroundStack.push({ html: view.html || '', title: view.title || foreground.def.name, mount: view.mount });
    renderView(foregroundStack[foregroundStack.length - 1]);
    return true;
  }

  function renderView(view) {
    if (!foreground) return;
    foreground.stage.innerHTML = '';
    var titleEl = foreground.root.querySelector('.app-fg-title');
    if (titleEl && view.title) titleEl.textContent = (foreground.def.icon ? foreground.def.icon + ' ' : '') + view.title;
    if (view.html) {
      var div = document.createElement('div');
      div.innerHTML = view.html;
      foreground.stage.appendChild(div);
    }
    if (view.mount) view.mount(foreground.stage, makeAppApi(foreground.id, foreground.def, { fullscreen: true, root: foreground.root, stage: foreground.stage }));
  }

  /* ---------- 应用 SDK ---------- */
  function makeAppApi(id, def, ctx) {
    return {
      id: id,
      name: def.name || id,
      ctx: ctx,
      notify: function (title, body, opts) { return window.VoidOS.notify(title, body, opts); },
      close: function () { closeApp(id); },
      back: goBack,
      pushView: function (view) {
        if (ctx.fullscreen) return pushView(view);
        window.VoidOS.notify('VoidOS', '视图栈仅在全屏应用可用');
        return false;
      },
      setTitle: function (t) {
        if (!foreground || foreground.id !== id) return;
        var titleEl = foreground.root.querySelector('.app-fg-title');
        if (titleEl) titleEl.textContent = t;
      },
      storage: {
        get: function (k) { try { return JSON.parse(localStorage.getItem('voidos.' + id + '.' + k)); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem('voidos.' + id + '.' + k, JSON.stringify(v)); } catch (e) {} }
      }
    };
  }

  /* ---------- 暴露 ---------- */
  window.__voidApps = {
    appRegistry: appRegistry,
    registerApp: registerApp,
    getApp: getApp,
    launchApp: launchApp,
    closeApp: closeApp,
    goBack: goBack,
    closeForeground: closeForeground,
    getForeground: getForeground,
    pushView: pushView,
    renderView: renderView
  };
})();