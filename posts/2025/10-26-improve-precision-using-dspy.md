---
title: DSPyを使用してLLMを使ったレシートの読み取り精度を向上させたい
description: 安価なマルチモーダルLLMを使用したレシートの読み取り精度をDSPyを使用して改善するお話です。
date: 2025-10-26
lastModified: 2025-10-26
tags: 
  - python
  - gen-ai
  - databricks
---

## はじめに

簡単な家計簿をつけているのですが、レシートの内容を確認して転記するのがめんどくさいなと感じていました。

そこで、LLMを使って情報を抽出できないかなと考えていたのですが、せっかくなら[DSPy](https://dspy.ai/)を使って構造化出力するのと、プロンプト最適化を行ってみたいなということで試してみました。

## シグネチャの準備

DSPyでは入力値と出力値をコードとして表現します。
ここではレシート画像から購入日と合計金額を抽出することにします。

入力値と出力値はシグネチャとして表現され、`dspy.Signature`のサブクラスとして実装します。

```python
from datetime import date

import dspy


class ExtractReceiptInfo(dspy.Signature):
    """Extract total amount from receipt image."""

    image: dspy.Image = dspy.InputField(desc="Receipt image.")
    purchase_date: date = dspy.OutputField(desc="Purchase date of payment.")
    total_amount: int = dspy.OutputField(desc="Total amount of payment.")


class ReceiptExtractor(dspy.Module):
    def __init__(self):
        super().__init__()
        self.extractor = dspy.ChainOfThought(ExtractReceiptInfo)

    def forward(self, image):
        return self.extractor(image=image)


def extraction_metric(gold, pred, trace=None):
    metric = 0

    if gold.total_amount == pred.total_amount:
        metric += 1
    if gold.purchase_date == pred.purchase_date:
        metric += 1

    if trace is None:
        return metric / 2.0
    else:
        return metric == 2
```

## 学習データの準備

DSPyでは教師データを使用して入力データから期待する出力をするようにプロンプトを最適化します。

そのため、最初にある程度のレシート画像と、その画像からどのような結果を出力してほしいかの期待値をひたすら列挙する必要があります。

ここでは、以下のような教師データを家中のあるだけのレシートを使って作成します。
スキャナでレシートを読み込み、エクセルでレシート画像と期待値の組み合わせをひたすら入力します。

このデータそのまま家計簿に突っ込めばよくね？とか考えてはいけません。

|image|purchase_date|total_amount|
|:-|-:|-:|
|20251019_000.jpg|2025-08-28|162|
|20251019_001.jpg|2025-08-19|170|
|20251019_002.jpg|2025-09-09|162|
|...|...|...|

## LM Studioの準備

タスクを実行するLLMはLM Studioを使ってローカルで実行するので、LM Studioをインストールしておきます。
モデルはGemma 3を使います。

## Databricks Free Editionの準備

MIPROv2では教師として高性能なLLMを使用するのですが、ここではDatabricksでホストされているLlama 4 Maverickを利用します。

Databricks Free Editionではレートリミットなどの制限はありますが、無償で使わせてくれるのでありがたく使います。Databricksさんはなんて太っ腹なんでしょう！（ステマその１）

Settings → User → Developer → Access tokensからトークンを発行しておきます。
また、MLFlowも使いたいので、併せてExperimentsも作成しておきます。
Experimentsを作成すると、外部からExperimentsを使うにはみたいな画面が表示されるので、表示された環境変数をコピーしておきます。

最終的に以下の環境変数を登録します。

|環境変数|例|
|:-|:-|
|`DATABRICKS_API_BASE`|`https://dbc-12345678-abcd.cloud.databricks.com/serving-endpoints`|
|`DATABRICKS_API_KEY`|Databricksのシークレット|
|`DATABRICKS_HOST`|`https://dbc-12345678-abcd.cloud.databricks.com`|
|`DATABRICKS_TOKEN`|Databricksのシークレット|
|`MLFLOW_EXPERIMENT_ID`|`123456789012345`|
|`MLFLOW_REGISTRY_URI`|`databricks-uc`|
|`MLFLOW_TRACKING_URI`|`databricks`|

`DATABRICKS_API_BASE`と`DATABRICKS_API_KEY`はDatabricksのServing endpointsにアクセスする用で、それ以外はMLFlowにメトリックを送る用です。

## トレーニング

必要なものがそろったらいよいよプロンプト最適化を実行します。
ここではとりあえずMIPROv2を使っていきます。

余談ですが、DSPyはLLMにアクセスするために[LiteLLM](https://www.litellm.ai/)というライブラリを使用しているようです。

LiteLLMではプレフィックスでどのプロバイダーのAPI形式（OpenAI互換やAnthropic互換など）を判断しているようです。
また、LM StudioはOpenAI互換です。

そのため、OpenAI互換としてAPIを叩いてほしいのですが、`openai/google/gemma-3-12b`とかいう各方面から怒られそうなモデル名で指定をしないといけません。

```python
import csv
import os
from datetime import datetime
from typing import List

import dspy
import mlflow

from program import ReceiptExtractor, extraction_metric

LMSTUDIO_API_BASE = os.environ["LMSTUDIO_API_BASE"]

teacher_llm = dspy.LM(
    "databricks/databricks-llama-4-maverick",
    temperature=1.0,
)

student_llm = dspy.LM(
    "openai/google/gemma-3-12b",
    api_base=LMSTUDIO_API_BASE,
    api_key="dummy",
)


def run_prompt_optimizer(train_examples: List[dspy.Example]):
    student_program = ReceiptExtractor()
    optimizer = dspy.MIPROv2(
        metric=extraction_metric, prompt_model=teacher_llm, task_model=student_llm
    )
    compiled_program = optimizer.compile(student_program, trainset=train_examples)
    compiled_program.save("./program.json", save_program=False)


def main():
    mlflow.dspy.autolog(
        log_compiles=True,
        log_evals=True,
        log_traces_from_compile=True,
    )

    dspy.configure(lm=student_llm)

    train_examples: List[dspy.Example]
    with open("./dataset/training.csv", encoding="utf_8") as f:
        reader = csv.DictReader(f)
        train_examples = [
            dspy.Example(
                image=dspy.Image.from_file(f"./dataset/{row['image']}"),
                purchase_date=datetime.strptime(
                    row["purchase_date"], "%Y-%m-%d"
                ).date(),
                total_amount=int(row["total_amount"]),
            ).with_inputs("image")
            for row in reader
        ]

    run_prompt_optimizer(train_examples)


if __name__ == "__main__":
    main()
```

## 評価

学習が終わったら、とりあえずどのくらい違うのか評価してみましょう。

ここでは、学習前と学習後、LLMのモデル、パラメータ数を変えてどのくらい差があるのかを確認しています。

```python
import csv
import os
from datetime import datetime
from typing import List

import dspy
from dspy.evaluate.evaluate import Evaluate

from program import ReceiptExtractor, extraction_metric

LMSTUDIO_API_BASE = os.environ["LMSTUDIO_API_BASE"]

gemma_3_12b = dspy.LM(
    "openai/google/gemma-3-12b",
    api_base=LMSTUDIO_API_BASE,
    api_key="dummy",
)

gemma_3_27b = dspy.LM(
    "openai/google/gemma-3-27b",
    api_base=LMSTUDIO_API_BASE,
    api_key="dummy",
)

llama_4_maverick = dspy.LM(
    "databricks/databricks-llama-4-maverick",
)


def main():
    dspy.configure(lm=gemma_3_12b)
    original = ReceiptExtractor()
    trained = ReceiptExtractor()
    trained.load("./program.json")

    train_examples: List[dspy.Example]
    with open("./dataset/training.csv", encoding="utf_8") as f:
        reader = csv.DictReader(f)
        train_examples = [
            dspy.Example(
                image=dspy.Image.from_file(f"./dataset/{row['image']}"),
                purchase_date=datetime.strptime(
                    row["purchase_date"], "%Y-%m-%d"
                ).date(),
                total_amount=int(row["total_amount"]),
            ).with_inputs("image")
            for row in reader
        ]

    evaluate = Evaluate(
        devset=train_examples, num_threads=1, display_progress=True, display_table=0
    )

    with dspy.context(lm=gemma_3_12b):
        evaluate(original, metric=extraction_metric)
        evaluate(trained, metric=extraction_metric)

    with dspy.context(lm=gemma_3_27b):
        evaluate(original, metric=extraction_metric)
        evaluate(trained, metric=extraction_metric)

    with dspy.context(lm=llama_4_maverick):
        evaluate(original, metric=extraction_metric)
        evaluate(trained, metric=extraction_metric)


if __name__ == "__main__":
    main()
```

|モデル|最適化前|最適化後|
|:-|-:|-:|
|`google/gemma-3-12`|84.0%|96.2%|
|`google/gemma-3-27b`|80.2%|97.2%|
|`databricks-llama-4-maverick`|100.0%|100.0%|

あー、うん、まぁ、ねぇ。

## おわりに

プロンプト最適化の部分については確かに最適化すれば性能は上がりましたが、最初から高性能なモデルを使えばそりゃ精度は高いよねというのを如実に見せつけられました。

ですが、個人的には構造化出力をコードとして表現できるのはうれしみがありますね。
プロンプトにJSON Schemaをくっつけて、出力をJSONパーサに食わせて正常にパース出来るのを祈るという作業から解放されるだけでもDSPyを使ううれしみがあると思います。

教師データだけ用意しておけば、他のLLMが出てきたときは最適化と検証のループを回して、今までよりも成績が良ければ入れ替えるというサイクルをほぼ自動で回せます。

ギョームでLLMを使う場合はこの辺のサイクルを回せるようにしておくと後々のつらみポイントを軽減出来ると思うので、みなさんDatabricksと合わせて使ってみてはいかがでしょうか。（ステマその２）

[jyuch / extract-receipt](https://github.com/jyuch/extract-receipt/tree/master)

おわり
