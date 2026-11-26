import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.hud = $('hud');
    this.distance = $('distance');
    this.best = $('best');
    this.gaugeWrap = $('gauge-wrap');
    this.gaugeFill = $('gauge-fill');
    this.flyWrap = $('fly-wrap');
    this.flyFill = $('fly-fill');
    this.boostWrap = $('boost-wrap');
    this.boostFill = $('boost-fill');
    this.vignette = $('vignette');
    this.overlays = {
      loading: $('overlay-loading'),
      title: $('overlay-title'),
      gameover: $('overlay-gameover'),
    };
    this.stick = $('stick');
    this.goDistance = $('go-distance');
    this.goBest = $('go-best');
    this.goNewrec = $('go-newrec');
    this.rankTitle = $('rank-title');
    this.rankGameover = $('rank-gameover');
    this.rankForm = $('rank-form');
    this.rankName = $('rank-name');
    this.rankSubmit = $('rank-submit');
    this.rankSkip = $('rank-skip');
    this.rankStatus = $('rank-status');
    this.startBtn = $('btn-start');
    this.retryBtn = $('btn-retry');
    this.milestone = $('milestone');
    this.muteBtn = $('btn-mute');
    this._lastDist = '';
    this._lastMeter = 0;
  }

  showOverlay(name) {
    for (const [k, el] of Object.entries(this.overlays)) el.classList.toggle('show', k === name);
  }

  setPlaying(playing) {
    this.hud.classList.toggle('show', playing);
    this.stick.classList.toggle('show', playing);
    if (!playing) this.setHit(0, 0);
  }

  setBest(best) {
    this.best.textContent = `ベスト ${best.toFixed(1)} m`;
  }

  setDistance(d) {
    const s = `${d.toFixed(1)} m`;
    if (s !== this._lastDist) {
      this.distance.textContent = s;
      this._lastDist = s;
    }
    // 1 m 進むごとに数字を少しだけ跳ねさせる
    const meter = Math.floor(d);
    if (meter > this._lastMeter && this.distance.animate) {
      this.distance.animate(
        [{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
        { duration: 140, easing: 'ease-out' },
      );
    }
    this._lastMeter = meter;
  }

  // 「50 m!」のようなポップアップ（CSS アニメを最初からやり直す）
  showMilestone(m) {
    this.showPopup(`${m} m!`);
  }

  // 画面中央のポップアップ。small: 長い文字用に小さめにする
  showPopup(text, small = false) {
    const el = this.milestone;
    el.textContent = text;
    el.classList.toggle('sm', small);
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  setMuted(muted) {
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  // 飛行ゲージ：ratio 0〜1、active: 空中または回復中（満タンで地上なら薄くする）、locked: 回復待ち
  setFly(ratio, active, locked) {
    this.flyFill.style.width = `${ratio * 100}%`;
    this.flyWrap.classList.toggle('active', active);
    this.flyWrap.classList.toggle('locked', locked);
  }

  // スピードアップの残り時間ゲージ：ratio 0〜1（0 なら非表示）
  setBoost(ratio) {
    this.boostWrap.classList.toggle('show', ratio > 0);
    this.boostFill.style.width = `${ratio * 100}%`;
  }

  // hitTimer: 連続被弾秒数、time: 点滅用の時刻
  setHit(hitTimer, time) {
    const hitting = hitTimer > 0;
    this.gaugeWrap.classList.toggle('show', hitting);
    this.gaugeFill.style.width = `${Math.min(1, hitTimer / CONFIG.spray.hitTimeLimit) * 100}%`;
    if (hitting) {
      const k = Math.min(1, hitTimer / CONFIG.spray.hitTimeLimit);
      this.vignette.style.opacity = String((0.45 + 0.4 * k) * (0.6 + 0.4 * Math.sin(time * 14)));
    } else {
      this.vignette.style.opacity = '0';
    }
  }

  showGameOver(distance, best, isNew) {
    this.goDistance.textContent = `${distance.toFixed(1)} m`;
    this.goBest.textContent = `ベスト ${best.toFixed(1)} m`;
    this.goNewrec.style.display = isNew ? 'block' : 'none';
    this.showOverlay('gameover');
  }

  // ランキング表示。state: 'loading' | 'error' | 'ok'、entries: [{name, distance}]、mine: ハイライトする名前
  // 名前は textContent で入れる（HTML として解釈させない）
  renderRanking(state, entries = [], mine = '', isLocal = false) {
    for (const box of [this.rankTitle, this.rankGameover]) {
      box.replaceChildren();
      const h = document.createElement('h3');
      h.textContent = 'ランキング';
      if (isLocal) {
        const note = document.createElement('span');
        note.className = 'rank-note';
        note.textContent = ' (この端末のみの記録)';
        h.append(note);
      }
      box.append(h);
      if (state !== 'ok' || entries.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'rank-msg';
        msg.textContent =
          state === 'loading' ? '読み込み中…'
          : state === 'error' ? 'ランキングを読み込めませんでした'
          : 'まだ記録がありません';
        box.append(msg);
        continue;
      }
      const ol = document.createElement('ol');
      entries.forEach((e, i) => {
        const li = document.createElement('li');
        if (mine && e.name === mine) li.className = 'me';
        const pos = document.createElement('span');
        pos.className = 'r-pos';
        pos.textContent = `${i + 1}`;
        const name = document.createElement('span');
        name.className = 'r-name';
        name.textContent = e.name;
        const dist = document.createElement('span');
        dist.className = 'r-dist';
        dist.textContent = `${e.distance.toFixed(1)} m`;
        li.append(pos, name, dist);
        ol.append(li);
      });
      box.append(ol);
    }
  }

  // 名前登録フォームの表示。show=false で隠す
  showRankForm(show, name = '') {
    this.rankForm.classList.toggle('show', show);
    if (show) {
      this.rankName.value = name;
      this.setRankBusy(false);
      this.setRankStatus('');
    }
  }

  setRankBusy(busy) {
    this.rankSubmit.disabled = busy;
    this.rankSkip.disabled = busy;
    this.rankName.disabled = busy;
  }

  setRankStatus(text, isError = false) {
    this.rankStatus.textContent = text;
    this.rankStatus.classList.toggle('err', isError);
  }
}
