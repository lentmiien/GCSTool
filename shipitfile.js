/********
 * About ".env" file, with the current setup this file needs
 * to be updated manually in the shared folder on the server.
 */

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

  shipit.on('deployed', () => {
    const processName = 'gcstool';
    const env = shipit.environment;
    let cmd = `
        cd ${shipit.releasePath} && npm install --production && 
        (
            pm2 restart ${processName} ||
            NODE_ENV=${env} pm2 start server.js --name ${processName}
        )
    `;

    shipit.remote(cmd);
    // shipit.remote(`cd ${shipit.releasePath} && npm start`);
  });
};

// Deploy with
// npx shipit staging deploy

// Rollback with
// npx shipit staging rollback
