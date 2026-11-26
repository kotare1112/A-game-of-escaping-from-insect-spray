import { CONFIG } from './config.js';

// ランキングの保存先を抽象化したクラス。
// VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY が両方あれば Supabase（REST API）、無ければこの端末の localStorage。
// 通信失敗時も例外は投げず、{ ok: false } を返す。

const clean = (name) => String(name).trim();

// 同じ名前ごとに最高記録だけ残し、距離の降順で上位 size 件にする
export function topRecords(records, size = CONFIG.ranking.size) {
  const best = new Map();
  for (const r of records) {
    const name = clean(r.name);
    const distance = Number(r.distance);
    if (!name || !Number.isFinite(distance)) continue;
    const cur = best.get(name);
    if (!cur || distance > cur.distance) best.set(name, { name, distance });
  }
  return [...best.values()].sort((a, b) => b.distance - a.distance).slice(0, size);
}

export class Ranking {
  constructor() {
    const env = import.meta.env || {};
    const url = (env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
    const key = (env.VITE_SUPABASE_ANON_KEY || '').trim();
    this.url = url;
    this.key = key;
    // 'online'（Supabase）| 'local'（この端末だけ）
    this.mode = url && key ? 'online' : 'local';
  }

  get isOnline() {
    return this.mode === 'online';
  }

  // 戻り値: { ok: true, entries: [{name, distance}] } | { ok: false }
  async fetchTop() {
    try {
      const R = CONFIG.ranking;
      const rows = this.isOnline ? await this._remoteList() : this._localList();
      return { ok: true, entries: topRecords(rows, R.size) };
    } catch {
      return { ok: false };
    }
  }

  // 戻り値: { ok: boolean }。距離は小数 1 桁に丸めて保存する
  async submit(name, distance) {
    const R = CONFIG.ranking;
    const n = clean(name).slice(0, R.nameMaxLength);
    const d = Math.round(distance * 10) / 10;
    if (!n || !Number.isFinite(d) || d < 0) return { ok: false };
    try {
      if (this.isOnline) await this._remoteAdd(n, d);
      else this._localAdd(n, d);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  // ---- Supabase（PostgREST）----
  // 旧形式の anon key（JWT）は Authorization にも入れる。新形式の publishable key（sb_publishable_…）は apikey だけ
  _headers(extra = {}) {
    const auth = this.key.startsWith('eyJ') ? { Authorization: `Bearer ${this.key}` } : {};
    return { apikey: this.key, ...auth, ...extra };
  }

  async _fetch(path, init) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.ranking.timeoutMs);
    try {
      const res = await fetch(`${this.url}/rest/v1/${path}`, { ...init, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async _remoteList() {
    const q = `scores?select=name,distance,created_at&order=distance.desc&limit=${CONFIG.ranking.fetchLimit}`;
    const res = await this._fetch(q, { method: 'GET', headers: this._headers() });
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('bad response');
    return rows;
  }

  async _remoteAdd(name, distance) {
    await this._fetch('scores', {
      method: 'POST',
      headers: this._headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ name, distance }),
    });
  }

  // ---- この端末だけ（localStorage）----
  _localList() {
    try {
      const rows = JSON.parse(localStorage.getItem(CONFIG.ranking.localKey) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  _localAdd(name, distance) {
    const rows = this._localList();
    rows.push({ name, distance, created_at: new Date().toISOString() });
    rows.sort((a, b) => b.distance - a.distance);
    localStorage.setItem(CONFIG.ranking.localKey, JSON.stringify(rows.slice(0, CONFIG.ranking.localKeep)));
  }
}
