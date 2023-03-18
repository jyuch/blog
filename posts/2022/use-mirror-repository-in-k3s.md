---
title: k3sでもローカルなDockerリポジトリを使用したい
description: k3sでもローカルなDockerリポジトリを使用したい
date: 2022-11-16
lastModified: 2022-11-23
tags: 
  - k8s
  - k3s
---

## はじめに

[前回](/posts/2022/build-container-image-in-k3s-using-buildkit/)k3s上でBuildKitを使用してコンテナイメージをビルドしてそのままk3sに読み込ませるという割と強引な事をやったのですが、やっぱりちゃんとコンテナレジストリを立てて運用した方がいろいろ良いよねというお話です。

今回はローカルにコンテナレジストリを立てて、Pull-throughなキャッシュを立ててDocker Hub君を労わりつつ、独自のイメージをホストさせます。

## コンテナレジストリ

今回はコンテナレジストリとして[Sonatype Nexus Repository Manager OSS](https://www.sonatype.com/products/repository-oss-download)を使用します。

以下のような感じでリポジトリを立てます。

| 名前            | タイプ | ポート | 説明                                             |
| :-------------- | :----- | :----- | :----------------------------------------------- |
| docker-group    | group  | 9000   | 下の二つのリポジトリを仮想的にまとめるリポジトリ |
| docker-hosted   | hosted | 9001   | 独自のコンテナイメージをホストするリポジトリ     |
| docker.io-proxy | proxy  | 9002   | Docker Hubのミラーキャッシュ                     |

k3s側でクレデンシャルをｺﾈｺﾈするのがめんどくさいので私は「Allow anonymous doker
pull」にチェックボックスを入れて匿名でのpullを許可させましたが、この辺は組織のポリシーでいい感じに設定すればいいと思います。

また、「Anonymous Access」から「Allow anonimous user to access the
server」にチェックを入れ、「Realms」で「Docker Bearer Token
Realms」を有効にしておかないと匿名のpullが弾かれます。（1敗）

## Docker側の設定

そうしたらまずDockerがこのリポジトリからpull出来るようにします。

お好みに合わせて、`/etc/hosts`にリポジトリをホストしているサーバのIPアドレスを追加します。
長いとイメージ名を指定するときにつらいので、私は`ocr`みたいに短い名前にしてしまっています。

`/etc/docker/daemon.json`でDocker
Hubの代わりにアクセスするレジストリミラーとhttpでアクセスするためのおまじないを設定します。

```json
{
  "insecure-registries": ["ocr:9000", "ocr:9001"],
  "registry-mirrors": ["http://ocr:9000"]
}
```

勘のいい人は気が付いたかと思いますが、docker-groupの9000だけではなくdocker-hostedの9001も登録しています。

弊社も動作検証中に気が付いたのですが、OSSのNexus君はgroupリポジトリへのpushは出来ないみたいです。

そのため、イメージのpushはhosted側に行い、pullはgroup側から行うことにしました。

```sh
# Sonatype社からの課金のお誘い
$ docker push ocr:9000/jyuch/blog:20221115   
The push refers to repository [ocr:9000/jyuch/blog]
a2a9af77c400: Layer already exists 
a2e59a79fae0: Layer already exists 
4091cd312f19: Layer already exists 
9e7119c28877: Layer already exists 
2280b348f4d6: Layer already exists 
e74d0d8d2def: Layer already exists 
a12586ed027f: Layer already exists 
denied: Deploying to groups is a PRO-licensed feature. See https://links.sonatype.com/product-nexus-repository
```

あとは`ocr:9001`側で`docker login`をすればOKです。

```sh
docker login ocr:9001
Username: kawata
Password: 
WARNING! Your password will be stored unencrypted in /home/jyuch/.docker/config.json.
Configure a credential helper to remove this warning. See
https://docs.docker.com/engine/reference/commandline/login/#credentials-store

Login Succeeded
```

## k3s

とりあえずDocker側pushとpullが出来ることを確認できたら、次はk3s側です。

同様に`/etc/hosts`を編集し、`/etc/rancher/k3s/registries.yaml`を編集します。

```yaml
mirrors:
  docker.io:
    endpoint:
      - "http://ocr:9000"
  "ocr:9000":
    endpoint:
      - "http://ocr:9000"
```

こちらではイメージのpushはしない為、group側の設定だけで大丈夫です。

適当なPodを展開してちゃんとイメージを引っ張ってきて来れているかを確認します。

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blog-nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: blog-nginx
  template:
    metadata:
      labels:
        app: blog-nginx
    spec:
      containers:
      - name: blog-container
        image: ocr:9000/jyuch/blog:20221116
        ports:
          - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: blog-nginx
spec:
  type: LoadBalancer
  ports:
    - name: "http-port"
      protocol: "TCP"
      port: 18080
      targetPort: 80
  selector:
    app: blog-nginx
```

## おわりに

とりあえずこれでPull-throughなキャッシュと独自リポジトリが立てられました。

なんかBuildKit側がPull-throughキャッシュを見ていない疑惑がありますが、そもそもあの子キャッシュの扱いがよくわかんないのでまぁその辺はおいおい確認していきます。

おわり
