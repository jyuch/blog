---
title: Rustでも画像がカラーかモノクロか判別したい
description: Rustとimage-rsを使用して画像がカラー画像かモノクロ画像か判別する方法を紹介します。
date: 2025-01-19
lastModified: 2025-01-19
tags: 
  - rust
---

# はじめに

[前回](/posts/2025/01-02-shrink-image-size-using-rust/)では画像をavifにして縮小する方法を確認したのですが、よくよく確認してみると明らかにモノクロ画像なのにカラープロファイルで保存されている画像とかもちらほらあったんですよね。

じゃあカラー画像かモノクロ画像か判別して、モノクロならビット深度を8bitに落とせばもっとサイズを縮小出来るのではということでカラーかモノクロか判別する方法を確認してみました。

[画像が、白黒かカラーか判定する。(白黒に近いスキャン画像を判定する）- それマグで！](https://takuya-1st.hatenablog.jp/entry/2023/04/05/230317)

HSV（HSB）色空間に変換して、S(Saturation)×V(Value)の値を閾値で2値化してその平均値で判定すればうまく行くとのことです。

# HSV色空間

さて、前回に引き続き画像ライブラリにはimage-rsを使っているので、HSV色空間に変換するメソッドがあれば一発で終わります。ありませんでした

ただ、RGBからHSVに変換するのはそんなに難しくないので、ここでは愚直に実装していきます。

RGB用に以下の`max`、`min`なヘルパメソッドを定義して、

```rust
fn max(r: u8, g: u8, b: u8) -> u8 {
    if r > g && r > b {
        r
    } else if g > b && g > r {
        g
    } else {
        b
    }
}

fn min(r: u8, g: u8, b: u8) -> u8 {
    if r < g && r < b {
        r
    } else if g < b && g < r {
        g
    } else {
        b
    }
}
```

定義通りにSとVを計算するメソッドを実装します。
なお、値域は文献によってまちまちなのですが、ここでは0から255までとして計算しています。

また、今回の計算ではHは使用しないので実装していません。

```rust
fn v(r: u8, g: u8, b: u8) -> u8 {
    max(r, g, b)
}

fn s(r: u8, g: u8, b: u8) -> u8 {
    let v = v(r, g, b);

    if v == 0 {
        0
    } else {
        (255f64 * ((max(r, g, b) as f64 - min(r, g, b) as f64) / max(r, g, b) as f64)) as u8
    }
}
```

# 判定

あとは画像を読み込んで1ピクセル毎にHSV色空間に変換して閾値から2値化して平均すれば完了です。

```rust
fn is_monochrome(img: &DynamicImage) -> f64 {
    let img = img.clone().into_rgb8();
    let mut sum = 0u32;
    let mut n = 0u32;

    // 2値化するときの閾値（今回は10%を使用している）
    let threshold = (256f64 * 256f64 * 0.1) as u32;
    for (_, _, pixel) in img.enumerate_pixels() {
        let r = pixel.0[0];
        let g = pixel.0[1];
        let b = pixel.0[2];

        // HSV色空間に変換
        let v = v(r, g, b);
        let s = s(r, g, b);
        let sv = s as u32 * v as u32;

        // 2値化
        if sv > threshold {
            sum += 1;
        }
        n += 1;
    }
    
    // 平均を計算
    let mean = sum as f64 / n as f64;
    mean
}
```

結果が0よりも大きければカラー、0ならモノクロと判別出来ると思います。たぶん

[is-monochrome](https://github.com/jyuch/is-monochrome)

おわり
