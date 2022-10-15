---
title: ブログをはてなからGithub Pageに移したお話
description: ブログをはてなからGithub Pageに移したお話
date: 2022-10-15
tags: 
  - deno
  - lume
---

# はじめに

GitHub Pageからこんにちは。どうも弊社です。

実は数年前から独自ドメイン`jyuch.dev`を所持しており、独自ドメインでブログをやるついでにはてなブログからGitHub Pageに移したいと考えていました。

それとは別に最近ちょくちょく[Deno](https://deno.land/)を触っており、Denoで動く静的サイトジェネレータである[Lume](https://lume.land/)がいい感じそうだったので勢いでブログを移行してしまおうというお話です。

# テンプレートから作成

とはいえ弊社はフロントエンド周りに詳しいわけではないので、とりあえずテンプレートをベースに作って後々いい感じに調整していきたいと思います。

[lumeland/base-blog](https://github.com/lumeland/base-blog)

テンプレートをプルしてきたらとりあえず`_data/site.yml`をいじっていい感じにします。
`title`がブログ名になるのでとりあえずここだけ変えておけばいいのではないでしょうか。

あとは以下のコマンドでサーバが起動するので、[http://localhost:3000](http://localhost:3000)にアクセスするとなんかいい感じのページが見えるようになると思います。

``` sh
deno task serve
```

# GitHub Action の設定

`.github/workflow/build.yml`にGitHub Actionの設定があるので、以下の部分を自分の環境に合わせて書き直します。

``` yaml
- name: Build site
  run: |
    deno task build --location=https://blog.jyuch.dev/
```

あとはGitHubにプッシュするだけでいい感じにGitHub Workflowが動いて`gh-pages`ブランチにビルド結果が展開されるので、設定からGitHubのページとして`ph-pages`を使うように設定すれば完了です。

# Netlify CMSの削除

CMSは使わないつもりなので、デフォルトで入っているNetlify CMSは消しておきます。

`_config.ts`から`.use(netlifyCMS())`の記述を消しておきます。

# おわりに

フォントサイズとか調整したいところはいろいろあるのですが、いきなり100%の完成度を求めてもｱﾚですし、個人ブログなのでその辺はちょくちょく手を入れていこうと思います。

おわり
