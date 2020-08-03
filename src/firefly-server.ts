import { NodeOptions } from './setup-ganache';

const portscanner = require('portscanner');
const { spawn, exec } = require("child_process");

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

class FireflyServer {
    port: number;
    constructor(port: number) {
        this.port = port;
    }
    address() {
        return { port: this.port };
    }
    close() {
        exec("kill -9 $(lsof -i:" + this.port + " -t)");
    }
    listen(port: any, callback: Function) {
        callback();
    }
}

namespace Firefly {
    export async function server(nodeOptions: NodeOptions): Promise<any> {
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

        var portList = [];
        for (var i = 8000; i <= 9000; i++) {
            portList.push(i);
        }

        var currPort = await portscanner.findAPortNotInUse(portList, 'localhost');
        var cmd = "/home/wenhao/firefly/firefly-test firefly . launch -p " + currPort + " " + options + " &";

        const server = spawn(cmd, [], { shell: true, detached: true, stdio: 'ignore' });
        server.unref();

        // Wait for server to start
        await ensureServerIsSet(currPort);
        // Wait for accounts to be configured
        await sleep(1000);

        return Promise.resolve(new FireflyServer(currPort));
    };

}

export default Firefly;
