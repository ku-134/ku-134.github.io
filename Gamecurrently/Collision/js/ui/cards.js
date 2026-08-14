// 职业卡片渲染：图鉴列表、选球、联机选球共用
// 返回当前卡片列表 DOM，便于外部加/删选中态
export function renderCards(listEl, defs, { selectedId, onPick } = {}) {
  listEl.innerHTML = '';
  for (const d of defs) {
    const card = document.createElement('div');
    card.className = 'card' + (d.id === selectedId ? ' selected' : '');
    card.innerHTML = `<div class="orb" style="background:${d.color}"></div><div class="cname">${d.name}</div><div class="cskill">【${d.skillName}】${d.type === 'passive' ? '被动' : d.type === 'active' ? '主动' : '被动+主动'}</div>`;
    card.addEventListener('click', () => onPick?.(d, card));
    listEl.appendChild(card);
  }
}
