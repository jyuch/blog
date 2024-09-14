---
title: Windowsでもpyenvを使いたい
description: pyenv-winの紹介です
date: 2024-07-09
lastModified: 2024-07-09
tags: 
  - python
---

# はじめに

Pythonの特定のバージョンをグローバルに影響させたくないのでpyenv-winを使っているのですが、セットアップをよく忘れるのでそれについてです。

# 初回セットアップ

pyenv-winをホームディレクトリにクローンします。

```sh
git clone git@github.com:pyenv-win/pyenv-win.git .pyenv
```

そうしたら以下の環境変数を設定します。

|環境変数|値|
|:-|:-|
|`PYENV`|`%USERPROFILE%\.pyenv\pyenv-win`|
|`PYENV_HOME`|`%USERPROFILE%\.pyenv\pyenv-win`|
|`PYENV_ROOT`|`%USERPROFILE%\.pyenv\pyenv-win`|

また、以下の2つを`PAHT`に追加します。

- `%USERPROFILE%\.pyenv\pyenv-win\bin`
- `%USERPROFILE%\.pyenv\pyenv-win\shims`

また、「設定 > アプリ > アプリの詳細設定 > アプリ実行エイリアス」から`python.exe`と`python3.exe`をオフにします。

アプリ実行エイリアス君は再起動しないと効かないっぽいのでいったん再起動します。

# Pythonランタイムのインストール

```sh
pyenv install --list
```

でインストール可能なPythonバージョンを表示させ、

```sh
pyenv install 3.11.9
```

でインストールします。

# ローカルフォルダのセットアップ

ローカルフォルダで使うPythonのバージョンをセットアップします。

```sh
pyenv local 3.11.9
```

そうしたらvenv環境を作成します。

```sh
python -m venv .venv
```

venv環境を有効にします。

```sh
.\.venv\Scripts\Activate.ps1
```

いったんpipを最新版に更新します。

```sh
python -m pip install --upgrade pip
```

# パッケージのインストール

パッケージのインストール。

```sh
pip install polars
```

インストール済みのパッケージを出力。

```sh
pip freeze > requirements.txt
```

`requirements.txt`ファイルからインストール。

```sh
pip install -r requirements.txt
```

一括アンインストール。

```sh
python -m pip uninstall -y -r .\requirements.txt
```
