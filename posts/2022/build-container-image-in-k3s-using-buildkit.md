---
title: k3sでもBuildKitを使用してイメージをビルドしたい
description: k3sでもBuildKitを使用してイメージをビルドしたい
date: 2022-11-12
tags: 
  - k8s
  - k3s
---

## はじめに

家で運用しているサーバ機~~をアップデートに失敗して吹き飛ばした~~とある事情で空いたので、k3sをインストールしました。

せっかく？なので、k3s上でイメージをビルドできるようにしておくとなんか捗りそうな気がするので方法を確認しておきます。

## Dockerfileの準備

とりあえずサクッとRustでマルチステージビルドを行うDockerfileを用意します。

[jyuch/rust-multistage-build](https://github.com/jyuch/rust-multistage-build)

```dockerfile
FROM rust:1.65.0-bullseye AS builder

ADD . /src
WORKDIR /src
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo build --release

FROM gcr.io/distroless/cc

COPY --from=builder /src/target/release/ferris_says ferris_says
CMD ["./ferris_says"]
```

とりあえずDockerのBuildKitでビルドできるか確認しておきます。

```sh
$ docker buildx build -t ferris_says:latest .
```

実行するとこんな感じです。

```sh
$ docker run --rm -it ferris_says:latest
 __________________________
< Hello fellow Rustaceans! >
 --------------------------
        \
         \
            _~^~^~_
        \) /  o o  \ (/
          '_   -   _'
          / '-----' \
```

## k3s側のビルド用のPodの用意

k3s側でビルドするのに必要なマニフェストはBuildKit側で用意してくれていたのでそれをそのまま使用します。

[Kubernetes manifests for BuildKit](https://github.com/moby/buildkit/tree/master/examples/kubernetes)

今回はとりあえずPodで生やします。

```sh
$ kubectl apply -f pod.rootless.yaml
```

```sh
$ kubectl get pods
NAME        READY   STATUS    RESTARTS   AGE
buildkitd   1/1     Running   0          124m
```

## BuildKitを使用してのビルド

`buildctl`を使用してビルドをします。

```sh
buildctl --addr kube-pod://buildkitd build \
  --frontend dockerfile.v0 \
  --local context=. \
  --local dockerfile=. \
  --output type=oci,name=ferris_says:latest > ferris_says.tar
```

ビルドがうまくいくとイメージがtarに詰まって出てくるので、あとはそれをk3sに突っ込むだけです。

```sh
$ sudo k3s ctr images import ferris_says.tar
```

```sh
$ sudo k3s crictl images                                                               
IMAGE                                        TAG                    IMAGE ID            SIZE
docker.io/library/ferris_says                latest                 7948ed6b9ec95       10.6MB
```

ここまで来ればあとはイメージを動かすだけです。

この時、`--image-pull-policy=Never`を指定してイメージをプルしないようにしないとイメージ取得で詰まっていい感じに動いてくれません。

```sh
$ kubectl run ferris-says --restart=Never --image=docker.io/library/ferris_says:latest --rm -it --image-pull-policy=Never
 __________________________
< Hello fellow Rustaceans! >
 --------------------------
        \
         \
            _~^~^~_
        \) /  o o  \ (/
          '_   -   _'
          / '-----' \
pod "ferris-says" deleted
```

おわり
