/**
 * 🍀 妲那给木 · 视觉小说引擎 v1.0.2
 * - 修复加载问题
 * - 修复角色垂直排列
 * - 修复选项后不继续
 */
const DLGM = (function() {
    'use strict';

    let scriptLines = [];
    let currentIndex = 0;
    let characters = new Map();
    let conditions = new Set();
    let isPlaying = false;
    let dialogueClickHandler = null;
    let optionSelected = false;

    const stageBg = document.getElementById('stage-bg');
    const charsContainer = document.getElementById('characters-container');
    const dialogueBox = document.getElementById('dialogue-box');
    const dialogueName = document.getElementById('dialogue-name');
    const dialogueText = document.getElementById('dialogue-text');
    const optionsContainer = document.getElementById('options-container');
    const optionsPrompt = document.getElementById('options-prompt');
    const optionsButtons = document.getElementById('options-buttons');

    function log(msg) { console.log('[DLGM]', msg); }

    // ---------- 解析（不变） ----------
    function parseScript(text) {
        const lines = text.split(/\r?\n/);
        const instructions = [];
        let lineNum = 0;
        for (let raw of lines) {
            lineNum++;
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            let instr = { line: lineNum, raw: trimmed };

            if (trimmed.startsWith('### ')) {
                const bg = trimmed.substring(4).trim();
                instr.type = 'bg';
                instr.bg = bg === '0' ? null : bg;
                instructions.push(instr);
                continue;
            }
            if (trimmed.startsWith('## ')) {
                const parts = trimmed.substring(3).split(/\s*-\s*/);
                if (parts.length >= 3) {
                    instr.type = 'role';
                    instr.id = parts[0].trim();
                    instr.image = parts[1].trim();
                    instr.position = parseInt(parts[2].trim()) || 1;
                    instr.effect = parts.length > 3 ? parts[3].trim() : '0';
                    instructions.push(instr);
                }
                continue;
            }
            if (trimmed.startsWith('| ')) {
                const content = trimmed.substring(2).trim();
                const hasColon = content.includes(':');
                const hasSlash = content.includes('/');
                if (hasColon && !hasSlash) {
                    const colonIdx = content.indexOf(':');
                    const name = content.substring(0, colonIdx).trim();
                    const text = content.substring(colonIdx + 1).trim();
                    instr.type = 'dialogue';
                    instr.name = name;
                    instr.text = text;
                    instructions.push(instr);
                } else {
                    const parts = content.split(/\s*\/\s*/);
                    const prompt = parts.length > 0 ? parts[0] : '';
                    const options = [];
                    for (let i = 1; i < parts.length; i++) {
                        let opt = parts[i].trim();
                        let condition = null, addCondition = null, target = null;
                        const arrowIdx = opt.indexOf('->');
                        if (arrowIdx !== -1) {
                            target = opt.substring(arrowIdx + 2).trim();
                            opt = opt.substring(0, arrowIdx).trim();
                        }
                        const minusIdx = opt.indexOf(' - ');
                        const plusIdx = opt.indexOf(' + ');
                        if (minusIdx !== -1 && (plusIdx === -1 || minusIdx < plusIdx)) {
                            condition = opt.substring(minusIdx + 3).trim();
                            opt = opt.substring(0, minusIdx).trim();
                        } else if (plusIdx !== -1 && (minusIdx === -1 || plusIdx < minusIdx)) {
                            addCondition = opt.substring(plusIdx + 3).trim();
                            opt = opt.substring(0, plusIdx).trim();
                        }
                        options.push({ text: opt, condition, addCondition, target });
                    }
                    instr.type = 'options';
                    instr.prompt = prompt;
                    instr.options = options;
                    instructions.push(instr);
                }
                continue;
            }
            if (trimmed.startsWith('# ')) {
                const rest = trimmed.substring(2).trim();
                const ids = rest.split(/\s+/).filter(p => p.startsWith('#')).map(p => p.substring(1).trim());
                if (ids.length === 0 && rest.length > 0) {
                    rest.split(/\s+/).forEach(a => { if (a) ids.push(a); });
                }
                instr.type = 'exit';
                instr.ids = ids;
                instructions.push(instr);
                continue;
            }
            if (trimmed.startsWith('^ ')) {
                const val = trimmed.substring(2).trim();
                const sec = parseFloat(val);
                instr.type = 'wait';
                instr.seconds = isNaN(sec) ? 0 : sec;
                instructions.push(instr);
                continue;
            }
            if (trimmed.startsWith('@')) {
                instr.type = 'label';
                instr.label = trimmed.substring(1).trim();
                instructions.push(instr);
                continue;
            }
            if (trimmed.startsWith('-> ')) {
                const target = trimmed.substring(3).trim();
                if (target.startsWith('@')) {
                    instr.type = 'jump';
                    instr.target = target.substring(1).trim();
                    instructions.push(instr);
                }
                continue;
            }
            console.warn(`行 ${lineNum} 未知指令: ${trimmed}`);
        }
        return instructions;
    }

    // ---------- 查找标签 ----------
    function findLabel(label) {
        for (let i = 0; i < scriptLines.length; i++) {
            if (scriptLines[i].type === 'label' && scriptLines[i].label === label) return i;
        }
        return -1;
    }

    // ---------- 跳转（修复：异步执行，重置标志） ----------
    function jumpToLabel(label) {
        const idx = findLabel(label);
        if (idx !== -1) {
            currentIndex = idx;
            log(`跳转到 @${label} (索引 ${idx})`);
            // 关闭选项，显示对话框
            optionsContainer.style.display = 'none';
            dialogueBox.style.display = 'flex';
            // 重置选项选择标志，允许后续选项
            optionSelected = false;
            // 使用 setTimeout 确保当前事件循环完成，避免栈冲突
            setTimeout(() => executeNext(), 0);
        } else {
            console.error(`标签 @${label} 未找到`);
            // 出错时尝试继续下一条
            setTimeout(() => executeNext(), 0);
        }
    }

    // ---------- 角色管理 ----------
    function updateCharacter(roleData) {
        const { id, image, position, effect } = roleData;
        let char = characters.get(id);
        if (!char) {
            const div = document.createElement('div');
            div.className = 'character';
            let left = 50;
            if (position === 1) left = 20;
            else if (position === 2) left = 50;
            else if (position === 3) left = 80;
            div.style.left = left + '%';
            const img = document.createElement('img');
            img.src = image;
            img.alt = id;
            div.appendChild(img);
            charsContainer.appendChild(div);
            char = { id, image, position, effect: effect || '0', dom: div, img: img };
            characters.set(id, char);
            setTimeout(() => div.classList.add('show'), 20);
        } else {
            if (image) { char.image = image; char.img.src = image; }
            if (position) {
                char.position = position;
                let left = 50;
                if (position === 1) left = 20;
                else if (position === 2) left = 50;
                else if (position === 3) left = 80;
                char.dom.style.left = left + '%';
            }
            if (effect && effect !== '0') {
                char.effect = effect;
                log(`角色 ${id} 效果: ${effect}`);
            }
        }
    }

    function removeCharacter(id) {
        const char = characters.get(id);
        if (char) {
            char.dom.classList.add('exiting');
            setTimeout(() => {
                char.dom.remove();
                characters.delete(id);
            }, 500);
        }
    }

    function setSpeaking(name) {
        for (let [id, char] of characters) {
            char.dom.classList.toggle('speaking', id === name);
        }
    }

    // ---------- 执行下一条 ----------
    function executeNext() {
        if (!isPlaying) return;
        if (currentIndex >= scriptLines.length) {
            dialogueText.textContent = '— Fin —';
            dialogueName.textContent = '';
            log('台本结束');
            return;
        }

        const inst = scriptLines[currentIndex];
        currentIndex++;
        log(`执行 ${inst.line}: ${inst.type}`);

        switch (inst.type) {
            case 'bg': {
                if (inst.bg) {
                    window.setGameBackground(inst.bg);
                } else {
                    stageBg.style.backgroundImage = 'none';
                    stageBg.style.backgroundColor = '#000';
                }
                executeNext();
                break;
            }
            case 'role': {
                updateCharacter(inst);
                executeNext();
                break;
            }
            case 'dialogue': {
                dialogueName.textContent = inst.name;
                dialogueText.textContent = inst.text;
                setSpeaking(inst.name);
                dialogueBox.style.display = 'flex';
                optionsContainer.style.display = 'none';
                if (dialogueClickHandler) {
                    dialogueBox.removeEventListener('click', dialogueClickHandler);
                }
                dialogueClickHandler = function() {
                    dialogueBox.removeEventListener('click', dialogueClickHandler);
                    dialogueClickHandler = null;
                    executeNext();
                };
                dialogueBox.addEventListener('click', dialogueClickHandler);
                break;
            }
            case 'options': {
                dialogueBox.style.display = 'none';
                optionsContainer.style.display = 'block';
                optionsPrompt.textContent = inst.prompt || '请选择';
                optionsButtons.innerHTML = '';
                const validOptions = inst.options.filter(opt => {
                    if (opt.condition && !conditions.has(opt.condition)) return false;
                    return true;
                });
                if (validOptions.length === 0) {
                    optionsContainer.style.display = 'none';
                    executeNext();
                    break;
                }
                optionSelected = false;
                validOptions.forEach((opt) => {
                    const btn = document.createElement('button');
                    btn.className = 'option-btn';
                    btn.textContent = opt.text;
                    btn.addEventListener('click', function() {
                        if (optionSelected) return;
                        optionSelected = true;
                        // 禁用所有按钮
                        document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
                        // 隐藏选项，显示对话框
                        optionsContainer.style.display = 'none';
                        dialogueBox.style.display = 'flex';
                        // 添加条件
                        if (opt.addCondition) {
                            conditions.add(opt.addCondition);
                            log(`添加条件: ${opt.addCondition}`);
                        }
                        // 跳转或继续
                        if (opt.target) {
                            jumpToLabel(opt.target);
                        } else {
                            // 直接继续，但重置标志
                            optionSelected = false;
                            executeNext();
                        }
                    });
                    optionsButtons.appendChild(btn);
                });
                break;
            }
            case 'exit': {
                inst.ids.forEach(id => removeCharacter(id));
                setTimeout(() => executeNext(), 500);
                break;
            }
            case 'wait': {
                const sec = inst.seconds;
                if (sec === 0) {
                    const allIds = Array.from(characters.keys());
                    allIds.forEach(id => removeCharacter(id));
                    setTimeout(() => executeNext(), 500);
                } else {
                    setTimeout(() => executeNext(), sec * 1000);
                }
                break;
            }
            case 'label': {
                executeNext();
                break;
            }
            case 'jump': {
                jumpToLabel(inst.target);
                break;
            }
            default:
                executeNext();
        }
    }

    // ---------- 启动/重置 ----------
    function startGame() {
        if (isPlaying) resetGame();
        fetch('DLGM-Taiben.txt')
            .then(res => {
                if (!res.ok) throw new Error(`加载台本失败 (${res.status})`);
                return res.text();
            })
            .then(text => {
                scriptLines = parseScript(text);
                log(`台本解析完成，共 ${scriptLines.length} 条指令`);
                currentIndex = 0;
                isPlaying = true;
                optionSelected = false;
                charsContainer.innerHTML = '';
                characters.clear();
                conditions.clear();
                stageBg.style.backgroundImage = 'none';
                stageBg.style.backgroundColor = '#000';
                optionsContainer.style.display = 'none';
                dialogueBox.style.display = 'flex';
                dialogueName.textContent = '';
                dialogueText.textContent = '加载中……';
                setTimeout(() => executeNext(), 300);
            })
            .catch(err => {
                console.error('启动失败:', err);
                alert('无法加载台本文件，请确保 DLGM-Taiben.txt 存在。');
            });
    }

    function resetGame() {
        isPlaying = false;
        if (dialogueClickHandler) {
            dialogueBox.removeEventListener('click', dialogueClickHandler);
            dialogueClickHandler = null;
        }
        charsContainer.innerHTML = '';
        characters.clear();
        dialogueBox.style.display = 'flex';
        optionsContainer.style.display = 'none';
        dialogueName.textContent = '';
        dialogueText.textContent = '';
        stageBg.style.backgroundImage = 'none';
        stageBg.style.backgroundColor = '#000';
        currentIndex = 0;
        conditions.clear();
        optionSelected = false;
        log('游戏已重置');
    }

    window.setGameBackground = function(url) {
        if (!url) {
            stageBg.style.backgroundImage = 'none';
            stageBg.style.backgroundColor = '#000';
            return;
        }
        stageBg.style.backgroundImage = `url('${url}')`;
        stageBg.style.backgroundColor = 'transparent';
    };

    return { startGame, resetGame };
})();