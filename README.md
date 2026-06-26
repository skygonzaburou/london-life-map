(日本語のREADMEは下部にあります)
# London Life App

London Life App is a web application designed for people who are starting life in London.

In the current MVP, the application supports residential area selection by visualising rental levels across London on a map, using ONS rent data and London borough boundary data.

## Current MVP Scope

The following features have been implemented in the current MVP:

* Deployment to Azure Static Web Apps
* Login requirement using Azure Static Web Apps built-in authentication
* London map display using Azure Maps
* Display of London borough boundary data from ONS
* Use of ONS rent data converted into JSON
* Rent range colouring by selected year and month
* Rent trend chart displayed when a borough is selected
* Tab-based UI for Rent Map and Recommended Restaurants
* Dark theme-based UI
* Responsive layout support

The Recommended Restaurants tab is currently displayed as a placeholder for a future feature.

## Technology Stack

| Category       | Technology                                    |
| -------------- | --------------------------------------------- |
| Frontend       | Next.js / TypeScript                          |
| Hosting        | Azure Static Web Apps                         |
| Authentication | Azure Static Web Apps built-in authentication |
| Map            | Azure Maps                                    |
| Chart          | Recharts                                      |
| Data source    | Office for National Statistics                |
| CI/CD          | GitHub Actions                                |
| Repository     | GitHub private repository                     |

## System Architecture

The following diagram shows the overall architecture, including the current MVP and the planned automated rent data update process.

```mermaid
flowchart LR
    User[User / Browser] --> SWA[Azure Static Web Apps]

    SWA --> Auth[Static Web Apps Authentication]
    SWA --> App[Next.js Static Site]
    App --> AzureMaps[Azure Maps]

    App --> BoundaryJson[public/data/london-boroughs.geojson]
    App --> RentJson[public/data/london-rents.json]

    ONSBoundary[ONS Boundary Data] --> BoundaryScript[scripts/filter-london-boroughs.mjs]
    BoundaryScript --> BoundaryJson

    ONSRent[ONS Rent Excel] --> RentScript[scripts/convert-rent-excel.mjs]
    RentScript --> RentJson

    GitHub[GitHub Repository] --> Actions[GitHub Actions]
    Actions --> SWA

    GitHubSecrets[GitHub Actions Secrets<br/>NEXT_PUBLIC_AZURE_MAPS_KEY] --> Actions

    ScheduledUpdate[Scheduled GitHub Actions<br/>planned] -.-> ONSRent
    ScheduledUpdate -.-> RentScript
    ScheduledUpdate -.-> RentJson
    ScheduledUpdate -.-> GitHub
```

## CI/CD Pipeline

The application deployment is triggered by pushing changes to GitHub.

```mermaid
flowchart TD
    Dev[Developer] --> Push[git push to main]
    Push --> GHA[GitHub Actions<br/>Azure Static Web Apps CI/CD]
    GHA --> Install[npm install / npm ci]
    Install --> Build[npm run build]
    Build --> Export[Next.js static export<br/>out folder]
    Export --> Deploy[Deploy to Azure Static Web Apps]
    Deploy --> Site[Published Web App]
```

## Rent Data Update Flow

### As-Is

Currently, the ONS Excel file is downloaded manually and converted into JSON locally.

```mermaid
flowchart TD
    Download[Download ONS rent Excel manually] --> RawExcel[data/raw/datadownload.xlsx]
    RawExcel --> Convert[npm run convert:rent]
    Convert --> RentJson[public/data/london-rents.json]
    RentJson --> Commit[git commit]
    Commit --> Push[git push]
    Push --> Deploy[Azure Static Web Apps CI/CD]
```

### To-Be

In the future, GitHub Actions will periodically download the latest ONS Excel file and automatically update the JSON rent data.

```mermaid
flowchart TD
    Schedule[Monthly GitHub Actions<br/>planned] --> Download[Download latest ONS rent Excel]
    Download --> Convert[npm run convert:rent]
    Convert --> Validate[Validate generated JSON]
    Validate --> HasChanges{london-rents.json changed?}
    HasChanges -->|Yes| Commit[Auto commit updated JSON]
    Commit --> Push[Push to repository]
    Push --> Deploy[Azure Static Web Apps CI/CD]
    HasChanges -->|No| End[No update]
```

## Data Structure

### Boundary Data

The London borough boundary data is generated from the ONS Local Authority District boundary data.

The original dataset contains boundary data for the whole UK. For this MVP, only London-related Local Authority codes starting with `E09` are extracted.

Output file:

```text
public/data/london-boroughs.geojson
```

Conversion script:

```text
scripts/filter-london-boroughs.mjs
```

This script performs the following steps:

* Reads the ONS Local Authority District GeoJSON file
* Extracts only London boroughs and the City of London
* Converts geometry coordinates from British National Grid coordinates (EPSG:27700) to longitude / latitude coordinates (EPSG:4326), which can be used by Azure Maps
* Outputs the result as `public/data/london-boroughs.geojson`

### Rent Data

The rent data is generated from the ONS `Price Index of Private Rents (PIPR), UK: monthly price statistics` Excel file.

Output file:

```text
public/data/london-rents.json
```

Conversion script:

```text
scripts/convert-rent-excel.mjs
```

This script performs the following steps:

* Reads the ONS Excel file
* Automatically detects columns such as `Time period`, `Area code`, `Area name`, and `Rental price`
* Extracts only records where the Area code starts with `E09`, which represents London boroughs
* Converts Excel serial date values into `YYYY-MM` format
* Converts the rent data into a JSON format that can be easily used by the application
* Outputs `latestPeriod` and `availablePeriods`

Note: Some ONS Excel files may use the 1904 date system. Therefore, the script checks the workbook settings before converting Excel serial date values.

## Data Attribution

This application uses processed data from the Office for National Statistics.

```text
Source: Office for National Statistics licensed under the Open Government Licence v3.0.
Contains OS data © Crown copyright and database right 2025.
```

## Local Development

### Install Dependencies

```bash
npm install
```

### Environment Variables

For local development, create a `.env.local` file in the project root and set the Azure Maps key.

```env
NEXT_PUBLIC_AZURE_MAPS_KEY=your_azure_maps_key
```

The `.env.local` file is not managed by Git.

### Start Development Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Data Conversion

### Convert Rent Data to JSON

Place the ONS Excel file in the following location:

```text
data/raw/datadownload.xlsx
```

Then run:

```bash
npm run convert:rent
```

Output file:

```text
public/data/london-rents.json
```

### Extract London Boundary Data

Place the ONS Local Authority District boundary GeoJSON file in the following location:

```text
data/raw/local-authority-districts-dec-2025-uk-bgc.geojson
```

Then run:

```bash
node scripts/filter-london-boroughs.mjs
```

Output file:

```text
public/data/london-boroughs.geojson
```

## Authentication

In the production environment, the application uses Azure Static Web Apps authentication.

Configuration file:

```text
public/staticwebapp.config.json
```

Main configuration:

* `/login` is accessible to anonymous users
* `/_next/*` is allowed for anonymous users because it is required to render the login page
* `/*` is restricted to authenticated users only
* Unauthenticated users are redirected to `/login`

During local development with `npm run dev`, Azure Static Web Apps authentication rules are not fully reproduced.

In the production environment, login is required through `staticwebapp.config.json`.

## Deployment

This application is deployed to Azure Static Web Apps through GitHub Actions.

Typical deployment flow:

```text
git push
  → GitHub Actions
  → npm run build
  → Deploy to Azure Static Web Apps
```

The Azure Maps key is managed through GitHub Actions Secrets.

```text
NEXT_PUBLIC_AZURE_MAPS_KEY
```

## Main Features

### Rent Map

The Rent Map tab provides the following features:

* Select year and month
* Colour London boroughs by rent range for the selected period
* Click a borough to display its rent trend chart
* View rent price and annual change for the selected period

### Recommended Restaurants

This feature is not implemented yet.

The tab is currently displayed as a disabled placeholder for a future feature.

## Remaining Tasks

### Automated Rent Data Update

Currently, the ONS Excel file is downloaded manually and converted into JSON by running `npm run convert:rent`.

In the future, the following process will be automated using GitHub Actions:

* Periodically download the latest ONS rent Excel file
* Temporarily save it as `data/raw/datadownload.xlsx`
* Run `npm run convert:rent`
* Update `public/data/london-rents.json`
* Automatically commit the updated file only when there are data changes
* Trigger the existing Azure Static Web Apps CI/CD pipeline and deploy the updated data

Expected schedule:

```text
Around the 23rd of each month, subject to confirmation
```

The ONS rent data is updated monthly, so the automated process is expected to run shortly after the monthly release.

### Validation Required for Automated Updates

To prevent invalid data from being committed due to an incorrect Excel file or format changes, the automated update process should include the following checks:

* `records` is not empty
* `latestPeriod` exists
* The latest period contains 32 London borough records
* If JSON generation fails, no commit should be created

## Out of Scope

The following items are future To-Be candidates but are currently out of scope:

* Employee nearest station pin registration
* Employee recommended restaurant registration
* Azure SQL Database integration
* User input data persistence
* Admin screen

***
***
# London Life App

London Life App は、ロンドンで生活を始める人向けに、Webアプリです。
現在のMVPでは、ONSの家賃データとLondon borough境界データを利用し、ロンドン各エリアの家賃水準を地図上で確認できる機能を提供することで、
住居エリア選びを支援する機能を備えています。

## 現在のMVP範囲

現在実装済みの機能は以下です。

- Azure Static Web Appsへのデプロイ
- Azure Static Web Apps built-in authenticationによるログイン必須化
- Azure Mapsを利用したロンドン地図表示
- ONSのLondon borough境界データ表示
- ONSの家賃データをJSON化して利用
- 年月選択による家賃レンジの色分け
- boroughクリック時の家賃推移グラフ表示
- Rent Map / Recommended Restaurants のタブ構成
- ダークテーマベースのUI
- レスポンシブ対応

Recommended Restaurants タブは将来機能のプレースホルダーとして表示しています。

## 技術スタック


| 項目             | 内容                                            |
| -------------- | --------------------------------------------- |
| Frontend       | Next.js / TypeScript                          |
| Hosting        | Azure Static Web Apps                         |
| Authentication | Azure Static Web Apps built-in authentication |
| Map            | Azure Maps                                    |
| Chart          | Recharts                                      |
| Data source    | Office for National Statistics                |
| CI/CD          | GitHub Actions                                |
| Repository     | GitHub private repository                     |


## システム構成図

以下は、現在のMVPと今後予定している家賃データ自動取得を含めた全体構成です。

```mermaid
flowchart LR
    User[User / Browser] --> SWA[Azure Static Web Apps]

    SWA --> Auth[Static Web Apps Authentication]
    SWA --> App[Next.js Static Site]
    App --> AzureMaps[Azure Maps]

    App --> BoundaryJson[public/data/london-boroughs.geojson]
    App --> RentJson[public/data/london-rents.json]

    ONSBoundary[ONS Boundary Data] --> BoundaryScript[scripts/filter-london-boroughs.mjs]
    BoundaryScript --> BoundaryJson

    ONSRent[ONS Rent Excel] --> RentScript[scripts/convert-rent-excel.mjs]
    RentScript --> RentJson

    GitHub[GitHub Repository] --> Actions[GitHub Actions]
    Actions --> SWA

    GitHubSecrets[GitHub Actions Secrets<br/>NEXT_PUBLIC_AZURE_MAPS_KEY] --> Actions

    ScheduledUpdate[Scheduled GitHub Actions<br/>planned] -.-> ONSRent
    ScheduledUpdate -.-> RentScript
    ScheduledUpdate -.-> RentJson
    ScheduledUpdate -.-> GitHub
```



## CI/CDパイプライン

通常のアプリデプロイは、GitHubへのpushを起点に実行されます。

```mermaid
flowchart TD
    Dev[Developer] --> Push[git push to main]
    Push --> GHA[GitHub Actions<br/>Azure Static Web Apps CI/CD]
    GHA --> Install[npm install / npm ci]
    Install --> Build[npm run build]
    Build --> Export[Next.js static export<br/>out folder]
    Export --> Deploy[Deploy to Azure Static Web Apps]
    Deploy --> Site[Published Web App]
```



## 家賃データ更新フロー

(As-Is) 現在は、ONSからExcelを手動でダウンロードし、ローカルでJSONへ変換しています。

```mermaid
flowchart TD
    Download[Download ONS rent Excel manually] --> RawExcel[data/raw/datadownload.xlsx]
    RawExcel --> Convert[npm run convert:rent]
    Convert --> RentJson[public/data/london-rents.json]
    RentJson --> Commit[git commit]
    Commit --> Push[git push]
    Push --> Deploy[Azure Static Web Apps CI/CD]
```



(To-Be) 将来的には、GitHub ActionsでONSの最新Excelを定期取得し、自動でJSONを更新する予定です。

```mermaid
flowchart TD
    Schedule[Monthly GitHub Actions<br/>planned] --> Download[Download latest ONS rent Excel]
    Download --> Convert[npm run convert:rent]
    Convert --> Validate[Validate generated JSON]
    Validate --> HasChanges{london-rents.json changed?}
    HasChanges -->|Yes| Commit[Auto commit updated JSON]
    Commit --> Push[Push to repository]
    Push --> Deploy[Azure Static Web Apps CI/CD]
    HasChanges -->|No| End[No update]
```



## データ構成

### 境界データ

London borough境界データは、ONSのLocal Authority District境界データを元に作成しています。

元データはUK全体の境界データですが、MVPではLondonのみを利用するため、`E09` で始まるLocal Authority codeのみを抽出しています。

出力ファイル:

```text
public/data/london-boroughs.geojson
```

変換スクリプト:

```text
scripts/filter-london-boroughs.mjs
```

このスクリプトでは、以下を実施しています。

- ONSのLocal Authority District GeoJSONを読み込み
- London borough / City of Londonのみ抽出
- British National Grid座標系（EPSG:27700）のgeometryを、Azure Mapsで扱えるlongitude / latitude形式（EPSG:4326）へ変換
- `public/data/london-boroughs.geojson` として出力

### 家賃データ

家賃データは、ONSの `Price Index of Private Rents (PIPR), UK: monthly price statistics` のExcelを元に作成しています。

出力ファイル:

```text
public/data/london-rents.json
```

変換スクリプト:

```text
scripts/convert-rent-excel.mjs
```

このスクリプトでは、以下を実施しています。

- ONS Excelを読み込み
- `Time period`, `Area code`, `Area name`, `Rental price` などの列を自動検出
- London boroughのArea codeである `E09` のデータのみ抽出
- Excelの日付シリアル値を `YYYY-MM` 形式に変換
- 家賃データをアプリで扱いやすいJSON形式に変換
- `latestPeriod` と `availablePeriods` を出力

注意点として、ONS Excelは1904 date systemを使う場合があるため、Workbookの設定を確認したうえで日付変換しています。

## データ出典

このアプリでは、Office for National Statisticsのデータを加工して利用しています。

```text
Source: Office for National Statistics licensed under the Open Government Licence v3.0.
Contains OS data ? Crown copyright and database right 2025.
```

## ローカル開発

### 依存関係のインストール

```bash
npm install
```

### 環境変数

ローカル環境では、プロジェクト直下に `.env.local` を作成し、Azure Mapsのキーを設定します。

```env
NEXT_PUBLIC_AZURE_MAPS_KEY=your_azure_maps_key
```

`.env.local` はGit管理しません。

### 開発サーバー起動

```bash
npm run dev
```

### ビルド

```bash
npm run build
```

## データ変換

### 家賃データをJSON化

ONS Excelを以下に配置します。

```text
data/raw/datadownload.xlsx
```

その後、以下を実行します。

```bash
npm run convert:rent
```

出力ファイル:

```text
public/data/london-rents.json
```

### 境界データをLondonのみに抽出

ONSのLocal Authority District境界GeoJSONを以下に配置します。

```text
data/raw/local-authority-districts-dec-2025-uk-bgc.geojson
```

その後、以下を実行します。

```bash
node scripts/filter-london-boroughs.mjs
```

出力ファイル:

```text
public/data/london-boroughs.geojson
```

## 認証

本番環境では、Azure Static Web Appsの認証機能を利用しています。

設定ファイル:

```text
public/staticwebapp.config.json
```

主な設定内容:

- `/login` は未ログインユーザーでもアクセス可能
- `/_next/*` はログイン画面表示に必要なためanonymous許可
- `/*` は `authenticated` のみ許可
- 未ログイン時は `/login` へリダイレクト

ローカル開発時の `npm run dev` では、Azure Static Web Appsの認証ルールは完全には再現されません。
本番環境では `staticwebapp.config.json` によりログイン必須になります。

## デプロイ

このアプリは、GitHub Actions経由でAzure Static Web Appsへデプロイされます。

通常の流れ:

```text
git push
  → GitHub Actions
  → npm run build
  → Azure Static Web Appsへデプロイ
```

Azure Mapsのキーは、GitHub Actions Secretsで管理します。

```text
NEXT_PUBLIC_AZURE_MAPS_KEY
```

## 現在の主な機能

### Rent Map

Rent Mapタブでは、以下ができます。

- 年月を選択
- 選択年月の家賃レンジでLondon boroughを色分け
- boroughをクリックして、家賃推移グラフを表示
- 選択年月における家賃と年間変化率を確認

### Recommended Restaurants

現時点では未実装です。
将来機能のプレースホルダーとしてdisabled tabを表示しています。

## 残タスク

### 家賃データ自動取得

現在は、ONS Excelを手動でダウンロードし、`npm run convert:rent` でJSONを生成しています。

今後、GitHub Actionsを利用して、以下を自動化する予定です。

- ONSの最新家賃Excelを定期取得
- `data/raw/datadownload.xlsx` として一時保存
- `npm run convert:rent` を実行
- `public/data/london-rents.json` を更新
- データに変更がある場合のみ自動commit
- 既存のAzure Static Web Apps CI/CDにより自動デプロイ

想定実行タイミング:

```text
毎月23日頃か？
```

ONSの家賃データは月次で更新されるため、公開日直後に取得する想定です。

### 自動取得時に必要なチェック

自動更新時には、誤ったExcelや形式変更による不正データのcommitを防ぐため、以下のチェックを行う予定です。

- `records` が0件ではないこと
- `latestPeriod` が存在すること
- 最新年月のLondon borough件数が32件であること
- JSON生成に失敗した場合はcommitしないこと

## 対象外

以下はMVP後のToBe候補ですが、現時点では対象外です。

- 社員の最寄り駅ピン登録
- 社員おすすめレストラン登録
- Azure SQL Database連携
- ユーザー入力データの保存
- 管理画面

