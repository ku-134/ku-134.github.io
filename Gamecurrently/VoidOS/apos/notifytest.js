/* ============================================================
   VoidOS · 通知测试 (apos/notifytest.js)
   循环通知测试：输入信息 + 循环频率 + 开启开关
   用于验证桌面通知系统
   ============================================================ */
(function () {
  'use strict';
  var V = window.VoidOS;
  var KEY = 'voidos.notifytest';
  var timer = null;
  var count = 0;
  var currentCfg = null;

  V.registerApp('notifytest', {
    name: '通知测试',
    icon: '🔔',
    fullscreen: true,

    fullscreen: function (stage, api) {
      render(stage, api);
    },

    onClose: function () {
      // 循环在后台继续执行，脱离应用前台（重新打开应用可关闭开关停止）
    }
  });

  function loadCfg() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY));
      if (c && typeof c === 'object') return c;
    } catch (e) {}
    return { title: '通知测试', body: '来自虚空的循环消息', sec: 5, on: false };
  }

  function saveCfg(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
  }

  function render(stage, api) {
    stage.innerHTML = '';
    var cfg = loadCfg();
    // 若循环已在后台运行，开关状态同步为开启
    if (isLoopActive()) cfg.on = true;
    saveCfg(cfg);
    currentCfg = cfg;

    var page = document.createElement('div');
    page.className = 'fg-page';

    page.appendChild(makeInputRow('通知标题', cfg.title, function (v) { cfg.title = v; saveCfg(cfg); }));
    page.appendChild(makeInputRow('通知内容', cfg.body, function (v) { cfg.body = v; saveCfg(cfg); }));
    page.appendChild(makeFreqRow(cfg, api));
    page.appendChild(makeSwitchRow(cfg, api));

    var status = document.createElement('div');
    status.className = 'void-hint';
    status.id = 'notify-status';
    status.textContent = isLoopActive() ? '循环进行中…（后台运行中）' : '已停止';
    page.appendChild(status);

    stage.appendChild(page);
    api.setTitle('🔔 通知测试');

    // 若配置为开启且循环未运行（如页面刷新后），自动恢复后台循环
    if (cfg.on && !isLoopActive()) {
      startLoop(cfg, api);
      updateStatus();
    }
  }

  function makeInputRow(label, value, onChange) {
    var row = document.createElement('div');
    row.className = 'void-row';
    row.innerHTML = '<span class="void-row-label">' + label + '</span>';
    var input = document.createElement('input');
    input.className = 'void-input';
    input.type = 'text';
    input.value = value;
    input.addEventListener('input', function () { onChange(input.value); });
    row.appendChild(input);
    return row;
  }

  function makeFreqRow(cfg, api) {
    var row = document.createElement('div');
    row.className = 'void-row';
    row.innerHTML = '<span class="void-row-label">循环频率 (秒)</span>';
    var input = document.createElement('input');
    input.className = 'void-input num';
    input.type = 'number';
    input.min = 1;
    input.max = 3600;
    input.value = cfg.sec;
    input.addEventListener('change', function () {
      var v = parseInt(input.value, 10);
      if (!v || v < 1) v = 5;
      input.value = v;
      cfg.sec = v;
      saveCfg(cfg);
      if (cfg.on) startLoop(cfg, api);
    });
    row.appendChild(input);
    return row;
  }

  function makeSwitchRow(cfg, api) {
    var row = document.createElement('label');
    row.className = 'void-row';
    row.innerHTML = '<span class="void-row-info"><span class="void-row-label">开启循环</span>' +
      '<span class="void-row-desc">每 ' + cfg.sec + ' 秒发送一条通知</span></span>' +
      '<span class="void-switch"><input type="checkbox"' + (cfg.on ? ' checked' : '') + '>' +
      '<span class="track"></span></span>';
    var input = row.querySelector('input');
    input.addEventListener('change', function () {
      cfg.on = input.checked;
      saveCfg(cfg);
      updateStatus();
      if (cfg.on) startLoop(cfg, api);
      else stopLoop();
    });
    return row;
  }

  function updateStatus() {
    var s = document.getElementById('notify-status');
    if (s) s.textContent = isLoopActive() ? '循环进行中…（后台运行中）' : '已停止';
  }

  function isLoopActive() {
    return timer != null;
  }

  function startLoop(cfg, api) {
    stopLoop();
    count = 0;
    var fire = function () {
      count++;
      V.notify(cfg.title || '通知测试', '第 ' + count + ' 条：' + (cfg.body || '来自虚空的循环消息'), { icon: '🔔' });
    };
    fire();
    timer = setInterval(fire, Math.max(1, cfg.sec || 5) * 1000);
  }

  function stopLoop() {
    if (timer) { clearInterval(timer); timer = null; }
  }
})();