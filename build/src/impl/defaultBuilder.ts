import { Builder } from './baseBuilder';
import logger from '../common/logger';
import * as fs from 'fs';
import { lodash as _ } from '@serverless-devs/core';
import * as path from "path";
import { runCommand } from "./docker/runCommand";

export class DefaultBuilder extends Builder {
  public async runBuild() {
    logger.debug(`DefaultBuilder building ... ${JSON.stringify(this.inputProps)}`);
    let tasks = this.getBuildTasks();
    logger.debug(`DefaultBuilder tasks=${JSON.stringify(tasks)}`);
    if (_.isEmpty(tasks)) {
      logger.info("No need build for this project.")
      return;
    }
    let shellScript = tasks.join("\n");
    const dockerCmdStr = `docker run --rm -v ${this.getCodeUri()}:/code ${this.getRuntimeBuildImage()} bash -c`;
    await runCommand(dockerCmdStr, shellScript, false);
  }

  public getBuildTasks(): string[] {
    let tasks: string[] = [];
    // task work dir is /code  ===  s.yaml codeuri
    if (this.existManifest("apt-get.list")) {
      tasks.push('apt-get-install "$(cat apt-get.list)"');
    }

    let runtime = this.getRuntime();

    switch (runtime) {
      case "python2.7":
      case "python3":
      case "python3.9":
      case "python3.10":
        if (this.existManifest("requirements.txt")) {
          tasks.push("pip install -t 3rd-packages -r requirements.txt --upgrade");
        }
        break
      case "nodejs6":
      case "nodejs8":
      case "nodejs10":
      case "nodejs12":
      case "nodejs14":
        if (this.existManifest("package.json")) {
          tasks.push("npm install");
        }
        break
      case "php7.2":
        if (this.existManifest("composer.json")) {
          tasks.push("composer install");
        }
        break
      case "custom":
        if (this.existManifest("requirements.txt")) {
          tasks.push("pip install -t 3rd-packages -r requirements.txt --upgrade");
        }
        if (this.existManifest("package.json")) {
          tasks.push("npm install");
        }
        if (this.existManifest("composer.json")) {
          tasks.push("composer install");
        }
        break
      default:
        logger.warn(`build is not supported in ${runtime}, \n1. Using "mvn package -DskipTests" directly with java runtime, assuming you have installed the OpenJDK locally. \n2. Using "GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o target/main main.go" directly with go runtime, assuming you have installed the Golang SDK locally. \n3. you can use --use-sandbox to enter the sandbox container of ${runtime} runtime.`)
    }
    return tasks;
  }

  existManifest(fileName: string): boolean {
    const filePath = path.join(this.getCodeUri(), fileName);
    if (fs.existsSync(filePath)) {
      logger.debug(`${filePath} exist`);
      return true;
    }
    return false;
  }
}