---
title: RustでもOTLPでJaegerにテレメトリを送りたい
description: RustでもOTLPでJaegerにテレメトリを送りたい
date: 2023-09-18
lastModified: 2023-09-18
tags: 
  - rust
  - otlp
---

# はじめに

テキストベースのロギングは時代遅れ、時代はOpenTelemetryを使ったハイカラな計装！！ということでタイトル通りに試してみます。

とはいってもRust関係でまとまった記事を書いてくださってるのは以下のブログくらいみたいなので、とりあえずは以下の記事を参考に試してみます。

[RustでOpenTelemetryをはじめよう](https://blog.ymgyt.io/entry/starting_opentelemetry_with_rust/)

# OpenTelemetry

OpenTelemetryはそれぞれの監視ツールベンダが提供してきたAPIを共通化し、アプリケーションコードから可能な限りベンダ固有のコードを除去することを目的としてる。と個人的に認識しています。

例えばNew RelicからAWS X-Rayに監視バックエンドを変更しようとした際、OpenTelemetryを使用していればアプリケーションのコネクタ部分だけ変えればすぐにメトリクスの送信先を変えられるといった感じらしいです。

今回はシングルバイナリでサクッと建てられる[Jaeger](https://www.jaegertracing.io/)を使います。

```bat
setlocal

set BASE_DIR=%~dp0

set SPAN_STORAGE_TYPE=badger
set BADGER_EPHEMERAL=false
set BADGER_DIRECTORY_VALUE=C:\path\to\.jaeger\data
set BADGER_DIRECTORY_KEY=C:\path\to\.jaeger\key

start http://localhost:16686 
call %BASE_DIR%jaeger-all-in-one.exe

endlocal
```

みたいなバッチを作っておくとサクッと立ち上げられるので便利です。

# tracingの初期化

今回はトレーシングライブラリとして[tokio-rs/tracing](https://github.com/tokio-rs/tracing)を使用します。

tracingのレイヤーとしてOpenTelemetryのテレメトリを送信するControllerを差し込みます。

tracing自体はtokioには依存せず使用できますが、テレメトリの送信にgRPCを使用しており、gRPCがtonicを使用しているため自動的にtokioに依存することになります。
が、そこそこの規模のアプリケーションを開発する場合ほぼtokioを使うことになると思うので特に気にしなくても良いと思います。

```rust
use opentelemetry::sdk::metrics::controllers::BasicController;
use opentelemetry_otlp::WithExportConfig;

pub(crate) struct OtelInitGuard();

impl Drop for OtelInitGuard {
    fn drop(&mut self) {
        opentelemetry::global::shutdown_tracer_provider();
    }
}

// https://github.com/open-telemetry/opentelemetry-rust/blob/d4b9befea04bcc7fc19319a6ebf5b5070131c486/examples/basic-otlp/src/main.rs#L35-L52
fn build_metrics_controller() -> BasicController {
    use opentelemetry::sdk::export::metrics::aggregation::cumulative_temporality_selector;
    use opentelemetry::sdk::metrics::selectors::simple::histogram;

    opentelemetry_otlp::new_pipeline()
        .metrics(
            histogram(Vec::new()),
            cumulative_temporality_selector(),
            opentelemetry::runtime::Tokio,
        )
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint("http://localhost:4317"),
        )
        .build()
        .expect("Failed to build metrics controller")
}

pub(crate) fn init_tracing(service: &'static str, version: &'static str) -> OtelInitGuard {
    use opentelemetry::sdk::trace::{RandomIdGenerator, Sampler};

    // Configure otel exporter.
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint("http://localhost:4317"),
        )
        .with_trace_config(
            opentelemetry::sdk::trace::config()
                .with_sampler(Sampler::AlwaysOn)
                .with_id_generator(RandomIdGenerator::default())
                .with_resource(opentelemetry::sdk::Resource::new(vec![
                    opentelemetry::KeyValue::new("service.name", service),
                    opentelemetry::KeyValue::new("service.version", version),
                ])),
        )
        .install_batch(opentelemetry::runtime::Tokio)
        // .install_simple()
        .expect("Not running in tokio runtime");

    // Compatible layer with tracing.
    let otel_trace_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    let otel_metrics_layer = tracing_opentelemetry::MetricsLayer::new(build_metrics_controller());

    use tracing_subscriber::layer::SubscriberExt;
    use tracing_subscriber::util::SubscriberInitExt;

    tracing_subscriber::Registry::default()
        .with(tracing_subscriber::fmt::Layer::new())
        .with(otel_trace_layer)
        .with(otel_metrics_layer)
        .with(tracing_subscriber::filter::LevelFilter::INFO)
        .init();

    OtelInitGuard()
}
```

# アプリケーションコード

起動時にOpenTelemetryの初期化さえしてしまえば、あとは普通にtracingを使うだけです。

メソッドに`#[instrument]`を貼れば自動的にSpanを作ってコンテキストを埋め込んでくれるので便利です。

```rust
mod otl;

use crate::otl::init_tracing;
use tracing::{error, info, instrument};

#[instrument]
async fn start(x: i32, y: i32) -> Option<i32> {
    add(multiply(x, y).await, multiply(x, y).await).await
}

#[instrument]
async fn add(x: i32, y: i32) -> Option<i32> {
    let ans = x + y;

    if ans <= 10 {
        info!(
            ans = ans,
            "特に出すべきログがないからとりあえず適当なメッセージを出しています"
        );
        Some(ans)
    } else {
        error!(ans = ans, "something went wrong");
        None
    }
}

#[instrument]
async fn multiply(x: i32, y: i32) -> i32 {
    x * y
}

#[tokio::main]
async fn main() {
    let service = env!("CARGO_PKG_NAME");
    let version = env!("CARGO_PKG_VERSION");

    let _guard = init_tracing(service, version);

    let value = start(1, 2).await;
    println!("{:?}", value);

    let value = start(10, 22).await;
    println!("{:?}", value);
}
```

<img src="/img/09-08-rust-with-otlp/jaeger.png" style="max-width: 100%">

[jyuch/tracing_otlp](https://github.com/jyuch/tracing_otlp)
