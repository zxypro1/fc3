import { ICodeUri, IInputs } from '../../../interface';
import { ICredentials } from '@serverless-devs/component-interface';
import { isAcreeRegistry, getTimeZone, vpcImage2InternetImage } from './utils';
import path from 'path';
import _ from 'lodash';

import { mockDockerConfigFile } from './docker/acr-login';
import { defaultFcDockerVersion } from '../../../constant';
import logger from '../../../common/logger';

export class Builder {
  inputProps: IInputs;
  constructor(props: IInputs) {
    this.inputProps = props;
  }

  getProps(): any {
    return this.inputProps.props;
  }

  getRuntime(): string {
    return this.getProps().runtime;
  }

  getRegion(): string {
    return this.getProps().region;
  }

  async getCredentials(): Promise<ICredentials> {
    return this.inputProps.getCredential();
  }

  getAcrEEInstanceID(): string {
    return _.get(this.getProps().customContainerConfig.acrInstanceID);
  }

  isCustomContainerRuntime(): boolean {
    return this.getProps().runtime === 'custom-container';
  }

  getCodeUri(): string {
    if (!this.checkCodeUri()) {
      return '';
    }
    const codeUri = this.inputProps.props.codeUri;
    const src: string = _.isString(codeUri) ? (codeUri as string) : (codeUri as ICodeUri).src;
    const baseDir = process.cwd();
    const resolvedCodeUri = path.isAbsolute(src) ? src : path.join(baseDir, src);
    return resolvedCodeUri;
  }

  checkCodeUri(): boolean {
    const codeUri = this.inputProps.props.codeUri;
    if (!codeUri) {
      return false;
    }
    const src: string = _.isString(codeUri) ? (codeUri as string) : (codeUri as ICodeUri).src;
    if (!src) {
      logger.info('No Src configured, skip building.');
      return false;
    }

    if (_.endsWith(src, '.zip') || _.endsWith(src, '.jar') || _.endsWith(src, '.war')) {
      logger.info('Artifact configured, skip building.');
      return false;
    }
    return true;
  }

  getRuntimeBuildImage(): string {
    if (this.isCustomContainerRuntime()) {
      let image = vpcImage2InternetImage(this.getProps().customContainerConfig.image);
      return image;
    } else {
      // TODO, use fc.conf
      const fcDockerV = defaultFcDockerVersion;
      let image = `aliyunfc/runtime-${this.getRuntime()}:build-${fcDockerV}`;
      if (getTimeZone() === 'UTC+8') {
        image = `registry.cn-beijing.aliyuncs.com/aliyunfc/runtime-${this.getRuntime()}:build-${fcDockerV}`;
      } else {
        image = `aliyunfc/runtime-${this.getRuntime()}:build-${fcDockerV}`;
      }
      logger.debug(`use fc docker image: ${image}`);
      return image;
    }
  }

  beforeBuild(): boolean {
    logger.debug('beforeBuild ...');
    const codeUriValid = this.checkCodeUri();
    logger.debug(`checkCodeUri = ${codeUriValid}`);
    if (!codeUriValid) {
      return false;
    }
    logger.debug(`codeUri = ${this.getCodeUri()}`);
    return true;
  }

  afterBuild() {
    logger.debug('afterBuild ...');
  }

  public async build() {
    const check = this.beforeBuild();
    if (!check) {
      return;
    }
    await this.runBuild();
    this.afterBuild();
  }

  public async runBuild() {}

  private checkAcreeInstanceID(imageName: string, instanceID: string) {
    // 如果是企业镜像，并且非正常 build 验证，企业镜像配置
    if (isAcreeRegistry(imageName) && !instanceID) {
      throw new Error(
        'When an enterprise version instance is selected for the container image, you need to add an instanceID to the enterprise version of the container image service. Refer to: https://docs.serverless-devs.com/fc/yaml/function#customcontainerconfig',
      );
    }
  }

  async mockDockerLogin() {
    const acrInstanceID = this.getAcrEEInstanceID();
    logger.info(`acrInstanceID: ${acrInstanceID}`);
    let imageName = this.getRuntimeBuildImage();
    this.checkAcreeInstanceID(imageName, acrInstanceID);
    const credential = await this.getCredentials();
    await mockDockerConfigFile(this.getRegion(), imageName, credential, acrInstanceID);
    logger.info('docker login successed with cr_tmp user!');
  }
}
