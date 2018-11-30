import fs = require('fs-extra');
import { ipAddress } from '@common/src/common/regexConst';
import { spawn } from 'child_process';
import { injectable } from 'inversify';
import { extname, join, relative } from 'path';
import { isUndefined } from 'util';
import { configFileName, CommandConfig} from '../../config';
import { RunError } from '../../runError';
import { Command } from '../command';
import inquirer = require('inquirer');
import replaceExt = require('replace-ext');

const prompt = inquirer.createPromptModule();

@injectable()
export class InitCommand extends Command {
    readonly requestConfig = {};

    readonly command = 'init';
    readonly noLogin = true;
    readonly skipConfigValidation = true;

    async run() {
        const configPath = join(process.cwd(), configFileName);
        let newConfig: RawConfig = {};

        if (await fs.pathExists(configPath)) {

            const { action } = await prompt({
                name: 'action',
                type: 'list',
                message: 'A config file already exists in the current directory.',
                choices: [
                    {
                        name: 'Backup (rename) old file and create a new file in its place.',
                        value: 'replace'
                    },
                    {
                        name: 'Load old file and use its values as defaults (modifies the old file).',
                        value: 'load'
                    }
                ]
            }) as any;

            if (action === 'replace') {
                await this.askConfig(newConfig);
                await fs.move(configPath, replaceExt(configPath, `.old.${Date.now()}${extname(configPath)}`));
            } else {
                const content = (await fs.readFile(configPath)).toString();
                try {
                    newConfig = JSON.parse(content);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        throw new RunError('Cannot read configuration file.',e);
                    } else
                        throw e
                }
                await this.askConfig(newConfig);
            }
        } else {
            await this.askConfig(newConfig);
        }
        const json = JSON.stringify(newConfig, null, 4);
        await fs.writeFile(configPath, json, { encoding: 'utf8' });

        const initIdx = process.argv.indexOf('init');
        if (initIdx!==-1){
            const { sync } = await prompt<{sync:boolean}>({
                name: 'sync',
                type: 'confirm',
                message: 'Do you want to do an initial sync right now?',
                default: true,
            });
    
            if (sync){
                const args = process.argv.slice(0,initIdx).concat(['sync']);
                spawn(args[0],args.slice(1),{stdio:'inherit'})
            }
        }
    }
}