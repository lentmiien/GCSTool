// shipitfile.js
module.exports = shipit => {
  // Load shipit-deploy tasks
  require('shipit-deploy')(shipit);
  require('shipit-npm')(shipit);

  shipit.initConfig({
    default: {
      deployTo: '/var/apps/super-project',
      repositoryUrl: 'https://github.com/user/super-project.git'
    },
    staging: {
      servers: 'onyx'
    }
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
