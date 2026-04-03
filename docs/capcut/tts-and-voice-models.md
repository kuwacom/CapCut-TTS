# TTS と音声モデル

## 1. 現在の TTS 経路

今回の確認できた TTS 実行経路は少なくとも 2 つあります

### A. multi_platform 直取得系

- endpoint:
  - `POST /storyboard/v1/tts/multi_platform`
- 特徴:
  - 音声 URL を直接返す
  - もっともシンプル
  - 現在の実装では第一候補

### B. editor intelligence task 系

- endpoint:
  - `POST /lv/v2/intelligence/create`
  - `POST /lv/v2/intelligence/query`
- 特徴:
  - task id を作って poll する
  - editor 内部フローに近い
  - 現在の実装ではフォールバック

## 2. multi_platform フロー

### endpoint

```text
POST https://edit-api-sg.capcut.com/storyboard/v1/tts/multi_platform
```

### body 例

```json
{
  "texts": ["アフレコの作成へようこそ"],
  "tts_conf": {
    "speaker": "ICL_en_female_jiaoao",
    "rate": 1,
    "volume": 100,
    "name": "ラベベさん",
    "platform": "sami",
    "effect_id": "7530105822785899777",
    "resource_id": "7530105822785899777",
    "is_clone": false
  },
  "need_url": true
}
```

### response の要点

- `data.tts_materials[].meta_data.url`

ここに直接音声 URL が入る

## 3. intelligence task フロー

### create

```text
POST /lv/v2/intelligence/create
```

#### body 例

```json
{
  "workspace_id": "<workspace_id>",
  "smart_tool_type": 39,
  "scene": 3,
  "params": "{\"text\":\"こんにちは！！\",\"platform\":1}",
  "req_json": "{\"speaker\":\"ICL_en_female_jiaoao\",\"audio_config\":{},\"disable_caption\":true,\"commerce\":{\"resource_type\":\"material_artist\",\"benefit_type\":\"resource_export\",\"resource_id\":\"7530105822785899777\"}}"
}
```

### query

```text
POST /lv/v2/intelligence/query
```

#### body 例

```json
{
  "task_id": "<task_id>",
  "workspace_id": "<workspace_id>",
  "smart_tool_type": 39
}
```

### 完了時の見どころ

- `data.status === 2`
- `data.task_detail[0].url`
- `data.task_detail[0].transcode_audio_info[0].url`

## 4. 音声モデル取得

### 共通 endpoint

```text
POST /artist/v1/effect/get_resources_by_category_id
```

### 共通 body 形

```json
{
  "panel": "tone",
  "category_id": 21699,
  "category_key": "21699",
  "panel_source": "heycan",
  "pack_optional": {
    "need_tag": true,
    "need_thumb": true,
    "thumb_opt": "{\"is_support_webp\":1}",
    "image_pack_param": {
      "icon_limit": {
        "static_format": "webp",
        "dynamic_format": "awebp",
        "width": 100,
        "height": 100
      }
    }
  },
  "offset": 0,
  "count": 200
}
```

## 5. 全カテゴリ

`tmp/www.capcut.com-音声-カテゴリ-全て.har` から、少なくとも次のカテゴリ取得通信を確認しました

- `30316`
- `2037708790`
- `21699`
- `36155`
- `33084`
- `2037707014`
- `33082`
- `21782`
- `33083`
- `33085`

現在の実装では、これらを全件取得して 1 つの音声モデル一覧へ統合しています

## 6. speaker と resource_id

各音声モデルで最低限必要なのは次の 3 つです

- `speaker`
- `effect_id`
- `resource_id`

### speaker の取得

HAR では `extra` または `biz_extra` 内の `tonetype` に voice_type が埋まっていました

例

```json
{
  "voice_type": "ICL_ja_female_laopopo"
}
```

### resource_id の取得

通常は `common_attr` 側から取得できる

## 7. `type` の後方互換

もともとのこのプロジェクトは `type=<数字>` で音声を切り替えていたため、現在もその互換を維持しています

### 現在の解決順

1. `voice` が明示されていればそちらを優先
2. `type` が数値なら旧来の index として扱う
3. `type` が数値文字列なら旧来の index として扱う
4. `type` が文字列なら次を順に照合する
   - `speaker id`
   - `resourceId`
   - `effectId`
   - `title`
   - 既知 alias

### 例

```text
?type=0
?type=13
?type=ICL_ja_female_laopopo
?type=7522976550736710913
?type=魔婆
```

## 8. `/v1/models` の考え方

現在の `/v1/models` は、CapCut 側から取得した音声一覧を内部 `VoicePreset` へ変換し、重複を除いて返している

返却フィールド

- `id`
- `title`
- `description`
- `speaker`
- `effectId`
- `resourceId`

## 9. 現行実装との対応

- `src/models/capcutVoiceCategories.ts`
  全カテゴリ一覧
- `src/models/capcutVoiceModels.ts`
  既知フォールバック音声と alias
- `src/lib/capcut/voiceUtils.ts`
  voice item の変換、モデル一覧化、`type` 解決
- `src/services/CapCutService.ts`
  全カテゴリ取得と TTS 実行の orchestration

## 10. 旧フローとの違い

旧プロジェクトでは `type=番号` → `speaker` への固定マッピングが中心だった

現行の CapCut Web では

- カテゴリが複数ある
- voice 数が多い
- `speaker` と `resource_id` の両方が必要
- `multi_platform` と `intelligence` の複数実行経路がある

ため、静的な番号配列だけでは追従しきれません

そのため現行実装では

- 動的にカテゴリ横断で voice 一覧を取得する
- ただし旧番号互換は残す

という方針を取っています
