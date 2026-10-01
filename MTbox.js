/* ============================================================
 * MTbox.js — 工具页（MT.html）数据层与展示层
 * 职责：解析 tool/index.txt 新格式、分类、收藏、三种展示模式、
 *       分类过滤弹窗、卡片渲染。MT.html 只保留极简挂载逻辑。
 *
 * index.txt 新格式：
 *   ## 分类名 | 分类说明
 *   - 图标 文件名 | 工具名 | 简介 | 热度
 * ============================================================ */
(function () {
    'use strict';

    var API_INDEX = 'tool/index.txt';
    var LSK = {
        favs: 'toolFavs',          // 收藏
        mode: 'toolViewMode',      // 展示模式 0=瀑布 1=时间线 2=分类
        filter: 'toolFilterCat'    // 分类过滤
    };
    var MODES = [
        { key: 'waterfall', icon: '🌊', label: '瀑布式' },
        { key: 'timeline', icon: '⏱️', label: '时间线' },
        { key: 'category', icon: '🗂️', label: '分类' }
    ];

    var state = {
        cats: [],        // [{ name, desc, tools: [] }]
        tools: [],       // 全部工具（扁平）
        favSet: new Set(),
        mode: 0,
        filterCat: '',
        keyword: ''
    };

    /* ---------- 工具函数 ---------- */
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function $(id) { return document.getElementById(id); }
    function lsGet(k, dv) { try { var v = localStorage.getItem(k); return v === null ? dv : v; } catch (e) { return dv; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

    /* ---------- 解析 index.txt 新格式 ---------- */
    function parseIndex(text) {
        var cats = [], cur = null;
        text.split(/\r?\n/).forEach(function (raw) {
            var line = raw.trim();
            if (!line) return;
            if (line.indexOf('## ') === 0) {
                var head = line.slice(3).split('|');
                cur = { name: (head[0] || '').trim(), desc: (head[1] || '').trim(), tools: [] };
                cats.push(cur);
                return;
            }
            if (line.indexOf('- ') !== 0) return;
            var parts = line.slice(2).split('|').map(function (s) { return s.trim(); });
            // - 图标 文件名 | 工具名 | 简介 | 热度
            var filePart = parts[0] || '';
            var icon = '', file = filePart;
            try {
                var em = filePart.match(/^(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)\s+/u);
                if (em) { icon = em[1]; file = filePart.slice(em[0].length).trim(); }
            } catch (e) { }
            var tool = {
                file: file,
                name: parts[1] || file.replace(/\.html?$/i, ''),
                brief: parts[2] || '',
                heat: parseInt(parts[3], 10) || 0,
                icon: icon || '📦',
                cat: cur ? cur.name : '📦 其他工具'
            };
            if (cur) cur.tools.push(tool); else { /* 无分类头则丢弃，避免脏数据 */ }
        });
        state.cats = cats;
        state.tools = [];
        cats.forEach(function (c) { c.tools.forEach(function (t) { state.tools.push(t); }); });
    }

    /* ---------- 卡片 HTML ---------- */
    function cardHTML(t) {
        var isFav = state.favSet.has(t.file);
        var fl = esc(t.file);
        return '<div class="tool-item" data-file="' + fl + '">' +
            '<div class="t-head">' +
                '<div class="t-icon">' + t.icon + '</div>' +
                '<div class="t-name">' + esc(t.name) + '</div>' +
            '</div>' +
            '<div class="t-desc">' + esc(t.brief) + '</div>' +
            '<div class="t-foot">' +
                '<button class="t-fav' + (isFav ? ' on' : '') + '" data-fav="' + fl + '" title="' + (isFav ? '取消收藏' : '收藏工具') + '">' +
                    (isFav ? '⭐ 已收藏' : '☆ 收藏') + '</button>' +
                '<span class="t-go">使用 →</span>' +
            '</div>' +
        '</div>';
    }

    /* ---------- 匹配（搜索 + 分类过滤） ---------- */
    function match(t) {
        if (state.filterCat && t.cat !== state.filterCat) return false;
        if (!state.keyword) return true;
        return (t.name + ' ' + t.file + ' ' + t.brief + ' ' + t.cat).toLowerCase().indexOf(state.keyword) >= 0;
    }

    /* ---------- 渲染 ---------- */
    function render() {
        var list = state.tools.filter(match);
        var box = $('mtBody');
        var favHits = list.filter(function (t) { return state.favSet.has(t.file); });

        /* 收藏区（复用同一套卡片） */
        var favSec = $('favSec');
        if (favHits.length) {
            favSec.style.display = '';
            $('favNum').textContent = favHits.length;
            $('favGrid').innerHTML = favHits.map(cardHTML).join('');
        } else {
            favSec.style.display = 'none';
        }

        if (!list.length) {
            box.innerHTML = '<div class="tool-empty">🌫️ 没有找到相关工具</div>';
        } else if (state.mode === 0) {
            /* 瀑布式：单列流式（自适应多列），全部平铺 */
            box.className = 'mt-view mt-waterfall';
            box.innerHTML = list.map(cardHTML).join('');
        } else if (state.mode === 1) {
            /* 时间线：按热度降序，带排名轴线 */
            var sorted = list.slice().sort(function (a, b) { return b.heat - a.heat; });
            box.className = 'mt-view mt-timeline';
            box.innerHTML = sorted.map(function (t, i) {
                var isFav = state.favSet.has(t.file);
                var fl = esc(t.file);
                return '<div class="mt-line">' +
                    '<div class="mt-rank">' + (i + 1) + '</div>' +
                    '<div class="mt-node"></div>' +
                    '<div class="tool-item" data-file="' + fl + '">' +
                        '<div class="t-head">' +
                            '<div class="t-icon">' + t.icon + '</div>' +
                            '<div class="t-name">' + esc(t.name) + '</div>' +
                            '<span class="mt-heat">🔥 ' + t.heat + '</span>' +
                        '</div>' +
                        '<div class="t-desc">' + esc(t.brief) + '</div>' +
                        '<div class="t-foot">' +
                            '<button class="t-fav' + (isFav ? ' on' : '') + '" data-fav="' + fl + '" title="' + (isFav ? '取消收藏' : '收藏工具') + '">' + (isFav ? '⭐ 已收藏' : '☆ 收藏') + '</button>' +
                            '<span class="t-go">使用 →</span>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        } else {
            /* 分类：按分类分组，点击展开收起 */
            box.className = 'mt-view mt-cat';
            var closed = getClosed();
            box.innerHTML = state.cats.map(function (c) {
                var inCat = c.tools.filter(match);
                if (!inCat.length) return '';
                var isClosed = !!closed[c.name] && !state.keyword;
                return '<div class="mt-catbox' + (isClosed ? ' closed' : '') + '" data-catbox="' + esc(c.name) + '">' +
                    '<div class="tool-sec-title" data-sec="cat" data-key="' + esc(c.name) + '">' +
                        '<span class="arrow">▾</span>' +
                        '<span class="sec-name">' + esc(c.name) +
                            (c.desc ? ' <span style="font-weight:400;opacity:.5;font-size:.82rem;">· ' + esc(c.desc) + '</span>' : '') +
                        '</span>' +
                        '<span class="sec-num">' + inCat.length + '</span>' +
                    '</div>' +
                    '<div class="tool-grid">' + inCat.map(cardHTML).join('') + '</div>' +
                '</div>';
            }).join('');
        }

        /* 计数 */
        var info = '共 ' + list.length + ' 个工具';
        if (state.filterCat) info += ' · 已筛选「' + state.filterCat + '」';
        else info += ' · ' + state.cats.length + ' 个分类';
        $('toolCount').textContent = info;

        syncModeBtn();
        syncFilterBtn();
    }

    function getClosed() { try { return JSON.parse(lsGet('toolCatClosed', '{}')); } catch (e) { return {}; } }

    /* ---------- 展示模式切换 ---------- */
    function syncModeBtn() {
        var m = MODES[state.mode];
        $('modeBtn').textContent = m.icon + ' ' + m.label;
        $('modeBtn').title = '当前：' + m.label + '（点击切换）';
    }
    function cycleMode() {
        state.mode = (state.mode + 1) % MODES.length;
        lsSet(LSK.mode, String(state.mode));
        render();
    }

    /* ---------- 分类过滤 ---------- */
    function syncFilterBtn() {
        var b = $('filterBtn');
        if (state.filterCat) {
            b.textContent = '🚫 已过滤';
            b.classList.add('filtering');
            b.title = '正在只看「' + state.filterCat + '」，点击取消过滤';
        } else {
            b.textContent = '🗂️ 打开分类';
            b.classList.remove('filtering');
            b.title = '选择只看某个分类';
        }
    }
    function openFilterModal() {
        if (state.filterCat) { state.filterCat = ''; lsSet(LSK.filter, ''); render(); return; }
        var cur = state.filterCat;
        var html = '<div class="ap-grid">' +
            '<div class="ap-item' + (!cur ? ' on' : '') + '" data-cat=""><span class="ap-thumb">🌐</span><span class="ap-name">全部工具</span><span class="sec-num">' + state.tools.length + '</span></div>' +
            state.cats.map(function (c) {
                if (!c.tools.length) return '';
                return '<div class="ap-item' + (cur === c.name ? ' on' : '') + '" data-cat="' + esc(c.name) + '">' +
                    '<span class="ap-thumb">🗂️</span>' +
                    '<span class="ap-name">' + esc(c.name) + (c.desc ? ' <span style="opacity:.5;font-size:.78rem;">· ' + esc(c.desc) + '</span>' : '') + '</span>' +
                    '<span class="sec-num">' + c.tools.length + '</span></div>';
            }).join('') +
            '</div>';
        mtModal('只看哪个分类？', html, function () {
            $('mtModalBody').querySelectorAll('.ap-item').forEach(function (it) {
                it.addEventListener('click', function () {
                    state.filterCat = it.getAttribute('data-cat') || '';
                    lsSet(LSK.filter, state.filterCat);
                    mtCloseModal();
                    render();
                });
            });
        });
    }

    /* ---------- 内置弹窗 ---------- */
    function mtModal(title, bodyHTML, after) {
        $('mtModalTitle').textContent = title;
        $('mtModalBody').innerHTML = bodyHTML;
        $('mtModal').classList.add('show');
        if (after) after();
    }
    function mtCloseModal() { $('mtModal').classList.remove('show'); }

    /* ---------- 收藏 ---------- */
    function toggleFav(file) {
        var favs = [];
        try { favs = JSON.parse(lsGet(LSK.favs, '[]')); } catch (e) { }
        var i = favs.indexOf(file);
        if (i >= 0) favs.splice(i, 1); else favs.push(file);
        lsSet(LSK.favs, JSON.stringify(favs));
        state.favSet = new Set(favs);
        render();
    }

    /* ---------- 事件 ---------- */
    function bind() {
        document.addEventListener('click', function (e) {
            var fav = e.target.closest('.t-fav');
            if (fav) { e.preventDefault(); e.stopPropagation(); toggleFav(fav.getAttribute('data-fav')); return; }

            var title = e.target.closest('.tool-sec-title');
            if (title && title.getAttribute('data-sec') === 'cat') {
                var box = title.parentElement;
                box.classList.toggle('closed');
                var closed = getClosed();
                closed[title.getAttribute('data-key')] = box.classList.contains('closed');
                lsSet('toolCatClosed', JSON.stringify(closed));
                return;
            }

            var item = e.target.closest('.tool-item');
            if (item && item.dataset.file) { location.href = 'tool/' + encodeURIComponent(item.dataset.file); }
        });

        $('searchInput').addEventListener('input', function () {
            state.keyword = this.value.trim().toLowerCase();
            render();
        });
        $('modeBtn').addEventListener('click', cycleMode);
        $('filterBtn').addEventListener('click', openFilterModal);
        $('mtModalX').addEventListener('click', mtCloseModal);
        $('mtModal').addEventListener('click', function (e) { if (e.target === $('mtModal')) mtCloseModal(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') mtCloseModal(); });
    }

    /* ---------- 启动 ---------- */
    function init() {
        state.favSet = new Set(JSON.parse(lsGet(LSK.favs, '[]') || '[]'));
        state.mode = Math.max(0, Math.min(MODES.length - 1, parseInt(lsGet(LSK.mode, '0'), 10) || 0));
        state.filterCat = lsGet(LSK.filter, '') || '';
        bind();
        fetch(API_INDEX + '?t=' + Date.now(), { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(function (t) { parseIndex(t); render(); })
            .catch(function () { $('mtBody').innerHTML = '<div class="tool-empty">⚠️ 索引加载失败</div>'; });
    }

    window.MTbox = {
        init: init, parseIndex: parseIndex, render: render,
        getState: function () { return state; }, MODES: MODES
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();