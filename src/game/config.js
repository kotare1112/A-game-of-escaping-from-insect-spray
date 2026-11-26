// ゲームの調整用定数をすべてここに集約する。
// 単位は特記なければメートル・秒。前方は -Z、右は +X。

export const CONFIG = {
  // ---- モデル ----
  models: {
    cockroach: '/models/cockroach.glb',
    humans: [
      '/models/human_1.glb',
      '/models/human_2.glb',
      '/models/human_3.glb',
      '/models/human_4.glb',
      '/models/human_5.glb',
    ],
  },

  // ---- 部屋 ----
  room: {
    width: 3.0, // 部屋の幅（x: -1.5〜+1.5）
    wallHeight: 2.4, // 壁の高さ
    segmentLength: 4.0, // 1 セグメントの長さ
    segmentCount: 8, // 同時に並べるセグメント数
    segmentStartZ: 6.0, // 最初のセグメント（一番後ろ）の中心 z
    recycleBehind: 10.0, // プレイヤーよりこれ以上後ろに外れたセグメントを前に付け替える
    fogNear: 8, // フォグの開始距離
    fogFar: 22, // フォグの終了距離
    fogColor: 0x1b1a22, // フォグ・背景色
    furnitureMinX: 1.2, // 家具は |x| がこの値より壁側にのみ置く（通路を空ける）
    windowChance: 0.45, // 壁に窓を付ける確率
    doorChance: 0.2, // 壁にドアを付ける確率
    furnitureChance: 0.7, // 壁際に家具を置く確率
  },

  // ---- 床の障害物（通路に置く小物。当たり判定はゴキブリのみ）----
  obstacles: {
    scale: 1.6, // 見た目と当たり判定の倍率（上から見て見分けやすいよう少し大きめ）
    safeStartDistance: 6.0, // スタート地点からこの距離（m）までは置かない
    corridorX: 1.2, // 置く位置の |x| の上限（通路は -1.3〜+1.3）
    minGap: 1.1, // 障害物の中心同士の最低距離（ゴキブリ 2 匹分以上の隙間を残す）
    perSegmentStart: 1.0, // 1 セグメントあたりの個数（スタート付近）
    perSegmentEnd: 4.0, // 同（densityDistance に達したとき）
    densityDistance: 100, // 密度が最大になる距離 (m)
    perTypePool: 8, // 種類ごとのプール数（毎回 new しない）
    roachRadius: 0.08, // ゴキブリの当たり判定の円の半径
    impactMin: 0.5, // これ以上の速さで正面からぶつかると「衝突」扱い (m/s)
    impactKeepVelocity: 0.35, // 衝突時に残す速度の割合（小さいほど大きく減速）
    impactShake: 0.035, // 衝突時のカメラの揺れ (m)
  },

  // ---- ゴキブリ（プレイヤー）----
  cockroach: {
    scale: 3.0, // 見た目の倍率（小さすぎて見えないため拡大）
    maxSpeed: 1.6, // 最高速度 (m/s)
    accelRate: 12.0, // 加減速の滑らかさ（大きいほど素早く追従）
    stunDuration: 0.35, // 衝突後に最高速度が落ちている時間 (秒)
    stunSlow: 0.5, // 衝突直後に最高速度から引く割合（時間とともに戻る）
    turnRate: 10.0, // 向きの変わる滑らかさ
    wallX: 1.45, // 壁の内側の移動限界 |x|
    legSwingAngle: 0.5, // 脚を縦軸回りに振る角度 (rad)
    legLiftAngle: 0.25, // 脚を持ち上げる角度 (rad)
    legSpeedPerMps: 18, // 速度 1 m/s あたりの歩行位相の進み (rad/s)
    antennaSwing: 0.25, // 触角の揺れ幅 (rad)
    antennaSpeed: 2.5, // 触角の揺れの速さ
    flipDuration: 0.35, // 死亡時に裏返る時間 (秒)
    deathTwitchSpeed: 28, // 死亡時の脚のピクピクの速さ
    deathTwitchAngle: 0.35, // 死亡時の脚のピクピクの大きさ (rad)
  },

  // ---- 人間 ----
  humans: {
    count: 5,
    startBackMin: 1.8, // スタート時のゴキブリからの後方距離（最小）
    startBackMax: 2.4, // 同（最大）
    lateralOffsets: [-0.9, -0.45, 0.0, 0.45, 0.9], // 人ごとの横オフセット
    followBackMin: 1.6, // ゴキブリの何 m 後方を狙うか（最小）
    followBackMax: 2.2, // 同（最大）
    startSpeed: 1.0, // 開始時の最高速度 (m/s)
    maxSpeed: 1.9, // 最大の最高速度 (m/s)
    speedRampTime: 90, // 最高速度が最大に達するまでの秒数
    surgeIntervalMin: 4.0, // 「突進」の間隔（最小, 秒）
    surgeIntervalMax: 7.0, // 同（最大）
    surgeDuration: 1.2, // 突進が続く時間 (秒)
    surgeSpeedMul: 1.5, // 突進中の速度上限の倍率
    fadeOpacity: 0.3, // カメラとゴキブリの間に入ったときの不透明度
    fadeRate: 10, // 透明になる・戻る速さ
    fadeWidth: 0.4, // カメラ〜ゴキブリの線からこの距離以内なら視界を遮るとみなす (m)
    armAimShoulderHeight: 1.35, // 腕を狙い点へ向ける計算に使う肩の高さ
    armAimBaseReach: 1.0, // モデルのポーズが指している床の位置（前方 m）
    armAimMax: 0.9, // 腕の追加回転の上限 (rad)
    armAimRate: 12, // 腕が狙い点へ向く速さ
    followGain: 3.0, // 目標位置への近づき方（距離×この値が希望速度）
    minSeparation: 0.45, // 人同士の最低距離
    wallX: 1.3, // 人間の移動限界 |x|
    turnRate: 6.0, // 体の向きの変わる滑らかさ
    legSwingAngle: 0.44, // 脚の振り (rad、約25°)
    armSwingAngle: 0.35, // 左腕の振り (rad)
    walkPhasePerMps: 7.0, // 速度 1 m/s あたりの歩行位相の進み (rad/s)
    bobHeight: 0.03, // 体の上下の大きさ
    sprayArmWobble: 0.08, // 噴射中の右腕の揺れ (rad)
  },

  // ---- スプレー ----
  spray: {
    sprayTimeMin: 1.0, // 噴射する時間（最小）
    sprayTimeMax: 2.0, // 同（最大）
    restTimeMin: 0.6, // 休む時間（最小）
    restTimeMax: 1.8, // 同（最大）
    aimSpeedStart: 1.0, // 狙い点がゴキブリを追う速さ：開始時 (m/s)
    aimSpeedEnd: 1.6, // 同：人間の速度が最大になったとき（速度と同じ割合で上がる）
    aimMaxRange: 2.8, // 狙い点が足元から離れられる水平距離
    hitTimeLimit: 3.0, // 連続で当たり続けるとゲームオーバーになる秒数
    particleMax: 2000, // 粒（ジェット＋霧）の上限数（プール）
    // 噴射ジェット
    jetRate: 350, // 1 人が噴射中に 1 秒に出す粒の数
    jetSpeedMin: 6.0, // 初速 (m/s)
    jetSpeedMax: 8.0,
    jetConeMinDeg: 8, // 広がり角（中心線からの角度）
    jetConeMaxDeg: 12,
    jetDrag: 2.5, // 空気抵抗（速度に exp(-drag*t) をかける）
    jetLifeMin: 0.8, // 粒の寿命（秒）
    jetLifeMax: 1.1,
    jetSizeStart: 0.03, // 粒の大きさ：ノズル付近 (m)
    jetSizeEnd: 0.2, // 同：先端
    jetAlpha: 0.7, // 粒の最大の濃さ
    jetFloorKill: 0.04, // この高さまで下がったら霧に置き換える
    // 残る霧
    mistChance: 0.25, // ジェットの粒が霧に変わる確率
    mistLifeMin: 2.0, // 霧の寿命（秒）
    mistLifeMax: 3.0,
    mistSizeStart: 0.3, // 霧の大きさ：最初 (m)
    mistSizeEnd: 0.8, // 同：最大
    mistAlpha: 0.2, // 霧の最大の濃さ
    mistDrift: 0.08, // 霧の漂う速さ (m/s)
    mistSink: 0.02, // 霧の沈む速さ (m/s)
    // 床の湿った跡
    decalMax: 40, // 同時に出せる跡の数
    decalInterval: 0.18, // 噴射中に跡を置く間隔（秒）
    decalLife: 1.5, // 跡が消えるまでの時間
    decalAlpha: 0.35, // 跡の濃さ
    // 当たり判定（床付近にある霧の濃さの合計で判定）
    hitMaxHeight: 0.15, // この高さ以下の粒だけ数える (m)
    hitRadius: 0.12, // ゴキブリ中心からこの半径内の粒だけ数える (m)
    hitThreshold: 3.0, // 濃さの合計がこれを超えたら被弾
    // 音
    soundVolume: 0.35, // 1 人ぶんの最大音量
    soundMaxDistance: 6.0, // この距離で無音になる (m)
  },

  // ---- カメラ ----
  camera: {
    fov: 55, // 停止時の画角
    fovMax: 65, // 最高速度での画角
    fovRate: 4.0, // 画角が変わる滑らかさ
    height: 3.2, // ゴキブリからの高さ
    back: 2.7, // ゴキブリからの後方距離
    lookAhead: 1.2, // ゴキブリの何 m 前方を見るか
    followRate: 7.0, // 追従の滑らかさ
    rollMaxDeg: 3.0, // 横移動時のロールの最大角
    rollRate: 6.0, // ロールの滑らかさ
    stepShakeDistance: 1.2, // 人間がこの距離（後方 m）以内に迫ると足音に合わせて揺れる
    stepShake: 0.02, // その揺れの大きさ (m)
    shakeDecay: 8.0, // 衝突の揺れが収まる速さ
    near: 0.05,
    far: 60,
    maxPixelRatio: 2,
  },

  // ---- 速度演出 ----
  speedFx: {
    streakCount: 36, // 床すれすれを流れる筋の数
    streakRadiusX: 0.9, // ゴキブリ周辺の幅（|x| 方向）
    streakAheadMin: 1.5, // 筋が現れる前方距離（最小）
    streakAheadMax: 4.0, // 同（最大）
    streakBehind: 2.2, // これ以上後ろに流れたら前へ出し直す
    streakLenMin: 0.1, // 筋の長さ（停止時）
    streakLenMax: 0.7, // 同（最高速度）
    streakOpacity: 0.45, // 最高速度での濃さ
    milestoneStep: 50, // ポップアップを出す距離ごと (m)
  },

  // ---- 照明 ----
  light: {
    shadowMapSize: 1024,
    shadowRange: 5, // 影の範囲（プレイヤー周辺の半径）
    offset: [2.5, 6, 2], // プレイヤーからの平行光源の位置
  },

  // ---- その他 ----
  maxDelta: 0.05, // 1 フレームの時間の上限（タブ復帰時の暴走防止）
  gameOverDelay: 1.4, // 死亡してからゲームオーバー画面を出すまでの秒数
  storageKey: 'insect-spray-best',
};
