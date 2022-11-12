---
title: Rustでもメタプログラミングでto_stringしたい
description: Rustでもメタプログラミングでto_stringしたい
date: 2022-10-10
tags: 
  - rust
---

# はじめに

Rustでは`#[derive(Debug)]`すれば勝手に`Debug`トレイトが生えますが、まぁ一回くらいは自分で実装してみてもいいんでね？という事で実装します。

C#やScalaでは実行時に型情報が手に入るので、その型情報を使用してインスタンスに対してリフレクションを介してフィールドから情報を抜きます。

しかし、Rustはコンパイル後はマシン語になってしまうため、手続き型マクロを使用してコンパイルプロセスの途中に介入してコードをあれこれ生成します。

[jyuch/tostring_rs](https://github.com/jyuch/tostring_rs)

# ワークスペース構成

今回は以下のようなワークスペース構成となっています。

- tostring
  - 今回実装するマクロを呼び出しているアプリケーションクレート
- tostring_macro
  - マクロを定義するクレート
  - 実際は tostring_macro_internals の実装を呼び出しているだけ
- tostring_macro_internals
  - マクロを実装しているクレート

Rustの手続きマクロを実装するクレートはCargo.tomlに以下のような記述をするのですが、そうするとコンパイル時にしか呼べなくなってしまうという制約があるらしいので、マクロの宣言と実装を分けるのがベストプラクティスっぽいです。

```toml
[lib]
proc-macro = true
```

# tostring_macro

手続き型マクロを宣言します。以上です

```rust
#[proc_macro_derive(ToString)]
pub fn derive(input: TokenStream) -> TokenStream {
    // マクロの実装を呼び出すだけ
    // proc_macro から proc_macro2 の TokenStream に変換する
    tostring_macro_internals::derive(input.into()).into()
}
```

# tostring_macro_internals

マクロを実装します。

`syn`、`quote`、`proc-macro2`は手続き型マクロの三種の神器らしいのでとりあえず入れておきましょう。

```toml
[dependencies]
syn = { version = "1.0", features = ["full"] }
quote = { version = "1.0" }
proc-macro2 = { version = "1.0" }
```

また、`proc_macro`クレートはマクロクレート内でしか使用できないため、ここでの`TokenStream`は`proc-macro2`のものを使用しています。

`TokenStrem`は文字通りトークン列であって、javaagentのようにASTが降ってくるわけではないので`syn::parse2`でパースするのが一番手っ取り早いです。

```rust
let input: DeriveInput = syn::parse2(input).unwrap();
```

あとはフィールド定義をいい感じに取得して

```rust
let src_fields;
if let syn::Data::Struct(syn::DataStruct { fields, .. }) = input.data {
    src_fields = fields;
} else {
    return error(input.ident.span(), "Currently you can just derive CustomDebug on structs").into();
}
```

構造体名を取得して、

```rust
let src_ident = input.ident;
let src_ident_str = src_ident.to_string();
```

フォーマッタで出力する際のメソッド呼び出しを生成して、

```rust
let formatter_fn = match &src_fields {
    Fields::Named(_) => {
        quote! { debug_struct( #src_ident_str ) }
    }
    Fields::Unnamed(_) => {
        quote! { debug_tuple( #src_ident_str ) }
    }
    Fields::Unit => {
        quote! { debug_struct( #src_ident_str ) }
    }
};
```

各フィールドを出力するためのコードを生成して、

```rust
let mut formatter_field_args = vec![];
let pattern = "{:?}";

for (i, field) in src_fields.iter().enumerate() {
    let field_ident = &field.ident;

    if let Some(ident) = field_ident {
        let ident_str = (*ident).to_string();
        formatter_field_args.push(quote! { #ident_str, &format_args!( #pattern , &self.#ident ) });
    } else {
        let i = proc_macro2::Literal::usize_unsuffixed(i);
        formatter_field_args.push(quote! { &self.#i });
    }
}
```

トレイト全体を生成するコードを吐き出したら完成です。

```rust
(quote! {
    impl ::std::fmt::Debug for #src_ident {
        fn fmt(&self, formatter: &mut ::std::fmt::Formatter) -> ::std::fmt::Result {
            formatter.#formatter_fn
                #(  .field(#formatter_field_args)   )*
                .finish()
        }
    }
}).into()
```

あとはアプリケーションコードの構造体に`#[derive(ToString)]`を貼り付けたら完成です。

```rust
#[derive(ToString)]
pub struct Struct {
    i: i32,
}

#[derive(ToString)]
pub struct Hoge(i32);
```

ツールチェインが`nightly`であれば以下のコマンドでマクロが展開後のコードが表示できます。

```
cargo rustc -- -Z unstable-options -Z unpretty=expanded -Z macro-backtrace
```

```rust
pub struct Struct {
    i: i32,
}
impl ::std::fmt::Debug for Struct {
    fn fmt(&self, formatter: &mut ::std::fmt::Formatter)
        -> ::std::fmt::Result {
        formatter.debug_struct("Struct").field("i",
                &::core::fmt::Arguments::new_v1(&[""],
                        &[::core::fmt::ArgumentV1::new_debug(&&self.i)])).finish()
    }
}

pub struct Hoge(i32);
impl ::std::fmt::Debug for Hoge {
    fn fmt(&self, formatter: &mut ::std::fmt::Formatter)
        -> ::std::fmt::Result {
        formatter.debug_tuple("Hoge").field(&self.0).finish()
    }
}
```

# おわりに

Rustの手続き型マクロはどちらかというとCodeDOMやIL
Generatorというよりテンプレートを使用してコードを生成する方法に近いので、C#の実行時メタプログラミングに慣れている人からすると微妙にやりずらいかもしれません。

ただ、入力は別にRustのコードに限らなくてもいいのでアイデアと気力があればいろいろ出来そうなので夢が広がりますね。

おわり
