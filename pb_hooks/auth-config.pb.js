onBootstrap((e) => {
  const authConfig = require(`${__hooks}/auth-config.cjs`);
  const configuration = authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
  e.next();
  authConfig.configurePocketBaseMail($app, configuration);
});
