# chatwork-extension

chatwork を使いやすくするための Chrome 拡張機能

## 概要

Chatwork Mention Extension は、Chatwork のチャット入力欄で「@」を入力すると、メンバー候補のリストが表示され、選択することで Chatwork 標準のメンション形式（[To:ユーザー ID]）を自動で挿入できる Chrome 拡張機能です。
サイドバーのメンバー一覧から情報を取得していて、DOM の構成が変わると動作しなくなる可能性があります。

## 主な機能

- チャット入力欄で「@」を入力すると、ルームメンバーやコンタクトリストからユーザー候補を自動抽出し、リスト表示

## 使い方

1. Chrome 拡張機能としてインストールし、Chatwork の画面を開く
2. チャット入力欄で「@」を入力すると、メンバー候補リストが表示されます
3. 候補を選択すると、[To:ユーザー ID]形式でメンションが自動挿入されます

## 技術的なポイント

- content script で Chatwork の DOM を解析し、ユーザー情報を抽出
- MutationObserver で動的な入力欄生成にも対応
- TypeScript で堅牢に実装
- スタイルは`styles/content.css`で管理

## 開発・ビルド

```
npm install
npm run build
```

## DeepWiki

- 詳細・技術解説・Q&A は[DeepWiki](https://deepwiki.com/yukiyoshimura/chatwork-extension)も参照してください。

## Chrome ウェブストアには登録していないので、

拡張機能を利用するには、手動でパッケージを読み込む必要があります。

### 手動インストール手順

1. このリポジトリをクローンまたはダウンロードします。
2. `npm install && npm run build` で `dist/content.js` をビルドします。
3. Chrome の「拡張機能」ページ（chrome://extensions/）を開き、「デベロッパーモード」を ON にします。
4. 「パッケージ化されていない拡張機能を読み込む」から、このプロジェクトのルートディレクトリを選択します。
5. Chatwork の画面をリロードして動作を確認してください。

※ manifest.json, dist/content.js, styles/content.css, icons/ などが揃っている必要があります。
