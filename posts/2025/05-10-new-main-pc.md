---
title: メインPCを更新したお話
description: 更新したメインPCを紹介します。
date: 2025-05-15
lastModified: 2025-05-15
tags: 
  - poem
---

# はじめに

メインPCを更新したのでそのことについてです。

# モチベーション

使っているメインPCは大体7年前位に購入したもので、以下の問題を抱えていました。

- Windows 11のサポート対象外で2025年10月以降は実質使えなくなる
- 検証用に仮想マシンをいくつか立ち上げた時に、CPUの処理が明らかに追いついていない時がある
- モンハンワイルズが動かない

特にWindows 11のサポート対象外は流石にまずいので、直前に慌てるよりは少し余裕を持って更新しようというのが動機となります。

# 次期PCに求める要件

現行PCは主に検証用に仮想マシンを立てる使い方をしており、その使い方は踏襲します。
また、瞬発的な処理能力も欲しいところです。

そのため、次期PCに求める要件は以下の通りとなりました。

- CPU
  - なるべく高い周波数で動作するマルチコアなCPUを採用する
- メモリ
  - 現行PCの倍となる128GBを最低とする
- ストレージ
  - OSを格納する高速で動作するプライマリストレージ
  - 仮想マシンを格納するSSDベースのセカンダリストレージ
  - アーカイブを格納するHDDベースの大容量ストレージ

こんな変な構成のPCは市販どころかBTOでも組めなさそうなので当然のように自作することになります。

# 選定パーツ

要件が固まったらパーツを選定していきます。

|コンポーネント|メーカー|モデル|
|:-|:-|:-|
|CPU|AMD|Ryzen™ 9 9950X|
|メモリ|Crucial|Pro 128GB Kit (64GBx2) DDR5-5600 UDIMM|
|プライマリストレージ|Sandisk|WD_BLACK SN850X 1TB|
|セカンダリストレージ|Solidigm|P41 Plus 2TB|
|マザーボード|ASUS|Prime X870-P WIFI-CSM|
|CPUクーラー|ARCTIC|Liquid Freezer III - 360|
|PCケース|Fractal Design|North XL|
|電源|Corsair|RM850e||
|GPU|ASRock|RT7800XT Challenger 16GB OC||

## CPU

最近のIntel CPUはPコアと呼ばれる高い処理能力を持つコアとEコアと呼ばれる高効率コアの二つのコアのハイブリット構成となっています。

理念としては理解できるのですが、どうやらVMWare Workstation Proでコア間のスケジューリングに問題を抱えているという話をちらっと聞いたり、私自身もその周りでトラブルを抱えたくないなぁという思いから今回はAMDのCPUを採用することとしました

特に[AMD Ryzen™ 9 9950X](https://www.amd.com/ja/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x.html)は全部Pコア、コアいっぱい、高いクロック数というバカの考えた最強のCPUを地で行っており、要件的に最も近いためこちらを採用することとします。

なお、9950X君には上位存在の9950X3Dという3D V-Cacheを積んでいるモデルもありますが、売ってないものは買えないのと、別にゲーム性能はそこまで求めてないので今回は採用しませんでした。

## メモリ

9950XはDDR5メモリ対応なのですが、4枚刺しだとメモリクロックが下がってしまうため出来れば2枚で運用したいところです。

と思いながらネットショップを徘徊していたら[Crucial Pro 128GB Kit (64GBx2) DDR5-5600 UDIMM](https://www.crucial.jp/memory/ddr5/cp2k64g56c46u5)の在庫が復活していたのでお買い上げしました。

## ストレージ

プライマリストレージとして[Sandisk WD_BLACK SN850X 1TB](https://shop.sandisk.com/ja-jp/products/ssd/internal-ssd/wd-black-sn850x-nvme-ssd?sku=WDS100T2X0E-00BCA0)、セカンダリストレージとして[Solidigm P41 Plus 2TB](https://www.solidigmtechnology.jp/products/client/plus-series/p41.html)を選択しました。

ターシャリのHDDは家で余っていた4TBのHDDをWindows記憶域で2本ミラーで束ねて使っています。

## マザーボード

上記のCPU、メモリ、ストレージが刺さるマザーボードで必要十分な性能を持つ（と思った）[ASUS Prime X870-P WIFI-CSM](https://www.asus.com/jp/motherboards-components/motherboards/csm/prime-x870-p-wifi-csm/)を採用します。

## CPUクーラー

AMDのデータシート曰く、

> Liquid cooler recommended for optimal performance

とのことなので、今回は簡易水冷クーラーを投入することとしました。

簡易水冷は消耗部品ということらしいので、そこそこの値段で評判のよさそうな[ARCTIC Liquid Freezer III - 360](https://www.arctic.de/en/Liquid-Freezer-III-360/ACFRE00136A)を採用します。

なお、このモデルはクーラーヘッドの上に周辺パーツの冷却用のファンが載っているのですが、マザーボードによっては干渉してしまうこともあるようなので事前に確認してから買うと良いと思います。

また、私が買ったときはCPUグリスのMX6が添付されていましたので、確認してから買うと無駄に別途CPUグリスを買ってしまう悲劇をさけられると思います。（1敗）

## PCケース

今回採用した簡易水冷クーラーのラジエータサイズが360mmと大型なので、このラジエータを無理なく納められるケースとして[Fractal Design North XL](https://www.fractal-design.com/ja/products/cases/north/north-xl/chalk-white/)を採用しました。

見た目もいいかんじです。

## 電源

電源は今まで使ってきて安心感のあるCorsairから選びました。

多分850Wあれば足りるだろうということで[Corsair RM850e](https://www.corsair.com/jp/ja/p/psu/cp-9020296-jp/rme-series-rm850e-fully-modular-low-noise-atx-power-supply-jp-cp-9020296-jp)をチョイス。

## GPU

なんとなく目についたので[ASRock RT7800XT Challenger 16GB OC](https://asrock.com/Graphics-Card/AMD/Radeon%20RX%207800%20XT%20Challenger%2016GB%20OC/index.jp.asp)をチョイス。

Challengerとはどの立ち位置のブランドなのか、オーバークロックだと何が変わるのか、何も分からずに使っています。

モンハンが動けばいいんすよ

# 組み立て

容量の大きなメモリを積むと初回起動時に画面が表示されるまで時間が掛かると言われていましたが、この構成ではたしか10分位で最初の表示が行われていたと思います。

North XLはサイズは大きいですが内部の容積も大きく、大型の簡易水冷でも無理なく取り回せます。
そのため、初めて簡易水冷で組みましたがとくにトラブルも無く組むことが出来ました。

# インストール

あとは普通にWindowsをインストールしてドライバをインストールすれば完了です。

ドライバはASUS DriverHubというものでマザーボード用ドライバをインストールした後、AMD Software: Adrenalin Edition経由でチップセットドライバとグラボドライバを更新しました。
これが正しい手順かどうかはよくわかっていません。

# ベンチマーク

最後に性能を測ります。

よくあるのはCinebenchですが、まぁ自作のツールでベンチマークしてもいいよねって事で[自作の画像変換ツール](/posts/2025/01-02-shrink-image-size-using-rust/)の処理時間で確認してみましょう。

```txt
> Measure-Command { cwebp.exe -i .\input\ -o .\output\ }


Days              : 0
Hours             : 0
Minutes           : 10
Seconds           : 52
Milliseconds      : 837
Ticks             : 6528379424
TotalDays         : 0.0075559947037037
TotalHours        : 0.181343872888889
TotalMinutes      : 10.8806323733333
TotalSeconds      : 652.8379424
TotalMilliseconds : 652837.9424
```

```txt
> Measure-Command { cwebp.exe -i .\input\ -o .\output\ }


Days              : 0
Hours             : 0
Minutes           : 3
Seconds           : 2
Milliseconds      : 843
Ticks             : 1828432412
TotalDays         : 0.00211624121759259
TotalHours        : 0.0507897892222222
TotalMinutes      : 3.04738735333333
TotalSeconds      : 182.8432412
TotalMilliseconds : 182843.2412
```

同じ画像セットに対して処理を行いました。
11分から3分と大体3.6倍の性能向上となっています。

なお、9950Xの方はCPUの使用率が30～50%のあたりをうろうろしていました。
この辺は私の作りこみが甘い部分があるのでもう少し頑張ればもっと性能差は開きそうです。

# おわりに

これからはこのメインPC君にいろいろ頑張ってもらいましょう。

おわり
