import { yellow, green, red, bold } from 'chalk';
import fs from 'fs';
import _ from 'lodash';
import path from 'path';

import { IInputs } from "../../interface";
import logger from "../../logger";
import FC from "../../resources/fc";
import { parseArgv } from '@serverless-devs/utils';


export default class Invoke {
  private functionName: string;
  private fcSdk: FC;
  private payload: string;

  constructor(inputs: IInputs) {
    this.functionName = inputs.props.function?.functionName;
    this.fcSdk = new FC(inputs.props.region, inputs.credential);
    const { payload, 'event-file': eventFile } = parseArgv(inputs.args, {
      string: ['payload', '--event-file'],
    });

    if (_.isString(payload)) {
      this.payload = payload;
    } else if (_.isString(eventFile) && eventFile) {
      const p = path.isAbsolute(eventFile) ? eventFile : path.join(process.cwd(), eventFile);
      if (!fs.existsSync(p)) {
        throw new Error(`Cannot find event-file "${eventFile}".`);
      }
      this.payload = fs.readFileSync(p, 'utf-8');
    }
  }

  async run() {
    logger.debug(`Running invoke payload: ${this.payload}`);

    const result = await this.fcSdk.invokeFunction(this.functionName, {
      payload: this.payload,
    });
    logger.debug(`invoke function ${this.functionName} result ${JSON.stringify(result)}`);

    this.showLog(result.headers, result.body);
  }

  private showLog(headers, body) {
    const {
      'x-fc-code-checksum': codeChecksum,
      'x-fc-instance-id': instanceId,
      'x-fc-invocation-service-version': qualifier,
      // 'x-fc-request-id': requestId,
      'x-fc-error-type': errorType,
      'x-fc-log-result': log,
    } = headers || {};

    const startStr = yellow('========= FC invoke Logs begin =========');
    const endStr = yellow('========= FC invoke Logs end =========');

    let showLog = `${startStr}\n${log}\n${endStr}\n
${bold('Invoke instanceId:')} ${green(instanceId)}
${bold('Code Checksum:')} ${green(codeChecksum)}
${bold('Qualifier:')} ${green(qualifier)}
`;
  
    if (headers['x-fc-error-type']) {
      showLog += `${bold('Error Type:')} ${red(errorType)}

${bold('Invoke Result:')} 
${red(body)}`;
    } else {
      showLog += `
${bold('Invoke Result:')} 
${green(body)}`;
    }

    logger.write(showLog);
  }
}