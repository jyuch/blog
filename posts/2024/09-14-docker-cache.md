---
title: Docker Buildxでもキャッシュしたい
description: Docker Buildxでのキャッシュについての解説です
date: 2024-09-14
lastModified: 2024-09-14
tags: 
  - docker
  - linux
  - rust
  - python
---

# はじめに

しばらくぶりにDockerに触ったらなんかいろいろとキャッシュ周りが変わっていたのでそれについてです。

# Buildx

どうも最近のDockerはMoby BuildKitを`docker`コマンドから透過的に扱えるようになったようです。

そのBuildKitをDockerから使うための拡張がBuildxのようです。

BuildKit君はいい感じにキャッシュを扱えるようなので、その辺を確認してみましょう。

# apt

昔は`apt-get`コマンドを鬼のように`&&`で連結して、最後に`rm -rf /var/lib/apt/lists/*`でキャッシュファイルを消し飛ばしてイメージをコンパクションしていましたが、最近は違うようです。

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
中身が気になったので確認してみました。

> Dockerだとキャッシュが刺さってイメージが肥大化するから`apt`の最後にキャッシュを消し飛ばすようにしといたからね

だそうです。

原文が読みたかったら

```bash
docker run -it --rm debian:bookworm cat /etc/apt/apt.conf.d/docker-clean
```

で読めるので、こちらからどうぞ

# Rust

次はビルド激重Rust君です。

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

# Python

最近触っているのでまぁ一応Pythonにも触れておきます。

```Dockerfile
FROM python:3.12-bookworm

RUN --mount=type=bind,source=requirements.txt,target=requirements.txt \
    --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

COPY main.py .

CMD ["python", "main.py"]
```

Rustと同じようにパッケージマネージャのキャッシュをそのまま`cache`でマウントするだけです。

そもそも素の`python:3.12-bookworm`が1GBある時点でまぁ、その、ねぇ・・・

おわり