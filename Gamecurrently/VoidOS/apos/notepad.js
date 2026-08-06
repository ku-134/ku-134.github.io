/* ============================================================
   VoidOS · 记事本 (apos/notepad.js)
   窗口模式应用示例：气泡窗口 + 本地存储
   ============================================================ */
(function () {
  'use strict';
  var V = window.VoidOS;

  V.registerApp('notepad', {
    name: '记事本',
    icon: '📝',
    mount: function (body, api) {
      var saved = api.storage.get('note') || '';
      body.classList.add('notepad-body');
      body.innerHTML = '' +
        '<textarea class="notepad-textarea" placeholder="写下一点什么…">' + saved + '</textarea>' +
        '<div class="notepad-bar">' +
        '<button class="void-btn" data-act="save">保存</button>' +
        '<button class="void-btn" data-act="clear">清空</button>' +
        '</div>';

      var ta = body.querySelector('.notepad-textarea');
      body.querySelector('[data-act="save"]').addEventListener('click', function () {
        api.storage.set('note', ta.value);
        api.notify('记事本', '已保存到虚空存储器');
      });
      body.querySelector('[data-act="clear"]').addEventListener('click', function () {
        ta.value = '';
        api.storage.set('note', '');
        api.notify('记事本', '已清空');
      });
    }
  });
})();