// 事件总线：物理/技能/UI 解耦的核心
class EventBus {
  constructor() { this.map = new Map(); }
  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) { this.map.get(type)?.delete(fn); }
  emit(type, data) { this.map.get(type)?.forEach(fn => { try { fn(data); } catch (e) { console.error('[eventBus]', type, e); } }); }
  clear(type) { if (type) this.map.delete(type); else this.map.clear(); }
}
export const bus = new EventBus();
