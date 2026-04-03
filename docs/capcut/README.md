# CapCut 調査メモ

## 目的

このディレクトリは、2026-03-30 に取得した通信ログと検証をもとに、CapCut Web の実装スタック、認証、セッション維持、TTS 実行、音声モデル取得の仕組みを整理したものです

この調査は、CapCut-TTS 側の実装を旧 `token + websocket` フローから、現行の `email/password + session cookie` ベースのフローへ寄せるために行いました

## 参照した一次資料

- `tmp/www.capcut.com-アカウント作成.har`
- `tmp/www.capcut.com-音声生成.har`
- `tmp/www.capcut.com-音声-カテゴリ取得.har`
- `tmp/www.capcut.com-音声-カテゴリ-全て.har`
- `tmp/memo.txt`
- `tmp/capcut-auth.txt`

## この調査で分かった大枠

- CapCut Web の認証は `login-row.www.capcut.com` / `login.us.capcut.com` の passport API が担当する
- ログイン後の本体 API は `edit-api-sg.capcut.com` に集約される
- TTS 実行は少なくとも 2 系統あり、現在は `storyboard/v1/tts/multi_platform` がもっとも素直
- editor 上の別系統として `lv/v2/intelligence/create` → `lv/v2/intelligence/query` も使われている
- 旧実装の `common/tts/token + sami websocket` は、今回では主経路として使われていない
- bundle 由来の設定値は HAR または live アクセスから抽出し、`capcut-bundle-config.json` に保存して再利用できる

## 実装スタックの見取り図

### 1. Web フロント

- ホスト: `https://www.capcut.com`
- 主要静的アセット: `https://sf16-web-login-neutral.capcutstatic.com/...`
- login/account SDK: `npm.byted-sdk.account-api.*.js`
- bot / risk SDK: `webmssdk_cctbc`, `window.byted_acrawler`

### 2. 認証レイヤ

- primary login host: `https://login-row.www.capcut.com`
- fallback login host: `https://login.us.capcut.com`
- 役割:
  - region 解決
  - email/password login
  - account info
  - auth broadcast

### 3. 本体 API

- host: `https://edit-api-sg.capcut.com`
- 役割:
  - workspace 情報
  - 音声モデル取得
  - TTS 実行
  - editor intelligence task

### 4. 音声配信 / 保存先

- 直接配信 URL:
  - `https://v16-cc.capcut.com/...`
  - `https://video-sg.tiktok-row.net/...`
- Evercloud / origin 配信:
  - `https://sg-gcp-media.evercloud.capcut.com/...`
  - `https://sg-gcp.evercloud.capcut.com/...`

## ドキュメント一覧

- [authentication-and-session.md](./authentication-and-session.md)
  CapCut Web の認証、verifyFp、Cookie、session 維持、sign まわり
- [tts-and-voice-models.md](./tts-and-voice-models.md)
  TTS 実行フロー、音声カテゴリ、モデル取得、`type` 互換の考え方

## 調査時点の重要な結論

### bundle 設定キャッシュ

- `capcut-bundle-config.json` は、CapCut Web の bundle から抽出した設定値の保存先
- 保存対象は endpoint path、version、sign recipe、音声カテゴリ ID など
- キャッシュが有効な間は、毎回 CapCut のページへアクセスして bundle を再取得しなくてもよい
- キャッシュファイルが存在しない場合や期限切れの場合は、live で bundle を再取得して更新する
- `npm run capcut:extract` は HAR からこのファイルを作る補助手段であり、通常運用の必須要件ではない

### 認証

- `email/password` の login endpoint は `POST /passport/web/email/login/`
- `email` と `password` は平文送信ではなく、UTF-8 bytes を `XOR 5` して hex 化される
- `mix_mode=1` と `fixed_mix_mode=1` が付く
- `verifyFp` は固定値ではなく、フロントがその場で生成する識別子
- `did` は `_tea_web_id` cookie を使うのが安定

### セッション

- login 成功後は cookie セッションで各 API を呼ぶ
- 主要 cookie:
  - `_tea_web_id`
  - `ttwid`
  - `passport_csrf_token`
  - `passport_csrf_token_default`
  - `sessionid`
  - `sessionid_ss`
  - `sid_guard`
  - `sid_tt`
  - `uid_tt`
  - `store-country-code`
  - `store-idc`
- セッション切れ時は `check login error` が返ることがある

### TTS

- 現状の第一候補は `POST /storyboard/v1/tts/multi_platform`
- 第二候補として `POST /lv/v2/intelligence/create` と `POST /lv/v2/intelligence/query`
- 音声モデルは `POST /artist/v1/effect/get_resources_by_category_id`

## 注意

- HAR には認証情報や署名付き URL が含まれることがあるので、取り扱いには注意する
- CapCut 側の bot / risk 制御により、同一アカウントや同一環境での login は短時間に失敗することがある
- 2026-03-30 時点の調査結果なので、将来的に挙動が変わる可能性がある
