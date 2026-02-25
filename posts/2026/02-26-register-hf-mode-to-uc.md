---
title: Hugging FaceのSentence TransformersモデルをUnity Catalogに登録してServing endpointsにデプロイしたい
description: Hugging FaceのモデルをUnity Catalogに登録してServing endpointsに登録する方法を確認します。
date: 2026-02-25
lastModified: 2026-02-25
tags: 
  - databricks
---

## はじめに

大体タイトル通りです。

Databricksに最初から登録されている埋め込みモデルは英語のみで日本語に対応していないので、Serving endpointにデプロイするためにHugging Faceから好きなモデルを引っ張ってきてUnity Catalogに登録する方法を確認してみました。

ちなみにモデルを登録するだけなら以下のノートブックを使えば一発で登録できると思います。

[🤗HFのモデルをUCに登録する君](/img/2026/02-26-register-hf-mode-to-uc/register-hf-model-to-uc.html)

## 🤗HFのモデルをUCに登録する君

### 環境のセットアップ

ノートブックにServerlessコンピュートをアタッチして、以下のライブラリをインストールします。

MLflowのSentence Transformersを使用したいため、`mlflow[sentence-transformers]`を指定してインストールします。

- `mlflow[sentence-transformers]==3.9.0`
- `sentence-transformers==5.2.3`

今回はConfigurationのDependenciesから追加しましたが、たぶん`%pip`コマンドを使ってインストールして`dbutils.library.restartPython()`しても良いと思います。

### モデル名の入力とかスキーマの作成とか

このノートブックでは登録先のカタログ名とHugging Faceのモデル名をWidgetから受け付けます。

```python
dbutils.widgets.text("uc_catalog_name", "", "UC Catalog name")
dbutils.widgets.text("hf_model_name", "", "Hugging Face Model name")
```

登録先のスキーマ名とモデル名は入力されたHugging Faceモデルから組み立てています。

```python
UC_CATALOG_NAME = dbutils.widgets.get("uc_catalog_name")
HF_MODEL_NAME = dbutils.widgets.get("hf_model_name")
UC_SCHEMA_NAME = HF_MODEL_NAME.split("/")[0].replace("-", "_").replace(".", "_")
UC_MODEL_NAME = HF_MODEL_NAME.split("/")[1].replace("-", "_").replace(".", "_")
```

そうしたら登録先のスキーマを作成しておきます。

```python
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {UC_CATALOG_NAME}.{UC_SCHEMA_NAME}")
```

### MLflowへのモデルのロギング

Sentence Transformers経由でHugging Faceのモデルを取得し、[MLflowのSentence Transformersフレーバー](https://mlflow.org/docs/latest/ml/deep-learning/sentence-transformers/)を使用してモデルをロギングします。

```python
import mlflow
from sentence_transformers import SentenceTransformer
```

```python
mlflow.set_registry_uri("databricks-uc")
```

```python
model = SentenceTransformer(HF_MODEL_NAME)
```

```python
input_example = [
    "RFC 1034とRFC 1035は、Domain Name System（DNS）の基礎を定義する最も重要な仕様である。",
    "Paul Mockapetrisによって1987年に策定され、インターネットにおける名前解決の仕組み全体を規定している。",
]
```

```python
with mlflow.start_run():
    model_info = mlflow.sentence_transformers.log_model(
        model=model,
        name=UC_MODEL_NAME,
        input_example=input_example,
    )
```

ロギングされたモデルにはモデルの実行に必要なライブラリが含まれるのですが、たまに必要な依存関係が足りずにServing endpointsへのデプロイに失敗することがあるので、事前に一度モデルが動作することを確認します。

大体10分位掛かるので、気長に待ちましょう。

```python
mlflow.models.predict(
    model_uri=model_info.model_uri,
    input_data=input_example,
)
```

### Unity Catalogへの登録

モデルが正常に動作することが確認出来たらUnity Catalogへ登録して完了です。

```python
mlflow.register_model(
    model_info.model_uri, f"{UC_CATALOG_NAME}.{UC_SCHEMA_NAME}.{UC_MODEL_NAME}"
)
```

おわり
