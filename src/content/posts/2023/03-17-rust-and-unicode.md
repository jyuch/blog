---
title: Rustでも文字数をカウントしたい
description: Rustで異体字セレクタを含む文字列の文字数カウントを行う方法を解説します
date: 2023-03-17
lastModified: 2023-03-17
tags:
  - rust
  - character encoding
---

## はじめに

後輩にUnicodeを熱く語ったら引かれました。どうも弊社です

今まで結構Rustのコードを書いていましたが、そういえば日本語周りの挙動を確認していなかったなということで確認してみます。

## 前提知識

この辺はドキュメントに書いてあるので割と周知な内容なんじゃないかなという所ですが、Rustは内部的には文字列はUTF-8で扱っています。

背景は調べてないので知りません。
多分JSONのシリアライズ・デシリアライズとかで変換コストが減るとか、メモリ消費量を減らしたいとかなんとかじゃないでしょうか。

## 文字数カウント

`String`には`pub fn len(&self) -> usize`なメソッドが生えていますが、このメソッドはバイト数を返してきます。
Rustのドキュメントは文字はUTF-8であることをしつこいくらい書いているので、納得できる挙動ではあります。

が、我々日本人は漢字を使わないといけない為、それでは困るわけです。

そこで、`pub fn chars(&self) -> Chars<'_>`なメソッドを呼び出して`char`のイテレータを取得し、その数を数えれば文字数をカウント出来ます。

```rust
let a = String::from("Hello World");
let b = String::from("こんにちは");

println!("{} {} {}", a, a.len(), a.chars().count());
println!("{} {} {}", b, b.len(), b.chars().count());
```

```shell
Hello World 11 11
こんにちは 15 5
```

## 本当にそれでいいの？

ここまでの説明で、「`a.chars().count()`を呼び出せばいいのね！」と納得して帰る人は文字コードの怖さを知らない人です。
Unicode規格票で素振りを1000回やってから出直してきてください。

上の文をもう一度読んでみましょう。

> `pub fn chars(&self) -> Chars<'_>`なメソッドを呼び出して`char`のイテレータを取得し、

そうです。このメソッドは`char`、すなわちコードポイントのイテレータを返すに過ぎないわけです。

この方法だと「は（U+306F）」+「゜（U+309A）」で表現される「ぱ」は容赦なく2文字としてカウントされます。

```rust
let a = vec!['は', '\u{309A}'];
let a: String = a.iter().collect();
println!("{} {} {}", a, a.len(), a.chars().count());
```

```shell
ぱ 6 2
```

ソフトウェアエンジニア相手なら「内部的には2文字なんですよ～」と言えばいいだけ？ですが、一般人にそんなことを言っても「何言ってんだこいつ」となるだけです。

## Unicode正規化

しかし、我々にはアクセント記号などを分解後再結合できるUnicode正規化という法具が存在します。

が、Rustの標準ライブラリに入ってません。
[unicode-normalization](https://github.com/unicode-rs/unicode-normalization)を使うしかなさそうです。

```toml
[dependencies]
unicode-normalization = "0.1"
```

```rust
fn test(value: &Vec<char>) {
    use unicode_normalization::UnicodeNormalization as _;

    let str: String = value.iter().collect();
    println!("{} {} {}", str, str.len(), str.chars().count());

    let str = str.nfc().to_string();
    println!("{} {} {}", str, str.len(), str.chars().count());
}
```

```rust
let a = vec!['は', '\u{309A}'];
test(&a);
```

```shell
ぱ 6 2
ぱ 3 1
```

しかし、結合後の文字が収録されていない文字はやはりだめです。

```rust
let a = vec!['か', '\u{309A}'];
test(&a);
```

```shell
か゚ 6 2
か゚ 6 2
```

## Unicodeテキストセグメンテーション

そこで、Unicode® Standard Annex #29 UNICODE TEXT SEGMENTATIONの出番です。

こいつでGrapheme Cluster Boundaries（書記素単位）でぶった切ってやればいいのです。

同じunicode-rsグループが開発している[unicode-segmentation](https://github.com/unicode-rs/unicode-segmentation)クレートを使用します。

```toml
[dependencies]
unicode-segmentation = "1"
```

```rust
fn test(value: &Vec<char>) {
    use unicode_normalization::UnicodeNormalization as _;
    use unicode_segmentation::UnicodeSegmentation as _;

    let str: String = value.iter().collect();
    println!("{} {} {}", str, str.len(), str.chars().count());

    let str = str.nfc().to_string();
    println!("{} {} {}", str, str.len(), str.chars().count());

    let g = str.graphemes(true).collect::<Vec<&str>>();
    println!("{} {} {}", str, str.len(), g.len());
}
```

```rust
let a = vec!['か', '\u{309A}'];
test(&a);
```

```shell
か゚ 6 2
か゚ 6 2
か゚ 6 1
```

なしとげました

これならみんな大好きIVSも正しくカウントできます。

```rust
let a = vec!['\u{8FBB}', '\u{E0100}'];
test(&a);
```

```shell
辻󠄀 7 2
辻󠄀 7 2
辻󠄀 7 1
```

```rust
let a = vec!['\u{1F385}', '\u{1F3FF}'];
test(&a);
```

```shell
🎅🏿 8 2
🎅🏿 8 2
🎅🏿 8 1
```

## おわりに

文字コードを舐めると死にます
