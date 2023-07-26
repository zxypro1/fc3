import _ from 'lodash';
import { IInputs, IRegion, ITrigger } from '../../interface';
import { diffConvertYaml } from '@serverless-devs/diff';
import FC, { GetApiType } from '../../resources/fc';
import { FC_API_ERROR_CODE } from '../../resources/fc/error-code';
import logger from '../../logger';
import { FC_TRIGGER_DEFAULT_CONFIG } from '../../default/config';

export default class Plan {
  readonly region: IRegion;
  readonly functionName: string;
  readonly triggers: ITrigger[];
  readonly fcSdk: FC;

  constructor(private inputs: IInputs) {
    this.region = _.get(this.inputs, 'props.region');
    this.functionName = _.get(inputs, 'props.function.functionName');
    this.triggers = _.get(inputs, 'props.triggers', []).map((item) => _.defaults(item, FC_TRIGGER_DEFAULT_CONFIG));;
    this.fcSdk = new FC(inputs.props.region, inputs.credential);
  }

  async run() {
    const functionConfig = await this.planFunction();
    const triggersConfig = await this.planTriggers();

    let showDiff = `
region: ${this.region}
function:
${functionConfig.show}
`;

    if (!_.isEmpty(triggersConfig)) {
      showDiff += `triggers:
${triggersConfig.show}`;
    }
    logger.write(showDiff);
  }

  private async planFunction() {
    let remote;
    try {
      remote = await this.fcSdk.getFunction(this.functionName, GetApiType.simpleUnsupported);
    } catch (ex) {
      logger.debug(`Get remote function config error: ${ex.message}`);
      if (ex.code === FC_API_ERROR_CODE.FunctionNotFound) {
        remote = {};
      }
    }
    const config = FC.replaceFunctionConfig(this.inputs.props.function, remote);
    return diffConvertYaml(config.remote, config.local, { deep: 1, complete: true });
  }

  private async planTriggers() {
    const result = [];
    for (const triggerConfig of this.triggers) {
      const { triggerName } = triggerConfig;
      let remote = {};
      try {
        remote = await this.fcSdk.getTrigger(
          this.functionName,
          triggerName,
          GetApiType.simpleUnsupported,
        );
      } catch (ex) {
        logger.debug(`Get remote function config error: ${ex.message}`);
        if (
          ex.code === FC_API_ERROR_CODE.FunctionNotFound ||
          ex.code === FC_API_ERROR_CODE.TriggerNotFound
        ) {
          remote = {};
        }
      }
      result.push(remote);
    }

    return diffConvertYaml(result, this.triggers, { deep: 1, complete: true });
  }
}
