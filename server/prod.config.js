module.exports = {
  apps: [
    {
      name: "main-server-3001",
      script: "node ./dist/src/server/start-server.js",
      env: {
        ENV_FILE: "pm2.env",
      },
    },
    {
      name: "main-server-3004",
      script: "node ./dist/src/server/start-server.js",
      env: {
        ENV_FILE: "pm2-3004.env",
      },
    },
    {
      name: "crypto-currency-prices",
      script: "node ./dist/src/crypto-currency-prices/main.js",
    },
    {
      name: "fiat-exchange-rates",
      script: "node ./dist/src/fiat-exchange-rates/main.js",
    },
  ],
};
