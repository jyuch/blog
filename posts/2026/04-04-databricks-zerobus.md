---
title: Databricks Zerobus Ingestでサーバレスでリアルタイムにデータを流し込みたかった
description: Databricks Zerobus Ingestでデータを流し込みたかったのですが、デフォルトストレージではだめでした。
date: 2026-04-04
lastModified: 2026-04-4
tags: 
  - rust
  - databricks
---

## はじめに

ついにDatabricksのZerobus IngestがGAとなりました。

Preview版ではデフォルトストレージは対応していないとありましたが、GAになったタイミングでその表示が消えたので、Databricks Free Editionで試してみることにしました。

## テーブルの作成

Databricks上のテーブルからProtobufの定義を生成出来るようなので、まずはテーブルを作成します。

ここではひとまず私が必要そうなデータ型に絞ってテーブルを作成します。

```sql
CREATE OR REPLACE TABLE workspace.default.zerobus_sample (
    id INT,
    name STRING,
    create_at TIMESTAMP
);
```

## Protobufの定義生成

テーブルを作成したら、テーブル定義からProtbufの定義を生成します。

[Zerobus Ingest SDK](https://github.com/databricks/zerobus-sdk)に生成するためのツール（[generate_files](https://github.com/databricks/zerobus-sdk/tree/main/rust/tools/generate_files)）があるので、それを使って生成します。

ツールはサービスプリンシパル経由で触りに行くタイプなので、サービスプリンシパルを作成してシークレットを生成しておきます。

また、テーブル定義も触りに行く必要があるので、サービスプリンシパルに権限を振るのを忘れないようにして下さい。（1敗）

ツールはRustを使って実装されているので、Rustの処理系をあらかじめインストールしておきます。
あとは以下のコマンドで生成できます。

```sh
cargo run -- \
  --uc-endpoint "<your_uc_endpoint>" \
  --client-id "your-client-id" \
  --client-secret "your-client-secret" \
  --table "workspace.default.zerobus_sample"
```

## クライアントの実装

今回はRustで書いていきます。

必要なライブラリは以下の通りなのですが、[databricks-zerobus-ingest-sdk](https://crates.io/crates/databricks-zerobus-ingest-sdk)のprost系は`0.13`に依存しているので、prostだけは`0.13`を明示的に指定してインストールする必要があります。（1敗）

```toml
[dependencies]
# 必須
databricks-zerobus-ingest-sdk = "1.0.1"
prost = "0.13.5"
prost-types = "0.13.5"
tokio = { version = "1", features = ["full"] }
# お好みで
anyhow = "1"
chrono = "0.4"
```

あとは[公式のサンプル](https://github.com/databricks/zerobus-sdk/blob/main/rust/examples/proto/single/src/main.rs)をベースに簡単な書き込み処理を実装していきます。

```rust
use crate::samples::TableZerobusSample;
use databricks_zerobus_ingest_sdk::{
    ProtoMessage, StreamConfigurationOptions, TableProperties, ZerobusSdk, ZerobusStream,
};
use prost::Message;
use prost_types::{DescriptorProto, FileDescriptorSet};
use std::fs;

pub mod samples {
    include!("../output/zerobus_sample.rs");
}

const SERVER_ENDPOINT: &str = "<workspace id>.zerobus.<region>.cloud.databricks.com";
const DATABRICKS_WORKSPACE_URL: &str = "https://dbc-12345678-90ab.cloud.databricks.com";
const DATABRICKS_CLIENT_ID: &str = "00000000-0000-0000-0000-000000000000";
const DATABRICKS_CLIENT_SECRET: &str = "dose12345678901234567890123456789012";

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let descriptor_proto = load_descriptor(
        "output/zerobus_sample.descriptor",
        "zerobus_sample.proto",
        "table_zerobus_sample",
    );

    let table_properties = TableProperties {
        table_name: "workspace.default.zerobus_sample".to_string(),
        descriptor_proto: Some(descriptor_proto),
    };

    let stream_configuration_options = StreamConfigurationOptions {
        max_inflight_requests: 100,
        // RecordType::Proto is the default.
        ..Default::default()
    };

    let sdk_handle = ZerobusSdk::builder()
        .endpoint(SERVER_ENDPOINT)
        .unity_catalog_url(DATABRICKS_WORKSPACE_URL)
        .build()?;

    let mut stream = sdk_handle
        .create_stream(
            table_properties.clone(),
            DATABRICKS_CLIENT_ID.to_string(),
            DATABRICKS_CLIENT_SECRET.to_string(),
            Some(stream_configuration_options),
        )
        .await?;

    ingest_with_offset_api(&mut stream).await?;

    stream.close().await?;
    println!("Stream closed successfully");
    Ok(())
}

/// Recommended API: returns offset directly after queuing.
async fn ingest_with_offset_api(stream: &mut ZerobusStream) -> anyhow::Result<()> {
    println!("=== Offset-based API (Recommended) ===");

    let now = chrono::Utc::now().timestamp();

    // 1. Auto-encoding: ProtoMessage - pass message directly, SDK handles encoding.
    let order = TableZerobusSample {
        id: Some(1),
        name: Some("test".to_string()),
        create_at: Some(now),
    };

    let offset_id = stream.ingest_record_offset(ProtoMessage(order)).await?;
    println!("[Auto-encoding] Record sent with offset ID: {}", offset_id);
    stream.wait_for_offset(offset_id).await?;
    println!(
        "[Auto-encoding] Record acknowledged with offset ID: {}",
        offset_id
    );

    Ok(())
}

// Load descriptor from generated files
fn load_descriptor(path: &str, file: &str, msg: &str) -> DescriptorProto {
    let bytes = fs::read(path).expect("Failed to read descriptor");
    let file_set = FileDescriptorSet::decode(bytes.as_ref()).unwrap();

    let file_desc = file_set
        .file
        .into_iter()
        .find(|f| f.name.as_deref() == Some(file))
        .unwrap();

    file_desc
        .message_type
        .into_iter()
        .find(|m| m.name.as_deref() == Some(msg))
        .unwrap()
}
```

実装できたら早速実行してみましょう。

```txt
Unsupported table kind. Tables created in default storage are not supported. Error Code: 4024, Error State: 0.
```

無慈悲

## おわりに

[Zerobus Ingest connector limitations - Workspace and Target table](https://docs.databricks.com/aws/en/ingestion/zerobus-limits#workspace-and-target-table)

書いてある場所が移動しただけで、使えないんすね。

Free EditionでもS3を外部ロケーションとして登録してカタログをそっちに作成すれば使えるとは思いますが・・・

おわり
