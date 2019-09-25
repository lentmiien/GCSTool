// shipitfile.js
module.exports = shipit => {
  // Load shipit-deploy tasks
  require('shipit-deploy')(shipit);
  require('shipit-npm')(shipit);

  shipit.initConfig({
    default: {
      deployTo: '/home/deploy/test',
      repositoryUrl: 'https://github.com/lentmiien/GCSTool.git'
    },
    staging: {
      servers: 'onyx'
    }
  });

  // Copy process.env file
  shipit.task('copyConfig', async () => {
    await shipit.copyToRemote('.env', '/home/deploy/test/.env');
  });
  /*
  // Copy config file example
  shipit.task('copyConfig', async () => {
    await shipit.copyToRemote(
      'config.json',
      '/var/apps/super-project/config.json',
    )
  })
  */
};

// Deploy with
// npx shipit staging deploy

// Rollback with
// npx shipit staging rollback
