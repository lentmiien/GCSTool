// shipitfile.js
module.exports = shipit => {
  // Load shipit-deploy tasks
  require('shipit-deploy')(shipit);
  require('shipit-npm')(shipit);
  require('shipit-shared')(shipit);

  shipit.initConfig({
    default: {
      deployTo: '/home/deploy/test',
      repositoryUrl: 'https://github.com/lentmiien/GCSTool.git',
      shared: {
        overwrite: true
      }
    },
    staging: {
      servers: 'onyx'
    }
  });

  // shipit.task('copyConfig', async () => {
  //   await shipit.copyToRemote('.env', '/home/deploy/test/.env');
  // });

  // shipit.on('updated', function() {
  //   shipit.start('copyConfig');
  // });
};

// Deploy with
// npx shipit staging deploy

// Rollback with
// npx shipit staging rollback
