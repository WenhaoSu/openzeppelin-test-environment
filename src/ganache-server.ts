import ganache from 'ganache-core';
import firefly from './firefly-server';

import { Message, NodeOptions } from './setup-ganache';

function send(msg: Message): void {
  if (process.send === undefined) {
    throw new Error('Module must be started through child_process.fork');
  }
  process.send(msg);
}

function setupServer(nodeOptions: NodeOptions, serverType = 'ganache-core'): any {
  if (serverType == 'ganache-core') {
    if (!nodeOptions.coverage) {
      return ganache.server(nodeOptions);
    } else {
      return require('ganache-core-coverage').server({
        ...nodeOptions,
        emitFreeLogs: true,
        allowUnlimitedContractSize: true,
      });
    }
  }
  if (serverType == 'firefly') {
    return firefly.server(nodeOptions);
  }
}

process.once('message', async (options: NodeOptions) => {
  const server = await setupServer(options, 'firefly');

  // An undefined port number makes ganache-core choose a random free port,
  // which plays nicely with environments such as jest and ava, where multiple
  // processes of test-environment may be run in parallel.
  // It also means however that the port (and therefore host URL) is not
  // available until the server finishes initialization.
  server.listen(undefined, function (err: unknown) {
    if (err) {
      send({ type: 'error' });
    } else {
      send({ type: 'ready', port: server.address().port });
    }
  });

  process.on('disconnect', () => {
    server.close();
  });
});
