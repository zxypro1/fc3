import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import zip from '@serverless-devs/zip';
import { getRootHome } from '@serverless-devs/utils';

import { IFunction, IInputs, ILogConfig, INasConfig, IVpcConfig } from '../../../../interface';
import logger from '../../../../logger';
import { isAuto } from '../../../../utils';
import Info from '../../../info';
import { FC_API_NOT_FOUND_ERROR_CODE } from '../../../../constant';
import FC from '../../../../resources/fc';
import Acr from '../../../../resources/acr';

type IType = 'code' | 'config' | boolean;
interface IOpts {
  type?: IType;
  yes?: boolean;
  skipPush?: boolean;
}

export default class Utils {
  readonly type: IType;
  readonly baseDir: string;
  readonly skipPush: boolean = false;

  needDeploy?: boolean;
  remote?: any;
  local: IFunction;
  readonly fcSdk: FC;

  constructor(readonly inputs: IInputs, opts: IOpts) {
    this.type = opts?.type;
    this.needDeploy = opts?.yes;
    this.skipPush = opts?.skipPush;

    logger.debug(`deploy function type: ${this.type}`);

    this.baseDir = path.dirname(inputs.yaml.path || process.cwd());
    logger.debug(`baseDir is: ${this.baseDir}`);
  
    this.local = _.cloneDeep(inputs.props.function);
    this.fcSdk = new FC(inputs.props.region, inputs.credential)
  }

  /**
   * 计算当前local那些资源是 auto
   * @returns 
   */
  computeLocalAuto() {
    const nasAuto = isAuto(this.local.nasConfig);
    const vpcAuto = isAuto(this.local.vpcConfig) || (!this.local.vpcConfig && nasAuto);
    const slsAuto = isAuto(this.local.logConfig);
    const roleAuto = _.isNil(this.local.role) && (nasAuto || vpcAuto || slsAuto);
    return { nasAuto, vpcAuto, slsAuto, roleAuto };
  }

  /**
   * 获取线上资源配置
   */
  getRemoveResourceConfig() {
    const remoteNasConfig = _.get(this.remote, 'nasConfig') as INasConfig;
    const remoteVpcConfig = _.get(this.remote, 'vpcConfig') as IVpcConfig;
    const remoteLogConfig = _.get(this.remote, 'logConfig') as ILogConfig;
    const remoteRole = _.get(this.remote, 'role');
    return { remoteNasConfig, remoteVpcConfig, remoteLogConfig, remoteRole };
  }

  /**
   * 获取线上函数配置
   * @returns 
   */
  async getRemote() {
    const info = new Info(this.inputs);
    const remote = await info.getFunction();
    if (remote?.error) {
      if (remote?.error.code !== FC_API_NOT_FOUND_ERROR_CODE.FunctionNotFound) {
        logger.error(remote.error.message);
      }
      return;
    }
    this.remote = remote;
  }

  /**
   * 上传镜像
   */
  async pushImage() {
    const { image, acrInstanceID } = this.local.customContainerConfig || {};
    if (_.isNil(image)) {
      throw new Error('CustomContainerRuntime must have a valid image URL');
    }
    const acr = new Acr(this.inputs.props.region, this.inputs.credential);
    try {
      await acr.pushAcr(image, acrInstanceID);
    } catch (err) {
      logger.warn(`push image ${image} error: ${err}`);
    }
  }

  /**
   * 压缩和上传代码包
   */
  async uploadCode() {
    const codeUri = this.local.code;
    if (_.isNil(codeUri)) {
      throw new Error('Code config is empty');
    }
    // 支持 ossBucketName / ossObjectName 配置
    if (typeof codeUri !== 'string') {
      if (!(codeUri?.ossBucketName && codeUri?.ossObjectName)) {
        throw new Error('Code config must be a string or an object containing ossBucketName and ossObject Name');
      }
      return;
    }

    let zipPath: string = path.isAbsolute(codeUri) ? codeUri : path.join(this.baseDir, codeUri);
    logger.debug(`Code path absolute path: ${zipPath}`);

    const needZip = this.assertNeedZip(codeUri);
    logger.debug(`Need zip file: ${needZip}`);

    let generateZipFilePath: string;
    if (needZip) {
      const zipConfig = {
        codeUri: zipPath,
        outputFileName: `${this.inputs.props.region}_${this.local.functionName}_${Date.now()}`,
        outputFilePath: path.join(getRootHome(), '.s', 'fc', 'zip'),
        ignoreFiles: ['.fcignore'],
      };
      generateZipFilePath = (await zip(zipConfig)).outputFile;
      zipPath = generateZipFilePath;
    }
    logger.debug(`Zip file: ${zipPath}`);

    const ossConfig = await this.fcSdk.uploadCodeToTmpOss(zipPath);
    logger.debug('ossConfig: ', ossConfig);
    _.set(this.local, 'code', ossConfig);

    if (generateZipFilePath) {
      try {
        fs.rmSync(generateZipFilePath);
      } catch (ex) {
        logger.debug(`Unable to remove zip file: ${zipPath}`);
      }
    }
  }

  /**
   * 判断是否需要压缩代码
   */
  assertNeedZip(codeUri: string): boolean {
    // 如果 .jar 结尾
    //    custom runtime 并且启动命令包含 java -jar 就需要压缩
    //    官方的 runtime，那么不需要压缩
    if (codeUri.endsWith('.jar')) {
      const runtime = this.local.runtime;
      const command = _.get(this.local, 'customRuntimeConfig.command', []);
      const args = _.get(this.local, 'customRuntimeConfig.args', []);
  
      const commandStr = `${_.join(command, ' ')} ${_.join(args, ' ')}`;
      if (FC.isCustomRuntime(runtime) && commandStr.includes('java -jar')) {
        return true;
      }
      return false;
    }

    return !(codeUri.endsWith('.zip') || codeUri.endsWith('.war'));
  }
}
