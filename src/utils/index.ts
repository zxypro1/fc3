import _ from 'lodash';
import inquirer from 'inquirer';
import Table from 'tty-table';
import * as crc64 from 'crc64-ecma182.js';
import { promisify } from 'util';
import * as fs from 'fs';
import logger from '../logger';
import { execSync } from 'child_process';

export { default as verify } from './verify';
export { default as runCommand } from './run-command';

export const sleep = async (second: number): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, second * 1000));

export const isAuto = (config: unknown): boolean => {
  if (!_.isString(config)) {
    return false;
  }

  return _.toUpper(config) === 'AUTO';
};

export const isAutoVpcConfig = (config: unknown): boolean => {
  logger.debug(`isAutoVpcConfig, vpcConfig = ${JSON.stringify(config)}`);
  if (_.isString(config)) {
    return _.toUpper(config) === 'AUTO';
  }
  return (
    _.has(config, 'vpcId') &&
    (_.toUpper(_.get(config, 'vSwitchIds')) === 'AUTO' ||
      _.toUpper(_.get(config, 'securityGroupId')) === 'AUTO')
  );
};

export const getTimeZone = (): string => {
  const timeZone = `UTC+${0 - new Date().getTimezoneOffset() / 60}`;
  return timeZone;
};

export async function promptForConfirmOrDetails(message: string): Promise<boolean> {
  const answers: any = await inquirer.prompt([
    {
      type: 'list',
      name: 'prompt',
      message,
      choices: ['yes', 'no'],
    },
  ]);

  return answers.prompt === 'yes';
}

export function removeNullValues(obj: object) {
  for (const key in obj) {
    if (obj[key] === null) {
      _.unset(obj, key);
    } else if (typeof obj[key] === 'object') {
      removeNullValues(obj[key]);
    }
  }
}

export function tableShow(data: any, showKey: string[]) {
  const options = {
    borderStyle: 'solid',
    borderColor: 'blue',
    headerAlign: 'center',
    align: 'left',
    color: 'cyan',
    width: '100%',
  };

  const header = showKey.map((value) => ({
    value,
    headerColor: 'cyan',
    color: 'cyan',
    align: 'left',
    width: 'auto',
    formatter: (v: any) => v,
  }));

  console.log(Table(header, data, options).render());
}

export async function calculateCRC64(filePath: string) {
  const crc64Value = await promisify(crc64.crc64File)(filePath);
  return crc64Value;
}

export function getFileSize(filePath: string) {
  const fileSize = fs.statSync(filePath).size;
  const size = fileSize;
  const sizeInKB = Math.floor(size / 1024);
  const sizeInMB = Math.floor(size / (1024 * 1024));
  const sizeInGB = Math.floor(size / (1024 * 1024 * 1024));

  // 根据大小选择输出的单位
  if (sizeInGB > 0) {
    logger.debug(`Zip file: ${filePath} size = ${sizeInGB}GB`);
    return sizeInGB;
  } else if (sizeInMB > 0) {
    logger.debug(`Zip file: ${filePath} size = ${sizeInMB}MB`);
    return sizeInMB;
  } else {
    logger.debug(`Zip file: ${filePath} size = ${sizeInKB}KB`);
    return sizeInKB;
  }
}

export function checkDockerInstalled() {
  try {
    // 尝试执行 'docker --version' 命令
    const output = execSync('docker --version', { encoding: 'utf-8' });
    logger.debug('Docker is installed:', output.trim());
  } catch (error) {
    // 如果执行命令出错，则认为 Docker 没有安装
    logger.error(
      'Docker is not installed, please refer "https://docs.docker.com/engine/install". if use podman, please refer "https://help.aliyun.com/document_detail/2513750.html?spm=a2c4g.2513735.0.i0#e72aae479a5gf"',
    );
    throw new Error('Docker is not installed');
  }
}

export function isAppCenter(): boolean {
  return process.env.BUILD_IMAGE_ENV === 'fc-backend';
}

export function isYunXiao(): boolean {
  return process.env.ENGINE_PIPELINE_PORTAL_URL === 'https://flow.aliyun.com';
}
