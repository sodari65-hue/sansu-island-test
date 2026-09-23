# 問題データの形式

## ファイルの置きかた

```
data/
├─ curriculum.json         … 学年×領域の単元一覧（unit はここから選ぶ）
├─ questions/g1-A.json 〜 g6-D.json   … 敵の問題（24ファイル・各30問）
└─ quests/g1.json 〜 g6.json          … プロジェクト型クエスト（各学年2本）
```

ファイル名の `g5-C` は「5年・C領域」。領域の記号は学習指導要領にそろえる。

| 記号 | 1〜3年 | 4〜6年 |
|---|---|---|
| A | 数と計算 | 数と計算 |
| B | 図形 | 図形 |
| C | 測定 | 変化と関係 |
| D | データの活用 | データの活用 |

## 敵の問題（questions/）

```json
{
  "grade": 5, "domain": "C", "domainName": "変化と関係",
  "questions": [
    {
      "id": "g5-C-001",
      "unit": "割合",
      "level": 2,
      "type": "choice",
      "text": "もとにする{量|りょう}が{2|に}{倍|ばい}になると、{割合|わりあい}はどうなる？",
      "choices": ["2倍になる", "半分になる", "変わらない"],
      "answer": 1,
      "hint": "くらべる量が同じなら、もとが大きいほど割合は小さくなるよ。",
      "status": "draft"
    }
  ]
}
```

| キー | 意味 |
|---|---|
| `id` | `g{学年}-{領域}-{通し番号3桁}`。重複禁止 |
| `unit` | curriculum.json にある単元名 |
| `level` | 敵の強さ 1〜3（1=雑魚 / 2=ふつう / 3=手ごわい） |
| `type` | `choice`（選択）または `number`（数値入力） |
| `text` | 問題文。ふりがなは `{漢字|よみ}` |
| `choices` | `choice` のときだけ。2〜4個 |
| `answer` | `choice` は選択肢の番号（0から数える） / `number` は答えの数 |
| `unitLabel` | `number` のとき、入力欄の後ろに出す単位（例 `cm`）。なければ省略 |
| `hint` | 1回まちがえたときに出す一言 |
| `status` | `draft`（AI下書き）→ `checked`（先生確認ずみ）。ゲームには `checked` だけを出す |

## クエスト（quests/）

プロジェクト型の課題。1本を3〜5分で終えられるよう、手順（step）に分ける。

```json
{
  "id": "q5-01",
  "grade": 5,
  "title": "{温泉|おんせん}{宿|やど}の{仕入|しい}れ{係|がかり}",
  "giver": "温泉宿のおかみ",
  "domain": "D",
  "units": ["平均"],
  "mission": "この課題で何を解決するのか（児童に見せる一文）",
  "intro": "場面の説明",
  "steps": [ ... ],
  "outro": "解決したあとのことば",
  "reward": { "coins": 60, "item": "ゆげのぼうし" },
  "status": "draft"
}
```

step の `kind` は4種類。

| kind | 何をする | 判定 |
|---|---|---|
| `select` | 選択肢から選ぶ（どのデータが必要か、など） | `answer`（番号） |
| `multi` | あてはまるものを**すべて**選ぶ | `answer`（番号の配列） |
| `input` | 数を入力する | `answer`（数）／`tolerance` で許容誤差 |
| `order` | ならべかえる | `answer`（正しい順の番号の配列） |

各 step には `prompt`（問い）、必要なら `dataTable`（表）、`hint`、`feedback`（正解後に出す一言）を持たせる。

## 点検

```bash
node tools/validate.mjs
```

形式の誤り・ID の重複・答えの範囲外・選択肢の数・ふりがな記法の壊れを調べる。

## 先生の確認

`check.html` をブラウザで開くと、問題を1問ずつ見て `checked` に切り替えられる。
判定は端末の中（localStorage）にたまり、「書き出す」で JSON をダウンロードできる。
