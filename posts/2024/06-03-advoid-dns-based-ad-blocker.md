---
title: RustでもDNSベースのアドブロッカーを実装したい
description: Rustで実装したアドブロッカーの紹介です
date: 2024-06-03
lastModified: 2024-06-03
tags: 
  - rust
  - dns
---

# はじめに

最近は履歴に介入したり勝手に全画面表示してくるｱﾚなWeb広告が増えてきましたよね。

というのは特に関係なく、なんとなく手持ちの知識で作れそうなのでアドブロッカーを自作しました。

[advoid - DNS based AD blocker](https://github.com/jyuch/advoid)

# 動作原理

基本的な原理はフルリゾルバのクライアントの間に挟まり、広告を配信しているドメインのクエリをインターセプトして`NXDOMAIN`を返すというよくあるものです。
ですので、基本的には配下の端末全体で広告をブロック出来るようになります。

あくまでも上位のフルリゾルバへのクエリをフィルタリングしているだけなので、advoid自体にはキャッシュは持っていません。

また、正規の実装であれば`NXDOMAIN`を返すときはネガティブキャッシュをさせるためにSOAレコードも返すべきです。
しかし、フィルタリング自体はadvoidの内部で行っており、ブロック対象のレコードに対してはμsオーダーでレスポンスを返せているためわざわざSOAを上位のフルリゾルバに問い合わせるよりも空で返したほうが速いと思って返していません。

# 実装コンセプト

手軽に使えるようにバイナリのポン置きとブロックするドメインの定義ファイルだけで動作するようになっています。

実装には最近お気に入りのRustを使用しており、クエリの待ち受けやフルリゾルバへクエリをフォワーディングするのには[hickory-dns](https://github.com/hickory-dns/hickory-dns)を利用しています。

また、どれだけのリクエストを受け取ってどれだけブロックしたか確認できるようにPrometheusのexporterを生やしています。
まぁ、カウンタは今のところ3つしかありませんが。

```text
# TYPE dns_requests_total counter
dns_requests_total 4149

# TYPE dns_requests_block counter
dns_requests_block 3583

# TYPE dns_requests_forward counter
dns_requests_forward 566
```

また、デバッグしているときに欲しかったのでOpenTelemetryでテレメトリを採れるようにしてあります。Jaegerとセットでどうぞ

# おわりに

とりあえず単純なフォワーディングとフィルタリングは出来るようになったのですが、TCPフォールバックとかActive Directory配下のDynamic DNSの透過とかはまだなので追い追い実装していきます。

おわり
