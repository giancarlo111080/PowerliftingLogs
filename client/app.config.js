const appJson = require("./app.json");

const configuredBaseUrl = process.env.EXPO_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");

module.exports = {
  expo: {
    ...appJson.expo,
    experiments: {
      ...appJson.expo.experiments,
      ...(configuredBaseUrl ? { baseUrl: configuredBaseUrl } : {})
    }
  }
};