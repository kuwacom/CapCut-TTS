# What is this
CapCut の読み上げAPIのセルフホストRapperAPIです

# NEWS
### 2024/02/07
> **2024/02/07 時点でAPIのバージョンが変わり新規に取得した `SIGN` 及び `DEVICE_TIME` を利用したtokenの生成ができなくなりました。** <br>
現在新しくtokenを取得する方法を準備中です。

# How To Use
envもしくは環境変数の

```
DEVICE_TIME=""
SIGN=""
```
それぞれに以下の画像のように取得した値を入れてください

![Test Image](/images/capcut.png)

画像にある`token`へのリクエストは、合成音声を**初回生成時**もしくは時間がたってtokenが無効になった際にリクエストされます。

取得する際には開発ツールを開いてから合成音声の生成をしてください。