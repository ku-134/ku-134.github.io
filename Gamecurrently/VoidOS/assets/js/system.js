/* ============================================================
   VoidOS · 系统层 (assets/js/system.js)
   通知系统 / 组件系统 / 虚空之眼双态 / 终端命令栏 / 图标渲染
   组装 window.VoidOS 全局 API
   ============================================================ */
(function () {
  'use strict';

  var core = window.__voidCore;
  var apps = window.__voidApps;

  var homeEye = document.getElementById('home-eye');
  var terminalArea = document.getElementById('terminal-input-area');
  var terminalInput = document.getElementById('terminal-input');
  var terminalOutput = document.getElementById('terminal-output');

  var componentRegistry = {};
  var componentTick = [];
  var terminalVisible = false;

  /* ============================================================
     1. 通知系统
     ============================================================ */
  function notify(title, body, opts) {
    opts = opts || {};
    var timeout = opts.timeout != null ? opts.timeout : 5000;
    var stack = document.getElementById('notify-stack');
    if (!stack) return null;
    // 通知区：只展示最新一条，清空旧通知
    stack.innerHTML = '';
    stack.classList.add('active');

    var el = document.createElement('div');
    el.className = 'desktop-element notification-bubble notify-slot';
    el.innerHTML =
      '<span class="notify-icon">' + (opts.icon || '✨') + '</span>' +
      '<div class="notify-text"><div class="notify-title">' + core.escapeHtml(title || '通知') + '</div>' +
      '<div class="notify-body">' + core.escapeHtml(body || '') + '</div></div>' +
      '<div class="notify-bar"><i></i></div>';
    stack.appendChild(el);

    // 关闭按钮
    var closeBtn = document.createElement('span');
    closeBtn.className = 'bubble-close';
    closeBtn.textContent = '✕';
    el.appendChild(closeBtn);
    var dismiss = function () {
      if (!el.parentNode) return;
      el.classList.add('bubble-exit');
      setTimeout(function () {
        if (el.parentNode) el.remove();
        if (!stack.querySelector('.notify-slot')) stack.classList.remove('active');
      }, 250);
    };
    closeBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); dismiss(); });

    // 点击通知本体：执行回调并关闭
    el.addEventListener('click', function () {
      if (opts.onClick) opts.onClick();
      dismiss();
    });

    // 进度条（显示倒计时）
    var bar = el.querySelector('.notify-bar i');
    if (bar) {
      bar.style.transition = 'none';
      bar.style.width = '100%';
      requestAnimationFrame(function () {
        bar.style.transition = 'width ' + timeout + 'ms linear';
        bar.style.width = '0%';
      });
    }

    // 超时自动消失
    if (timeout > 0) {
      setTimeout(dismiss, timeout);
    }
    return el;
  }

  /* ============================================================
     2. 组件系统（桌面/应用组件）
     comp: { render(el,data,item), update(el,data,item), destroy(el,data) }
     ============================================================ */
  function registerComponent(type, comp) {
    comp = comp || {};
    comp.type = type;
    componentRegistry[type] = comp;
  }

  // 列出已注册的组件类型
  function getComponents() {
    return Object.keys(componentRegistry).map(function (t) {
      var c = componentRegistry[t];
      return { type: t, name: c.name || t, desc: c.desc || '' };
    });
  }

  // 移除指定类型的所有桌面组件气泡
  function removeComponent(type) {
    core.elements.slice().forEach(function (item) {
      if (item.type === 'component' && item.el && item.el.dataset.compType === type) {
        core.removeElement(item.el);
      }
    });
  }

  function createComponent(type, config) {
    var comp = componentRegistry[type];
    if (!comp) {
      notify('VoidOS', '组件类型 "' + type + '" 未注册', { icon: '⚠️' });
      return null;
    }
    config = config || {};
    var data = core.createElement({
      type: 'component',
      x: config.x, y: config.y, w: config.w || 160, h: config.h || 100,
      data: config.data || {}
    });
    data.el.classList.add('component-bubble');
    data.el.dataset.compType = type;
    if (comp.render) comp.render(data.el, data.data, data);
    if (comp.update) {
      data._update = function () { comp.update(data.el, data.data, data); };
      if (componentTick.indexOf(data) === -1) componentTick.push(data);
    }
    data.onClose = function () {
      var i = componentTick.indexOf(data);
      if (i !== -1) componentTick.splice(i, 1);
      if (comp.destroy) comp.destroy(data.el, data.data);
    };
    return data;
  }

  // 每秒刷新组件
  setInterval(function () {
    componentTick.forEach(function (d) { if (d._update) d._update(); });
  }, 1000);

  /* ---------- 内置组件：时间 / 日历 ---------- */
  registerComponent('time', {
    name: '时间',
    desc: '实时时钟与日期',
    render: function (el, data, item) {
      el.classList.add('time-component');
      el.innerHTML = '<div class="time">--:--:--</div><div class="date">----年--月--日</div>';
      item._timeEl = el.querySelector('.time');
      item._dateEl = el.querySelector('.date');
      updateTime(item);
    },
    update: function (el, data, item) { updateTime(item); }
  });

  function updateTime(item) {
    var now = new Date();
    if (item._timeEl) item._timeEl.textContent = now.toTimeString().slice(0, 8);
    if (item._dateEl) item._dateEl.textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  registerComponent('calendar', {
    name: '日历',
    desc: '当前月份与日期',
    render: function (el, data, item) {
      el.classList.add('calendar-component');
      el.innerHTML = '<div class="month">一月</div><div class="day">1</div>';
      item._mEl = el.querySelector('.month');
      item._dEl = el.querySelector('.day');
      updateCalendar(item);
    },
    update: function (el, data, item) { updateCalendar(item); }
  });

  function updateCalendar(item) {
    var now = new Date();
    if (item._mEl) item._mEl.textContent = now.toLocaleString('zh-CN', { month: 'long' });
    if (item._dEl) item._dEl.textContent = now.getDate();
  }

  /* ============================================================
     3. 虚空之眼（Home 键）双态
     无前台 → 终端命令栏；有前台 → 返回上级/回桌面
     ============================================================ */
  homeEye.addEventListener('click', function (e) {
    e.stopPropagation();
    if (apps.getForeground()) {
      apps.goBack();
    } else {
      toggleTerminal();
    }
  });

  function updateHomeEye() {
    if (apps.getForeground()) homeEye.classList.add('back-mode');
    else homeEye.classList.remove('back-mode');
  }

  /* ============================================================
     4. 终端命令栏
     ============================================================ */
  function toggleTerminal(force) {
    if (force != null) terminalVisible = !!force;
    else terminalVisible = !terminalVisible;
    if (terminalVisible) {
      homeEye.classList.add('shifted');
      terminalArea.classList.add('active');
      terminalInput.disabled = false;
      setTimeout(function () { terminalInput.focus(); }, 60);
    } else {
      homeEye.classList.remove('shifted');
      terminalArea.classList.remove('active');
      terminalInput.disabled = true;
      terminalInput.blur();
    }
  }

  function openTerminal() { toggleTerminal(true); }
  function closeTerminal() { toggleTerminal(false); }

  /* ---------- 命令表 ---------- */
  var commands = {
    help: function () {
      return '可用命令：\n  help         显示帮助\n  apps         列出已注册应用\n  launch <id>  启动应用（加 fullscreen 全屏）\n  close <id>   关闭应用窗口/前台\n  notify <标题>|<内容>  发送通知\n  component <type>  创建组件 (time/calendar)\n  scale <0.3-2> 设置缩放\n  time / date   时间 / 日期\n  clear         清屏\n  about         关于 VoidOS\n  reboot        重启系统\n  exit          关闭终端';
    },
    apps: function () {
      var ids = Object.keys(apps.appRegistry);
      if (!ids.length) return '未注册任何应用';
      return ids.map(function (id) {
        var d = apps.appRegistry[id];
        return '• ' + id + (d.fullscreen ? ' [全屏]' : '') + ' — ' + (d.name || '');
      }).join('\n');
    },
    launch: function (arg) {
      if (!arg) return '用法: launch <id> [fullscreen]';
      var parts = arg.trim().split(/\s+/);
      var id = parts[0];
      if (!apps.appRegistry[id]) return '应用不存在: ' + id;
      apps.launchApp(id, { fullscreen: parts[1] === 'fullscreen' });
      return '启动 ' + id + ' ...';
    },
    close: function (arg) {
      if (!arg) { apps.goBack(); return '已返回'; }
      apps.closeApp(arg.trim());
      return '已关闭 ' + arg.trim();
    },
    notify: function (arg) {
      if (!arg) return '用法: notify <标题>|<内容>';
      var parts = arg.split('|');
      notify(parts[0].trim() || '通知', (parts[1] || '').trim());
      return '通知已发送';
    },
    component: function (arg) {
      if (!arg) return '用法: component <type>  (' + Object.keys(componentRegistry).join('/') + ')';
      var c = createComponent(arg.trim());
      return c ? '组件 ' + arg.trim() + ' 已创建' : '组件类型不存在: ' + arg.trim();
    },
    scale: function (arg) {
      var v = parseFloat(arg);
      if (!v || v < 0.3 || v > 2) return '请输入 0.3 ~ 2.0 之间的数值';
      core.setScale(v);
      return '缩放已设为 ' + Math.round(v * 100) + '%';
    },
    time: function () { return new Date().toTimeString().slice(0, 8); },
    date: function () { return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }); },
    clear: function () { if (terminalOutput) terminalOutput.innerHTML = ''; return null; },
    about: function () { return 'VoidOS · 虚空终端 v0.3\n由 大贤者 & 纳西妲 共同维护\n“每一个气泡都是一个小宇宙”'; },
    reboot: function () { setTimeout(function () { location.reload(); }, 300); return '正在重启...'; },
    exit: function () { closeTerminal(); return null; }
  };

  function runCommand(line) {
    line = (line || '').trim();
    if (!line) return;
    var first = line.split(/\s+/)[0].toLowerCase();
    var rest = line.slice(first.length).trim();
    var fn = commands[first];
    var result;
    if (fn) {
      result = fn(rest);
    } else {
      result = '未知命令: ' + first + '  (输入 help 查看可用命令)';
    }
    if (result != null) printTerminal(line, result);
  }

  function printTerminal(cmd, out) {
    if (!terminalOutput) return;
    var c = document.createElement('div');
    c.className = 'term-cmd';
    c.textContent = '❯ ' + cmd;
    var o = document.createElement('div');
    o.className = 'term-out';
    o.textContent = out;
    terminalOutput.appendChild(c);
    terminalOutput.appendChild(o);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  if (terminalInput) {
    terminalInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var line = terminalInput.value;
        terminalInput.value = '';
        runCommand(line);
      } else if (e.key === 'Escape') {
        closeTerminal();
      }
    });
  }

  /* ============================================================
     5. 应用图标渲染（由 loader 调用）
     ============================================================ */
  function renderAppIcons() {
    // 移除旧的应用图标元素
    core.elements.slice().forEach(function (item) {
      if (item.type === 'app' && item.el && item.el.parentNode) {
        var idx = core.elements.indexOf(item);
        if (idx !== -1) { core.elements.splice(idx, 1); item.el.remove(); }
      }
    });
    // 读取"展示桌面应用"设置（默认 true；系统设置始终展示）
    var showApps = true;
    try {
      var sv = JSON.parse(localStorage.getItem('voidos.showapps'));
      if (sv === false) showApps = false;
    } catch (e) {}
    var ids = Object.keys(apps.appRegistry);
    if (!showApps) {
      ids = ids.filter(function (id) { return id === 'setting'; });
    }
    // 布局：从组件底部下方开始排图标，避免重叠
    var startY = 24;
    core.elements.forEach(function (item) {
      if (item.type === 'component' && item.el && item.el.parentNode) {
        var bottom = (item.y || 0) + (item.h || 100);
        if (bottom > startY) startY = bottom;
      }
    });
    startY += 24;
    var perRow = window.innerWidth < 480 ? 4 : (window.innerWidth < 900 ? 6 : 8);
    var startX = 24;
    var cell = window.innerWidth < 480 ? 84 : 92;
    ids.forEach(function (id, i) {
      var def = apps.appRegistry[id];
      var col = i % perRow;
      var row = Math.floor(i / perRow);
      var data = core.createElement({
        type: 'app',
        x: startX + col * cell,
        y: startY + row * cell,
        w: 76, h: 84,
        appId: id,
        closable: false
      });
      var el = data.el;
      el.classList.add('app-icon');
      el.innerHTML = '<span class="icon">' + (def.icon || '📱') + '</span><span class="label">' + core.escapeHtml(def.name || id) + '</span>';
      data.onClick = function () { apps.launchApp(id); };
    });
  }

  /* ============================================================
     6. 组装全局 API
     ============================================================ */
  window.VoidOS = {
    version: '0.3',
    registerApp: apps.registerApp,
    launchApp: apps.launchApp,
    closeApp: apps.closeApp,
    goBack: apps.goBack,
    getForeground: apps.getForeground,
    getApps: function () {
      return Object.keys(apps.appRegistry).map(function (id) {
        var d = apps.appRegistry[id];
        return { id: id, name: d.name, icon: d.icon, fullscreen: !!d.fullscreen };
      });
    },
    createNotification: notify,
    notify: notify,
    registerComponent: registerComponent,
    createComponent: createComponent,
    getComponents: getComponents,
    removeComponent: removeComponent,
    renderAppIcons: renderAppIcons,
    openTerminal: openTerminal,
    closeTerminal: closeTerminal,
    toggleTerminal: toggleTerminal,
    runCommand: runCommand,
    scale: core.scale,
    setScale: core.setScale,
    elements: core.elements
  };

  // 兼容旧 API
  window.createNotification = notify;
  window.__void = window.VoidOS;
  window.__voidSystem = {
    updateHomeEye: updateHomeEye,
    notify: notify,
    registerComponent: registerComponent,
    createComponent: createComponent,
    renderAppIcons: renderAppIcons,
    toggleTerminal: toggleTerminal,
    runCommand: runCommand
  };

  console.log('🟢 VoidOS 系统层就绪 (v0.3)');
})();