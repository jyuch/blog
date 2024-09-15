---
title: Docker Buildxでもキャッシュしたい
description: Docker Buildxでのキャッシュについての解説です
date: 2024-09-14
lastModified: 2024-09-14
tags: 
  - docker
---

# はじめに

しばらくぶりにDockerに触ったらなんかいろいろとキャッシュ周りが変わっていたのでそれについてです。

# Buildx

どうも最近のDockerはMoby BuildKitを`docker`コマンドから透過的に扱えるようになったようです。
そして、BuildKitをDockerから使うための拡張がBuildxです。

BuildKit君はいい感じにキャッシュを扱えるようなので、その辺を確認してみましょう。

# パッケージマネージャ

## APT

昔は`apt-get`コマンドを鬼のように`&&`で連結して、最後に`rm -rf /var/lib/apt/lists/*`でキャッシュファイルを消し飛ばしてイメージをコンパクションするのがノウハウでした。

そうすると、イメージサイズは小さくなりますが毎回パッケージをダウンロードしてくることになるので、ビルド時間が伸びるという欠点がありました。

BuildKitは特定のディレクトリをキャッシュとしてマウントすることで、イメージの再ビルド時にそのディレクトリを復元することができます。

```Dockerfile
FROM debian:bookworm

RUN rm -f /etc/apt/apt.conf.d/docker-clean; \
    echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' \
      > /etc/apt/apt.conf.d/keep-cache

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      sl;
```

`apt-get`のタイミングでリポジトリキャッシュを`cache`タイプでマウントしています。
こうすることで2回目以降は普通の`apt`のようにパッケージキャッシュを使ってくれるようです。

ところで、初段のステージで`/etc/apt/apt.conf.d/docker-clean`を消し去ってますね。

Dockerだとキャッシュが刺さってイメージが肥大化するから`apt`の最後にキャッシュを消し飛ばすようにしている設定ファイルのようです。

じゃあ何すか

`rm -rf /var/lib/apt/lists/*`は無駄だったって事すか

## DNF

DNF君も基本的には同じです。

Amazon Linux 2023のベースイメージではダウンロードキャッシュをしないようにしていたので、ダウンロードキャッシュをする設定を挟んでから`dnf install`します。

```Dockerfile
FROM amazonlinux:2023

RUN echo "keepcache=True" >> /etc/dnf/dnf.conf

RUN --mount=type=cache,target=/var/cache/dnf \
    --mount=type=cache,target=/var/lib/dnf \
    dnf install -y \
      gcc gcr lvm2 clang
```

## YUM

CentOS7がEoLを迎えてもう`yum`コマンドを打つ機会はない。そんなふうに考えていた時期が俺にもありました

AWS Lambdaの（少なくともPython）のベースイメージがAmazon Linuxが2なんですよね。

```Dockerfile
FROM amazonlinux:2

RUN sed -i -e 's/keepcache=0/keepcache=1/' /etc/yum.conf

RUN --mount=type=cache,target=/var/cache/yum \
    yum install -y \
      gcc gcr lvm2 clang
```

# ビルドシステム

## Rust

ビルド激重Rust君です。

```Dockerfile
FROM rust:1.81.0-slim AS build

WORKDIR /app

RUN --mount=type=bind,source=src,target=src \
    --mount=type=bind,source=Cargo.toml,target=Cargo.toml \
    --mount=type=bind,source=Cargo.lock,target=Cargo.lock \
    --mount=type=cache,target=/app/target/ \
    --mount=type=cache,target=/usr/local/cargo/git/db \
    --mount=type=cache,target=/usr/local/cargo/registry \
    set -eux; \
    cargo build --locked --release; \
    cp ./target/release/hello_rust /bin/hello_rust

FROM debian:stable-slim AS final
COPY --from=build /bin/hello_rust /bin/hello_rust
ENTRYPOINT ["/bin/hello_rust"]
```

ソース類は`bind`でマウントしてしまえばそもそもビルドステージへの転送すら不要なようです。

あとはcargoのパッケージキャッシュとビルドキャッシュを`cache`でバインドすれば余計なパッケージの再取得やリビルドが走りません。

あとはいつものように最終的なイメージをビルドしているステージに成果物を送り込めば完了です。

## Python

最近触っているのでまぁ一応Pythonも確認してみましょう。

```Dockerfile
FROM python:3.12-bookworm

RUN --mount=type=bind,source=requirements.txt,target=requirements.txt \
    --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

COPY main.py .

CMD ["python", "main.py"]
```

Rustと同じようにパッケージマネージャのキャッシュをそのまま`cache`でマウントするだけです。

おわり