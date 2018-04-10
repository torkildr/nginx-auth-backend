const yaml = require('js-yaml');

exports.load = () => {
  const allVariables = [
    'AUTH_CONFIG',
    'AUTH_DOMAIN_ROOT',
    'AUTH_DOMAIN_BACKEND',
    'AUTH_DOMAIN_MAP',
  ].map((env) => {
    if (!process.env[env]) {
      console.error(`variable ${env} is not defined`);
      return false;
    }
    return true;
  });

  if (!allVariables.every(x => x)) {
    process.exit(-1);
  }

  const config = yaml.safeLoad(require('fs').readFileSync(process.env.AUTH_CONFIG));
  config.backend = { url: `https://${process.env.AUTH_DOMAIN_BACKEND}` };
  config.routing = JSON.parse(process.env.AUTH_DOMAIN_MAP);

  return config;
};

