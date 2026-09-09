onBootstrap((e) => {
  const authConfig = require(`${__hooks}/auth-config.cjs`);
  const configuration = authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
  authConfig.configurePocketBaseMail($app, configuration);
  e.next();
});
