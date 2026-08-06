/* ============================================================
   VoidOS · 系统设置 (apos/setting.js)
   全屏前台应用示例：设置主页 + 关于子页（视图栈返回上级）
   ============================================================ */
(function () {
  'use strict';
  var V = window.VoidOS;

  V.registerApp('setting', {
    name: '系统设置',
    icon: '⚙️',
    fullscreen: function (stage, api) {
      renderHome(stage, api);
    },

    onClose: function (api) {
      api.notify('系统设置', '设置已关闭');
    }
  });

  function renderHome(stage, api) {
    stage.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'fg-page';

    var items = [
      { label: '系统信息', desc: 'VoidOS · 虚空终端 v0.3', fn: function () { api.notify('系统信息', 'VoidOS v0.3 · 由大贤者与纳西妲共同维护'); } },
      { label: '关于 VoidOS', desc: '查看版本与致谢', fn: function () { showAbout(stage, api); } },
      { label: '缩放测试', desc: '发送一条通知试试', fn: function () { api.notify('缩放提示', '滚轮或双指缩放桌面 (0.3x - 2.0x)'); } },
      { label: '清空终端', desc: '运行 clear 命令', fn: function () { V.runCommand('clear'); } }
    ];

    items.forEach(function (it) {
      var row = document.createElement('button');
      row.className = 'fg-item';
      row.innerHTML = '<span class="fg-item-label">' + it.label + '</span><span class="fg-item-desc">' + it.desc + '</span>';
      row.addEventListener('click', function () { it.fn(); });
      box.appendChild(row);
    });

    stage.appendChild(box);
    api.setTitle('⚙️ 系统设置');
  }

  // 子页：关于（演示视图栈返回）
  function showAbout(stage, api) {
    api.pushView({
      title: '关于 VoidOS',
      html: '<div class="fg-page fg-center">' +
        '<div class="about-logo">👁️</div>' +
        '<div class="about-title">VoidOS · 虚空终端</div>' +
        '<div class="about-ver">v0.3</div>' +
        '<div class="about-desc">桌面即引擎，气泡即宇宙。<br>虚空之眼连接着终端与世界树。</div>' +
        '</div>',
      mount: function (s) {
        // 子页挂载后无需额外逻辑
        void s;
      }
    });
  }
})();