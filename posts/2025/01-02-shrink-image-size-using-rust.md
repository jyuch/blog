---
title: RustでもAVIFフォーマットに変換して画像サイズを縮小したい
description: Rustとimage-rsを使用して画像をavifフォーマットに変換する方法を紹介します。
date: 2025-01-02
lastModified: 2025-01-02
tags: 
  - rust
---

# はじめに

Rustとimage-rsを使ってjpeg画像などをAVIFフォーマットに変換して画像サイズを縮小するツールを作成したのでそれについてです。

[cwebp](https://github.com/jyuch/cwebp)

自炊したスキャン画像があり、普段はPCで参照していたのでWindows標準の画像ビューワで見ていました。
しかし、諸般の事情で手元のiPhoneでも見れたほうがいいよねってことで画像ファイルを本ごとにブラウザで見れるようにSSGを使ってHTMLに起こしました。

宅内からでしか参照しないのでオリジナルサイズの画像をそのまま貼り付けても良かったのですが、画像数が32000程度あり取り回しやサーバへの転送でつらみポイントが高めだったので、ナウでヤングなファイルフォーマットを使って取り回しを良くしたいというのが作った動機です。

また、単純に画像を変換するだけならImageMagicを使えば良いと思いますが、画像を保存しているディレクトリ構造を保ったまま一括で変換してほしかったのでツールを作成しました。

最初はWebPフォーマットにしようとしましたが、ビット深度を落としてもオリジナルサイズの2倍くらいのサイズになってしまうのでAVIFフォーマットに切り替えたという経緯があります。

# 使用ライブラリ

Rustでの画像操作ライブラリは[image-rs](https://github.com/image-rs/image)を使っています。

オリジナルファイルは残す前提なので、ファイルサイズを縮小することを優先して変換を掛けています。

書籍系の画像なのでアルファチャネルは不要で、カラーはRGBでビット深度が24bit、モノクロははビット深度を8bitに落としています。

image-rsは書き出し時に指定するパスのファイルの拡張子からフォーマットを決めてくれるので、出力パスを決定する段階で拡張子`.avif`を付けています。

また、これは完全に私の管理が悪いのですが、たまに拡張子とファイルフォーマットが一致していないファイルがあったりします。
そのため、画像を読み込むときは拡張子から読み込むフォーマットを決めているのではなく、ファイルから読み込んだ中身からファイルフォーマットを類推させています。

あとは、画像サイズをコマンドラインパラメータから指定できるようにし、画像サイズの縮小も同時に行っています。


```rs
fn convert(
    input: impl AsRef<Path>,
    output: impl AsRef<Path>,
    width: Option<u32>,
    height: Option<u32>,
) -> anyhow::Result<()> {
    let content = fs::read(&input)?;
    let img = ImageReader::new(Cursor::new(&content))
        .with_guessed_format()?
        .decode()?;

    let (cur_width, cur_height) = img.dimensions();
    let new_width = width.unwrap_or(cur_width);
    let new_height = height.unwrap_or(cur_height);
    let img = img.resize(new_width, new_height, FilterType::Lanczos3);

    let img: DynamicImage = match img.color() {
        ColorType::L8 | ColorType::La8 | ColorType::L16 | ColorType::La16 => {
            DynamicImage::from(img.into_luma8())
        }
        ColorType::Rgb8
        | ColorType::Rgba8
        | ColorType::Rgb16
        | ColorType::Rgba16
        | ColorType::Rgb32F
        | ColorType::Rgba32F => DynamicImage::from(img.into_rgb8()),
        _ => unreachable!(),
    };

    img.save(output)?;
    Ok(())
}
```

# 縮小比と処理時間

AVIFフォーマットの画像縮小は効果てきめんで、カラーならオリジナル比で40%、モノクロで60%くらいまで縮んでくれます。

ただし、処理時間がWebPフォーマットなどの比べるととても遅く、1ファイル当たり平均で811msくらい掛かります。
PNGなどが大体14mくらいなので、まぁ、うん、その、ねぇ・・・

おわり