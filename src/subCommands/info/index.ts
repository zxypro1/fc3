import { ICredentials } from '@serverless-devs/component-interface';
import _ from 'lodash';
import { RegionList, IInputs, IRegion } from '../../interface';
import FC from '../../resources/fc';
import logger from '../../logger';

export default class Info {
  readonly region: IRegion;
  readonly functionName: string;
  readonly fcSdk: FC;

  constructor(private inputs: IInputs) {
    this.region = _.get(inputs, 'props.region');
    this.functionName = _.get(inputs, 'props.function.functionName');
    this.checkProps();
    this.fcSdk = new FC(this.region, this.inputs.credential as ICredentials);
  }

  async run() {
    const functionConfig = await this.getFunction();
    return {
      region: this.region,
      function: this.getConfig(functionConfig),
    };
  }

  async getFunction(): Promise<{ error: any } | any> {
    try {
      const result = await this.fcSdk.getFunction(this.functionName);
      const body = result.toMap().body;
      return body;
    } catch (ex) {
      logger.debug(`Get function ${this.functionName} error: ${ex}`);
      return {
        error: ex,
      };
    }
  }

  private getConfig(config: any) {
    if (config?.error) {
      return {
        error: {
          code: config.error.code,
          message: config.error.message,
        },
      };
    }

    return config;
  }

  private checkProps() {
    if (!_.includes(RegionList, this.region)) {
      throw new Error(`Invalid region: ${this.region}`);
    }

    if (!_.isString(this.functionName)) {
      throw new Error(`Invalid function.functionName: ${this.region}`);
    }
  }
}
