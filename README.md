# PolkaTax

PolkaTax is a tool to show and export:

- Staking rewards
- Transfers
- Trades

PolkaTax supports multiple Substrate chains but does not analyze EVM transactions.

Data can be displayed as graphs and tables and can be exported in CSV and JSON formats.

This project does **not** offer a one-click solution for cryptocurrency taxation.  
Rather, users are encouraged to export the data to CSV for further processing.

## Install the dependencies

The project is split into a `server` and a `client` folder:

```bash
npm install
cd client
npm install
cd ../server
npm install
```

## The client

### Start the client in development mode (hot-code reloading, error reporting, etc.)

```bash
cd client
npm run dev
```

### Lint the client files

```bash
cd client
npm run lint
```

### Format the client files

```bash
cd client
npm run lint-fix
```

### Build the app for production

```bash
npm run build
```

### Run integration tests with Playwright

```bash
npm i -g playwright
npx playwright install chromium --with-deps
npm run integration-tests
```

## The server

### Services

The server-side of the application consists of three distinct services, each running in its own process and communicating via HTTP.

| Name                     | Function                                                                                      | Port | Port Env                         |
|--------------------------|-----------------------------------------------------------------------------------------------|------|----------------------------------|
| crypto-currency-prices   | Fetches current and historical cryptocurrency prices                                          | 3002 | CRYPTO_CURRENCY_PRICES_PORT     |
| fiat-exchange-rates      | Fetches historical exchange rates of all fiat currencies                                      | 3003 | FIAT_EXCHANGE_RATES_PORT        |
| server                   | Serves the frontend, fetches tax-relevant data, and enriches data with the help of the other two services | 3001 |                                  |

### Running the Services

To start all services in parallel, use:

```bash
npm run start
```

To start a single service, use:

```bash
npm run start:<service-name>
```

For example:

```bash
npm run start:fiat-exchange-rates 
```

To run the app with stubbed services for local testing:

```bash
npm run start-with-stubs
```

This will provide dummy values for fiat-to-fiat conversions, allowing you to test without needing an `EXCHANGERATE_HOST_API_KEY`.

### Running E2E Tests

> Note: E2E tests make calls to the Subscan API and require a valid `SUBSCAN_API_KEY`.

To run the E2E tests, navigate to the `server` folder and execute:

```bash
npm run e2e-tests
```

## Prerequisites

To run the server locally, you should provide multiple API keys as environment variables.  
Only the `SUBSCAN_API_KEY` is mandatory (see stubs section above).  

| API                | Environment Variable Name       | Required for                             |
|-------------------|:-------------------------------:|-----------------------------------------|
| exchangerate_host | EXCHANGERATE_HOST_API_KEY       | Fetching fiat exchange rates            |
| subscan           | SUBSCAN_API_KEY                 | Any Substrate-related functions         |

> To fetch XCM data, a **paid** Subscan API key is needed.  
> For testing, it's recommended to ignore XCM by setting the environment variable `XCM_DISABLED` to `true`.

## Run in Production

### Production Setup

In production, several additional environment variables are needed.  
Locally, an in-memory DB is used to store jobs. In production, a proper DB connection must be configured.

Additional environment variables (recommended for production):

| API / Service      | Environment Variable Name       | Required for                                                        |
|-------------------|:-------------------------------:|--------------------------------------------------------------------|
| exchangerate_host | EXCHANGERATE_HOST_API_KEY       | Fetching fiat exchange rates                                        |
| subscan           | SUBSCAN_API_KEY                 | Any Substrate-related functions                                     |
| postgres db       | POSTGRES_DATABASE               | Flag that determines if PostgreSQL is used to cache jobs/user data |
| postgres db       | DB_PASSWORD                     | Password for the database                                           |
| rest / postgres db| USE_DATA_PLATFORM_API           | Flag that determines if pre-collected and aggregated data is used  |
| zyte              | ZYTE_USER                       | Accessing coingecko.com via Zyte proxy                              |
| data platform     | USE_DATA_PLATFORM               | Determines if the data platform is used for certain requests       |
| data platform     | DATA_PLATFORM_PORT              | Defines the port used when fetching from the data platform         |

### Start in Production

Build the application:

```bash
npm run build
```

Run with pm2:

```bash
cd server
pm2 start prod.config.js
```

## Create Substrate Chain List

Run:

```bash
npm run generate-subscan-chain-list
```

This will generate a new list of Substrate chains in the `res/gen/` folder.

## Coingecko

The current implementation uses Coingecko **without an API key**.  
This avoids the costs of purchasing a Coingecko API key but may result in HTTP 429 errors if too many requests are made.  

In production, [ZYTE](https://www.zyte.com/) is used to mitigate rate-limit issues.

## Documentation of Architecture

[View Architecture Diagram](docs/architecture/architecture.drawio.png)

Gradio XML file:  
- [Architecture](docs/architecture/architecture.xml)

## Documentation of Data Flow

- [Data Flow](docs/data-flow.md)
