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
    maxSpeed: 2.4, // 最高速度 (m/s)
    accelRate: 12.0, // 加減速の滑らかさ（大きいほど素早く追従）
    stunDuration: 0.35, // 衝突後に最高速度が落ちている時間 (秒)
    stunSlow: 0.5, // 衝突直後に最高速度から引く割合（時間とともに戻る）
    turnRate: 10.0, // 向きの変わる滑らかさ
    wallX: 1.45, // 壁の内側の移動限界 |x|
    legSwingAngle: 0.5, // 脚を縦軸回りに振る角度 (rad)
    legLiftAngle: 0.25, // 脚を持ち上げる角度 (rad)
    legSpeedPerMps: 14, // 速度 1 m/s あたりの歩行位相の進み (rad/s)
    antennaSwing: 0.25, // 触角の揺れ幅 (rad)
    antennaSpeed: 2.5, // 触角の揺れの速さ
    flipDuration: 0.35, // 死亡時に裏返る時間 (秒)
    deathTwitchSpeed: 28, // 死亡時の脚のピクピクの速さ
    deathTwitchAngle: 0.35, // 死亡時の脚のピクピクの大きさ (rad)
    // ジャンプ・飛行
    jumpHeight: 0.25, // ジャンプの最高到達点 (m)
    gravity: 8.0, // 重力 (m/s^2)。滞空時間 = 2*sqrt(2*jumpHeight/gravity) = 約 0.5 秒
    flyHoldDelay: 0.15, // ボタンを押し続けてから飛行に移るまでの時間 (秒)。これより短く離すと通常のジャンプ
    flyHeight: 0.4, // 飛行中の滑空の高さ (m)
    flyRiseSpeed: 1.6, // 飛行で上昇するときの最大の速さ (m/s)
    flyRiseGain: 8.0, // 目標の高さへ近づく強さ（大きいほどキビキビ上がる）
    flyBobAmount: 0.025, // 滑空中の上下のふわふわの幅 (m)
    flyBobSpeed: 5.0, // 同：速さ
    flySpeedMul: 1.1, // 飛行中の水平最高速度の倍率（地上比）
    flyMaxTime: 1.5, // 飛行ゲージの最大（飛べる秒数）
    flyRechargeTime: 2.0, // 地上でゲージが空から満タンになるまでの秒数
    flyResumeRatio: 0.3, // ゲージが空になったあと、再び飛べるようになるまでに回復させる割合 (0〜1)
    landBounce: 0.12, // 着地時に体が縮んで弾む大きさ（割合）
    landBounceDecay: 14.0, // 着地の弾みが収まる速さ
    tuckLegLift: 0.9, // 空中で脚を体に引き寄せる角度：付け根で持ち上げる (rad)
    tuckLegSwing: 0.35, // 同：脚を前後に畳む角度 (rad)
    tuckRate: 18.0, // 脚を畳む・戻す滑らかさ
    shadowOpacity: 0.4, // 空中の丸い影の濃さ（地上すれすれ）
    shadowRadius: 0.028, // 空中の丸い影の半径（モデル座標。ゴキブリの倍率がかかる）
    // 羽
    wingRate: 14.0, // 羽の開閉の滑らかさ（戻るときもこの速さ）
    wingJumpLift: 0.25, // ジャンプのみのとき前翅を浮かせる角度 (rad)
    wingOpenYaw: 0.75, // 飛行中に前翅を外側へ開く角度 (rad)
    wingOpenLift: 0.55, // 飛行中に前翅の後ろ端を持ち上げる角度 (rad)
    wingOpenRoll: 0.35, // 飛行中に前翅の外側を持ち上げる角度 (rad)
    hindWingLength: 0.04, // 後翅の長さ（モデル座標 m。前後方向）
    hindWingWidth: 0.017, // 後翅の幅（外側へ）
    hindWingColor: 0xc9a77a, // 後翅の色（薄い茶色）
    hindWingOpacity: 0.55, // 後翅の不透明度
    hindWingFlapHz: 30, // 後翅の羽ばたきの速さ（1 秒あたりの往復数）
    hindWingFlapMaxStep: 1.4, // 1 フレームで進める羽ばたきの位相の上限 (rad)。画面のフレームレートで見た目が破綻しないよう頭打ちにする
    hindWingFlapAngle: 0.7, // 羽ばたきの上下の振れ幅 (rad)
    hindWingSpread: 0.9, // 後翅を外側へ開く角度 (rad)
  },

  // ---- 人間 ----
  humans: {
    count: 5,
    startBackMin: 1.8, // スタート時のゴキブリからの後方距離（最小）
    startBackMax: 2.4, // 同（最大）
    lateralOffsets: [-0.9, -0.45, 0.0, 0.45, 0.9], // 人ごとの横オフセット
    followBackMin: 1.6, // ゴキブリの何 m 後方を狙うか（最小）
    followBackMax: 2.2, // 同（最大）
    startSpeed: 2.5, // 開始時の最高速度 (m/s)
    maxSpeed: 3.4, // 最大の最高速度 (m/s)
    speedRampTime: 60, // 最高速度が最大に達するまでの秒数
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
    walkPhasePerMps: 4.5, // 速度 1 m/s あたりの歩行位相の進み (rad/s)
    bobHeight: 0.03, // 体の上下の大きさ
    sprayArmWobble: 0.08, // 噴射中の右腕の揺れ (rad)
  },

  // ---- スプレー ----
  spray: {
    triggerRange: 3.0, // 人間からゴキブリまでの水平距離がこれ以内になったらすぐ噴射する
    aimStartBehind: 0.3, // 噴射開始時、狙い点をゴキブリの何 m 手前（人間側）から追い始めるか
    maxBurstTime: 2.5, // 連続で噴射できる最長時間
    burstPauseTime: 0.4, // 長く噴射したあとの一瞬の休み（缶の持ち直し）
    startGraceMin: 1.0, // ゲーム開始直後に噴射しない時間（最小）
    startGraceMax: 1.5, // 同（最大）
    aimSpeedStart: 3.6, // 狙い点がゴキブリを前後方向に追う速さ：開始時 (m/s)。ゴキブリの最高速度より速く＝まっすぐ逃げると当たる
    aimSpeedEnd: 4.6, // 同：人間の速度が最大になったとき（速度と同じ割合で上がる）
    aimLateralSpeedStart: 1.1, // 狙い点が左右方向に追う速さ：開始時 (m/s)。斜めに全力で走ったときの横の速さ（約 1.7 m/s）より遅く＝斜めに動けば避けられる
    aimLateralSpeedEnd: 1.5, // 同：人間の速度が最大になったとき
    aimLead: 0.25, // ゴキブリの何秒先の位置を狙うか（スプレーが床に届くまでの時間ぶん先読みする）
    aimMaxRange: 3.6, // 狙い点が足元から離れられる水平距離
    hitGrace: 0.25, // 霧から外れてもこの秒数未満なら「連続で当たっている」扱いを続ける
    hitTimeLimit: 1.0, // 連続で当たり続けるとゲームオーバーになる秒数
    particleMax: 2000, // 粒（ジェット＋霧）の上限数（プール）
    // 噴射ジェット
    jetRate: 350, // 1 人が噴射中に 1 秒に出す粒の数
    jetSpeedMin: 6.0, // 初速 (m/s)
    jetSpeedMax: 18.0,
    jetTravelTime: 0.25, // ノズルから狙い点の床まで粒が届く時間（秒）。短いほどスプレーが鋭く速い
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
    // 当たり判定（ゴキブリの高さ付近にある粒の濃さの合計で判定。空中なら空中の粒だけが当たる）
    hitHeightRange: 0.12, // ゴキブリの現在の高さ ±この範囲にある粒だけ数える (m)
    hitRadius: 0.12, // ゴキブリ中心からこの半径内の粒だけ数える (m)
    hitThreshold: 2.0, // 濃さの合計がこれを超えたら被弾
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
    heightFollow: 0.35, // ゴキブリの高さの変化にカメラが追従する割合（小さいほど揺れない）
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

  // ---- スピードアップアイテム（光る角砂糖）----
  boost: {
    // 見た目
    cubeSize: 0.04, // 角砂糖の一辺 (m、倍率をかける前)
    scale: 3.5, // 見た目の倍率（高いカメラから見えるサイズに。当たり判定は pickupRadius で別管理）
    floatHeight: 0.14, // 浮いている高さの中心 (m)
    bobAmount: 0.03, // 上下のふわふわの幅 (m)
    bobSpeed: 2.2, // 同：速さ
    spinSpeed: 1.0, // ゆっくり回る速さ (rad/s)
    ringRadius: 0.28, // 床の黄色いリングの外半径 (m)
    ringWidth: 0.05, // リングの太さ (m)
    ringOpacity: 0.7, // リングの最大の濃さ（加算合成）
    ringPulseSpeed: 2.0, // リングの脈動の速さ
    ringColor: 0xffd23f, // リング・キラキラの色
    sparkleCount: 4, // 角砂糖の周りのキラキラの数
    sparkleSize: 0.07, // キラキラの大きさ (m)
    burstCount: 14, // 取ったときに弾ける粒の数
    burstSize: 0.08, // 弾ける粒の大きさ (m)
    burstSpeed: 0.9, // 弾ける粒の初速 (m/s)
    burstLife: 0.45, // 弾ける粒の寿命 (秒)
    // 配置
    poolSize: 4, // アイテムのプール数（毎回 new しない）
    minDistance: 10, // スタートからこの距離 (m) 以内には置かない
    intervalMin: 25, // 次のアイテムまでの距離（最小, m）
    intervalMax: 40, // 同（最大）
    corridorX: 1.2, // 置く位置の |x| の上限
    obstacleClear: 0.4, // 障害物の縁からこれ以上離す (m)
    obstacleKeepRadius: 0.9, // 障害物を置くときにアイテムの中心からこの範囲を避ける (m)。obstacleClear + 障害物の大きさ
    // 取得
    pickupRadius: 0.38, // ゴキブリの中心からこの水平距離以内で取得 (m)。床のリング（半径 0.28）＋ゴキブリの体の半分ほど。リングに触れれば取れる
    pickupMaxY: 0.55, // ゴキブリの高さがこれ以下なら取得 (m)。ジャンプ中・飛行中（flyHeight 0.4）でも取れる
    // 効果
    duration: 4.0, // 効果の時間 (秒)。効果中に再取得すると残りをこの値にリセット
    speedMul: 1.6, // 最高速度の倍率
    accelMul: 1.4, // 加速の強さの倍率
    fadeOut: 0.5, // 効果の終わりにこの秒数かけて元の速度へ戻す
    fovBonus: 6, // 効果中に広げる画角 (度)
    streakOpacityMul: 1.8, // 床の筋の濃さの倍率
    streakLenMul: 1.6, // 床の筋の長さの倍率
    // 残像
    trailCount: 4, // 残像の数
    trailInterval: 0.05, // 残像どうしの時間差 (秒)
    trailOpacity: 0.6, // 一番近い残像の濃さ
    trailColor: 0xffd23f, // 残像の色
    trailSize: [0.06, 0.025, 0.1], // 残像の大きさ（半幅・半高さ・半長さ, m）
    // 音（取得時の「キラーン」）
    chimeVolume: 0.25,
    chimeFreq: 880, // 開始の周波数 (Hz)。ここから 2 倍まで上昇
    chimeTime: 0.28, // 長さ (秒)
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
