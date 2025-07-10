# PolkaTax

PolkaTax is a tool to show and export 

- accumulated staking rewards 
- transfers 
- trades

PolkaTax supports multiple substrate chains, Ethereum chains (L1 and L2s) and fiat currencies.

Data can be shown as graph and table and can be exported in CSV and JSON format.

This project does NOT offer a one-click solution to taxation of crypto currencies.
Rather, the user is encouraged to export the data to CSV for further processing.

Note: At this time, only staking rewards export is supported.

## Install the dependencies

The project is split into a server and a client folder

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

### Run integration tests with playwright

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
| crypto-currency-prices   | Fetches current and historical crypto currency prices                                         | 3002 | CRYPTO_CURRENCY_PRICES_PORT     |
| fiat-exchange-rates      | Fetches historical exchange rates of all fiat currencies                                      | 3003 | FIAT_EXCHANGE_RATES_PORT        |
| server                   | Serves the frontend, fetches tax relevant data and enriches data with help of the other two services | 3001 |                                  |

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
To start a single service, use:
```bash
npm run start:fiat-exchange-rates 
```

To run the app with stubbed services for local testing:
```bash
npm run start-with-stubs
```
This will provide dummy values for fiat-to-fiat values, allowing you to test without needing an EXCHANGERATE_HOST_API_KEY.

### Running e2e-test

Note: E2E tests make calls to the Subscan API and require a valid SUBSCAN_API_KEY.

To run the E2E tests, navigate to the `server` folder and execute:
```bash
npm run e2e-tests
```

## Prerequisites
To run the server locally you should provide multiple API keys as environment variables.
Only the `SUBSCAN_API_KEY` is absolutely mandatory (see stubs in section above). 

| API   |      Environment variable name      |  Required for |
|----------|:-------------:|:-------------:|
| exchangerate_host | EXCHANGERATE_HOST_API_KEY | fetching fiat exchange rates |
| subscan |  SUBSCAN_API_KEY | any substrate related functions |


## Run in production

### Production setup

In production, several additional environment settings are needed.
Locally, an in-memory DB is used to store jobs. In production, a proper DB connection must be configured.

Furthermore, there are additional environment variables which are not mandatory but recommended for production:

| API   |      Environment variable name      |  Required for |
|----------|:-------------:|:-------------:|
| exchangerate_host | EXCHANGERATE_HOST_API_KEY | fetching fiat exchange rates |
| subscan |  SUBSCAN_API_KEY | any substrate related functions |
| postgres db | POSTGRES_DATABASE | 	flag that determines if PostgreSQL is used to cache jobs / user data |
| postgres db | DB_PASSWORD | password for the database |
| rest / postgres db | USE_DATA_PLATFORM_API | flag that determines if pre-collected and aggregated data should be used |
| zyte | ZYTE_USER | accessing coingecko.com via Zyte proxy |

### Start in production

For production environments, first build the application:
```bash
npm run build
```

And run with pm2:
```bash
cd server
pm2 start prod.config.js
```

## Create substrate chain list

Run 
```bash
npm run generate-subscan-chain-list
```
This will generate a new list of substrate chains in the `res/gen/` folder.

## coingecko

The current implementation uses coingecko, however without API key.
The reason are the relatively high costs of purchasing a coingecko API key.
The consequence is that you might encounter errors with code 429 from coingecko if too many requests are made. To mitigate this issue [ZYTE](https://www.zyte.com/) is used in production.

## Documentation of Architecture 

[View Architecture Diagram](docs/architecture/architecture.drawio.png)


Gradio xml file:
- [Architecture](docs/architecture/architecture.xml)

## Documentation of Data flow
- [Data Flow](docs/data-flow.md)