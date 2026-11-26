# A-game-of-escaping-from-insect-spray

殺虫スプレーを噴射してくる人間たちから、ゴキブリになって逃げ続ける 3D ゲーム。

> 開発中です。ランキングはまだ実装されていません。

## ゲーム内容

- 舞台は縦にどこまでも続く部屋
- プレイヤーが操作するのはゴキブリ 1 匹。カメラはゴキブリの後方上空から見下ろす
- 人間が 5 人、ゴキブリの背後から殺虫スプレーを噴射してくる。時間とともに足が速くなり（開始 2.5 m/s → 60 秒で 3.4 m/s。ゴキブリの最高速度は 2.4 m/s）、数秒おきに 1 人が短時間だけ突進してくる
- 人間はゴキブリが 3 m 以内に入るとすぐに噴射を始め、射程内にいる間は噴射し続ける（2.5 秒続けると一瞬だけ休む）
- スプレーはゴキブリの少し先を狙い、前後方向はゴキブリより速く追ってくるが、左右方向の追従は遅い。まっすぐ逃げるだけだと当たり、斜めに大きく動くと避けられる
- スプレーはノズルから出るジェット（円錐状に広がる細かい粒）と、先端の床に残る霧で表現している。**ゴキブリの高さにある粒の濃いところに入ると被弾** し、**1 秒間連続** で被弾するとゲームオーバー（外れると 0 に戻る）。地上では床の霧に当たり、空中では床の霧には当たらないが、空中を飛ぶジェットの粒には当たる
- ジャンプ（最高 約 0.25 m・滞空 約 0.5 秒）と飛行ができる。ジャンプ中にボタンを押し続けると飛行に移り、高さ約 0.4 m をふわふわ滑空する（水平速度は地上の約 1.1 倍）。飛べるのは最大 1.5 秒ぶんの飛行ゲージがある間だけ。地上にいる間に約 2 秒で回復し、空になったら 30% 回復するまで再び飛べない。飛行中は羽（前翅と薄い後翅）が開いて羽ばたく
- 空中でゴキブリの高さが障害物より上なら、障害物に当たらずに越えられる（障害物の上に乗ることはできない）
- 通路にはスリッパ・本・マグカップ・積み木・丸めたティッシュ・コードなどの障害物が置かれている（スタートから 6 m 先から。遠くへ行くほど増える）。ぶつかると押し戻され、正面衝突すると大きく減速する（人間は障害物を無視する）。必ず通り抜けられる隙間がある
- 速く走ると画角が広がり、床に流れる筋が出る。50 m ごとに「50 m!」と表示される
- スプレーの音が鳴る（最初の操作で開始）。画面右上のボタン（🔊/🔇）でミュートできる（設定はブラウザに保存）
- 進んだ距離（メートル）がスコア

## 操作方法

| 端末 | 操作 |
|---|---|
| PC | 矢印キー または WASD キーで前後左右に移動。スペースでジャンプ、押し続けると飛ぶ |
| スマホ・タブレット | 画面下側の中央付近にある円形スティックをフリックして前後左右に移動。スティック以外の画面をタップでジャンプ、長押しで飛ぶ（スティックを操作しながら別の指で可能） |

## 遊び方（起動方法）

Node.js が必要です。

```
npm install
npm run dev      # 開発サーバーを起動（表示された URL をブラウザで開く）
npm run build    # dist/ に本番用ファイルを出力
npm run preview  # build 結果の確認
```

ゲームの調整値（速度・距離・時間・カメラ・スケールなど）は [src/game/config.js](src/game/config.js) にまとめています。主な項目：

| 項目 | 場所（config.js） |
|---|---|
| ゴキブリの速さ・キビキビ感・衝突時の減速 | `cockroach`、`obstacles.impact*` |
| 人間の速さ・突進・半透明化 | `humans`（`startSpeed` / `maxSpeed` / `speedRampTime` / `surge*` / `fade*`） |
| 障害物の密度・隙間・大きさ | `obstacles`（`perSegmentStart` / `perSegmentEnd` / `minGap` / `scale`） |
| スプレーの粒・霧・音 | `spray`（`jet*` / `mist*` / `decal*` / `sound*`） |
| 被弾の判定（粒の濃さ） | `spray.hitHeightRange` / `hitRadius` / `hitThreshold` / `hitTimeLimit` |
| ジャンプ・飛行・羽・飛行ゲージ | `cockroach`（`jumpHeight` / `gravity` / `fly*` / `wing*` / `hindWing*`） |
| カメラ・画角・ロール・揺れ | `camera` |
| 速度演出（筋・「50 m!」） | `speedFx` |

開発サーバー（`npm run dev`）では、ブラウザのコンソールから `__game`（ゲーム本体）と `__CONFIG`（調整値）を触れます。

## ファイル構成

| パス | 内容 |
|---|---|
| index.html | 画面（HUD・タイトル・ゲームオーバー・スティック）の HTML と CSS |
| src/main.js | エントリーポイント |
| src/game/config.js | 調整用の定数すべて |
| src/game/game.js | ゲーム全体（シーン・状態遷移・メインループ） |
| src/game/input.js | キーボード＋タッチスティック＋ジャンプ（スペース・画面タップ）の入力 |
| src/game/room.js | どこまでも続く部屋（セグメントを再利用） |
| src/game/obstacles.js | 床の障害物（プール化して部屋の再利用に合わせて置き直す・押し出しの当たり判定） |
| src/game/cockroach.js | ゴキブリ（移動・ジャンプ・飛行・羽・歩行アニメ・衝突・死亡演出） |
| src/game/humans.js | 人間 5 人（追跡・突進・歩行アニメ・視界を遮るときの半透明化） |
| src/game/spray.js | スプレー（噴射タイミング・狙い点・ジェット／霧の粒・床の跡・当たり判定） |
| src/game/audio.js | スプレーの音（Web Audio）とミュート |
| src/game/speedfx.js | 速く走るときに床を流れる筋 |
| src/game/hud.js | HUD・各種画面の表示切り替え・「50 m!」表示・ミュートボタン |
| public/models/ | ゲーム用モデル（.glb） |
| assets/models/ | Blender の編集用データ（.blend） |
| tools/blender/ | モデルの書き出しスクリプト |

## ランキング

- 進んだ距離で順位を決める
- 新記録を出したときに、名前を入力して登録する
- ログインは不要
- どの端末・どのサーバーから遊んでも同じランキングを共有する（外部のデータベースに保存。候補は Supabase）

## 技術構成

| 用途 | 使うもの |
|---|---|
| 3D モデル（ゴキブリ・人間） | Blender（Claude Code から Blender MCP 経由で作成）→ glTF（.glb）で書き出し |
| ゲーム本体 | ブラウザで動く Three.js（素の JavaScript）＋ Vite |
| ランキングの保存先 | Supabase（予定） |

## 3D モデル

| ファイル | 内容 |
|---|---|
| [assets/models/cockroach.blend](assets/models/cockroach.blend) | ゴキブリの編集用データ（Blender） |
| [public/models/cockroach.glb](public/models/cockroach.glb) | ゴキブリのゲーム用データ（Three.js で読み込む） |
| [assets/models/human.blend](assets/models/human.blend) | 人間の編集用データ（Blender） |
| [public/models/human_1.glb](public/models/human_1.glb)〜[human_5.glb](public/models/human_5.glb) | 人間のゲーム用データ 5 体分（服の色違い。Three.js で読み込む） |
| [tools/blender/export_humans.py](tools/blender/export_humans.py) | 人間を色違いで 5 体分書き出すスクリプト（色の一覧もここにある） |

ゴキブリのモデルの仕様：

- 実寸で作っている（胴体の長さ約 5 cm、脚・触角を含めて約 7.5 × 8.7 cm、背中までの高さ約 1.6 cm）
- 頭が Blender の +Y 方向。Three.js に読み込むと -Z 方向が前になる
- 脚 6 本（`Leg_L1`〜`Leg_L3`・`Leg_R1`〜`Leg_R3`）と触角 2 本（`Antenna_L`・`Antenna_R`）は別パーツで、付け根を回転の中心にしている。ゲーム側でパーツごとに回して歩く動きを付ける想定

人間のモデルの仕様：

- 実寸で作っている（身長約 1.75 m）。向きはゴキブリと同じく Blender の +Y が正面
- 右手に殺虫スプレー缶（`Spray_Can`）を持ち、腕を斜め下に伸ばして前方約 1 m の床にスプレーを向けたポーズ
- 髪型はマッシュ
- 脚 2 本（`Leg_L`・`Leg_R`、付け根は股関節）と腕 2 本（`Arm_L`・`Arm_R`、付け根は肩）は別パーツ。歩く動きやスプレーを向ける動きはゲーム側で回して付ける
- `Spray_Nozzle` はスプレーの噴射口の位置を示す目印（右腕の子）。ゲーム側でここからスプレーを出す
- 服の色はマテリアル `Human_Shirt`・`Human_Pants`・`Human_Shoes`・`Human_Hair` に分けていて、5 体それぞれ色が違う

| ファイル | シャツ | パンツ | 靴 | 髪 |
|---|---|---|---|---|
| human_1.glb | グレー | ジーンズ | 白 | こげ茶 |
| human_2.glb | 赤 | 黒 | 黒 | 黒 |
| human_3.glb | 緑 | ベージュ | 茶色 | 茶色 |
| human_4.glb | 紺 | グレー | 白 | 明るい茶色 |
| human_5.glb | 黄色 | 黒デニム | 水色 | こげ茶 |

人間のモデルを直したら、human.blend を開いた Blender で [tools/blender/export_humans.py](tools/blender/export_humans.py) を実行して 5 体分を書き出し直す（色を変えたいときはスクリプト内の `PALETTE` を編集する）。

human.blend では、1 人目（`Human`）の横に 2〜5 人目が並んで表示される（`Preview_Lineup` コレクション）。形は 1 人目と共有しているので、1 人目を直せば全員に反映される。並んだ人は確認用で、書き出しには含まれない。色を変えたあとはスクリプトを実行すると並びも作り直される。

## 開発環境の準備

### Blender MCP

Claude Code から Blender を操作してモデルを作るための設定です。

1. 必要なもの：Blender（3.0 以上）、[uv](https://docs.astral.sh/uv/)（`uvx` コマンドを使う）
2. Claude Code 側の設定はプロジェクト直下の [.mcp.json](.mcp.json) に登録済み（`uvx blender-mcp` を起動）
3. Blender 側にアドオンを入れる
   1. ターミナルで `uvx mcp-for-blender install-addon` を実行する（Blender のアドオンフォルダにインストールされる。更新するときも同じコマンド）
   2. Blender の **編集 > プリファレンス > アドオン**（⌘ + ,）で「MCP」を検索し、「MCP for Blender」にチェックを入れて有効にする
4. 3D ビューで **N キー** を押し、サイドバーの **MCP for Blender** タブで **Connect to MCP server** を押す（接続中はボタンが **Disconnect** に変わる）
5. Claude Code を起動し、`/mcp` で `blender` サーバーが接続されていることを確認する

アドオンを更新したあとは、Blender を再起動するか、アドオンのチェックを外して入れ直してから、もう一度 **Connect to MCP server** を押す。
