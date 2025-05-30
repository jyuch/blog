---
title: 生成AIは業務アプリの夢を見るか
description: 生成AIで業務アプリを生成する世界の考察です。
date: 2025-01-04
lastModified: 2025-01-04
draft: true
tags: 
  - poem
---

# はじめに

ソフトウェア開発にも生成AIを適用して、アプリケーションを生成出来るのではといった意見をツイッターで目にする機会も増えました。

それに合わせて、ソフトウェアエンジニア（プログラマ？）不要論を唱える人もぼちぼち見ます。
いくつかのステップが必要かとは思いますが、ソフトウェアエンジニアが介在せずにアプリケーションが生えてきたらそれはそれで夢のあるお話だと思います。

そこで、~~正月休みで若干暇なので~~生成AIを使用して業務アプリケーションを作らせる世界が出来上がった時、どんな世界になるのか考えてみました。

# 前提

極端な例ですが、職業としてソフトウェアエンジニアは登場せず、生成AIと業務部門だけで業務アプリケーションを作成する世界を考えます。

また、プログラマが不要になると言っているのにプログラマの補助を行うコード生成は違うと思うので、生成AIに要件定義書を入力し、吐き出されたコードをビルドすればそのまま業務アプリケーションになる世界を想定します。

# 開発環境

普通は業務アプリケーションを記述するときはJavaやC#、はたまたCOBOLを使っていると思います。

対して生成AIが業務アプリケーションを生成するとなった場合、もはや要件定義書からは人間が介在しなくてもよくなるのでいきなりバイナリを吐いても良いはずです。

もしくは要件定義から生成された中間結果としてソースコードを出力し、それを既存のビルド環境に通しても良いとは思います。それでもソースコードはブラックボックスとして扱われるとします。

すると、ソースコードの構造を依拠とするホワイトボックステストは存在しなくなり、外形的な挙動を試験するブラックボックステストがテストする唯一の手段となるはずです。

# テスト

業務アプリケーションとされるバイナリが吐き出されました。
ユーザ部門でテストを行い、要件定義書に従った動きをするので問題なしという事になり導入されました。
ここまではいいですね。

法令の改定により業務の一部が変わり、業務アプリケーションを改修する必要が出てきました。

要件定義書を改定された法令に沿った形に書き換え、再度生成AIで業務アプリケーションとされるバイナリを吐き出したとします。

そうした場合、生成AIは改定された部分だけ挙動を変え、それ以外の部分の挙動は今まで通りのバイナリを吐いてくれるのでしょうか。

再度のテストは初回と同じようにすべての画面・機能で行う必要があるのでしょうか。
それとも、変えた部分だけテストを行えば良いのでしょうか。

業務部門の感性で考えると、変えたのは変えた部分だけなのだから、変えた部分だけのテストで済ませたいはずです。
しかし、開発環境で述べた通りホワイトボックステストは行えません。

上記の話をまとめると、生成AIもしくは業務部門は以下のいずれかに基づかなければなりません。

1. あいまいな要件定義書を認める代わりに生成毎に全機能・画面のテストを行う
2. あいまいな要件定義書に起因する出力バイナリの挙動のブレを局所化するために、機能単位を出力単位とする
3. （生成AIの力を借りて）要件定義書から曖昧性を排除し、決定論的にバイナリを出力する

新旧の要件定義書と現在稼働しているバイナリを入力とし、要件定義書の変わった部分だけ変えるよう指示することも出来るとは思います。
しかし、それはそれで生成AIがきっちり変わった部分だけ変えてくれることを誰かが保障しないといけないため難しい気がします。

# バイナリ生成毎の全画面・機能テストの実施

この考えが一番単純で分かりやすいと思います。

そのため、仮に生成AIがコードを出力する世界が訪れた場合、黎明期はこの形態になるのではないかと思います。

ただし、テストを行う主体（業務部門？）の負担が大きすぎるため、いずれ以下の二つの方式に行き着くと思います。

# 機能単位での生成

生成の単位がテストの単位となるなら、機能ごとに生成させればいいじゃんという考え方です。

つまり、機能ごとにバイナリを刻み、刻まれたバイナリをなんらかの手段で統合し一つのアプリケーションに仕立て上げるという考えです。

この手法を成立させるために生成AIは与えられた要件定義書から不変であろうコアな部分と変わるであろう部分を推論し、不変であろうコア部分をコントラクトとして各バイナリが協調動作する仕組みを作り出さなければなりません。

協調動作させる方法そのものはここでは重要でなく、各バイナリ（コンポーネント）が協調動作するためのコントラクトを生成AIが推論・導出をしないといけないといけないというのがポイントとなります。

そうなると、生成AIは生成したい業務アプリケーションのドメイン知識をバックグラウンドに推論を行った方がコントラクトの推論に有利になると思います。

それ以外にも、ドメイン知識を学習させておいた方がより曖昧な要件定義書からユーザが望むバイナリを出力しやすくなるはずなので、各社のドメイン知識のデータセットが差別化の部分になると思います。

つまり、現在アーキテクトが担っている部分も含めて生成AIが担うという事になります。

# 決定論的に出力

要件定義書からあいまいな部分を排除し、決定論的にバイナリを吐かせればいいじゃんという考え方です。

自然言語をベースに生成AIと対話し、あいまいな部分をひとつづつ潰しながら要件定義書を生成AIの支援の下に作り上げ、それをコード生成用の生成AIに流し込んで生成するという方法が考えられます。

その場合でも生成AIにはドメイン知識があった方がより早く要件定義をまとめきれるため、生成AIにドメイン知識を学習させるためのデータセットが重要になると思います。

また、生成AIの支援の下で作り上げた要件定義書はある意味ソースコードと等価な存在となります。
（というよりもアプリケーションを生成する元となる原始プログラムという意味ではソースコードそのものと言えるでしょう。）

# まとめ

おそらくどのパターンでも素のLLMをベースにした生成AIだとドメイン知識が足りず、生成AIと業務サイドの認識のすり合わせにかなりの時間を要してしまうと考えられます。

そのため、LLMに追加学習させるドメイン知識のデータセットの優劣が生成される業務アプリケーションであったり要件定義書の品質を左右する要素となるのではないでしょうか。
また、そのドメイン知識のデータセットの優劣が各ベンダーの差別ポイントになると考えます。

おわり
