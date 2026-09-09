onBootstrap((e) => {
  const authConfig = require(`${__hooks}/auth-config.cjs`);
  authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
  e.next();
});
