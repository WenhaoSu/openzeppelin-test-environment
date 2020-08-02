import ganache from 'ganache-core';

import { Message, NodeOptions } from './setup-ganache';

const portscanner = require('portscanner');
const { spawn } = require("child_process");

function send(msg: Message): void {
  if (process.send === undefined) {
    throw new Error('Module must be started through child_process.fork');
  }
  process.send(msg);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ensureServerIsSet(currPort: number) {
  return new Promise(function (resolve, reject) {
    (async function waitForServer() {
      var isServerOn = await portscanner.checkPortStatus(currPort, 'localhost');
      if (isServerOn == 'open') return resolve();
      setTimeout(waitForServer, 30);
    })();
  });
}

function setupServerWithGanache(nodeOptions: NodeOptions): any {
  if (!nodeOptions.coverage) {
    return Promise.resolve(ganache.server(nodeOptions));
  } else {
    return Promise.resolve(require('ganache-core-coverage').server({
      ...nodeOptions,
      emitFreeLogs: true,
      allowUnlimitedContractSize: true,
    }));
  }
}

async function setupServerWithFirefly(nodeOptions: NodeOptions): Promise<number> {
  // Get command line options for Firefly
  var options = "";
  nodeOptions.accounts.forEach((account) => {
    var str = '\"' + account.secretKey + '\,' + account.balance + '\"';
    options = options + "--account=" + str + " ";
  });
  options += "--gasLimit " + nodeOptions.gasLimit + " ";
  options += "--gasPrice " + nodeOptions.gasPrice + " ";

  // TODO: Currently `allowUnlimitedContractSize` occasionally raises error, needs investigation
  // if (nodeOptions.allowUnlimitedContractSize) options += "--allowUnlimitedContractSize "

  var currPort = await portscanner.findAPortNotInUse([8000, 9000], 'localhost');
  var cmd = "/home/wenhao/firefly/firefly-test firefly . launch -p " + currPort + " " + options + " &";

  const server = spawn(cmd, [], { shell: true, detached: true, stdio: 'ignore' });
  server.unref();

  // Wait for server to start
  await ensureServerIsSet(currPort);
  // Wait for accounts to be configured
  await sleep(600);

  return Promise.resolve(currPort);
}

function setupServer(nodeOptions: NodeOptions, serverType = 'ganache-core'): any {
  if (serverType == 'ganache-core') {
    return setupServerWithGanache(nodeOptions);
  }
  if (serverType == 'firefly') {
    return setupServerWithFirefly(nodeOptions);
  }
}

process.once('message', (options: NodeOptions) => {
  // const server = setupServer(options);

  // An undefined port number makes ganache-core choose a random free port,
  // which plays nicely with environments such as jest and ava, where multiple
  // processes of test-environment may be run in parallel.
  // It also means however that the port (and therefore host URL) is not
  // available until the server finishes initialization.

  // setupServer(options, 'firefly').then((port: number, err: unknown) => {
  //   if (err) {
  //     send({ type: 'error' });
  //   } else {
  //     send({ type: 'ready', port: port });
  //   }
  //   process.on('disconnect', () => {
  //     exec("kill -9 $(lsof -i:" + port + " -t)");
  //   });
  // });

  setupServer(options, 'ganache-core').then((server: any) => {
    server.listen(undefined, function (err: unknown) {
      if (err) {
        send({ type: 'error' });
      } else {
        send({ type: 'ready', port: server.address().port });
      }
      process.on('disconnect', () => {
        server.close();
      });
    });
  });

});
