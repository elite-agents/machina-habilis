#!/usr/bin/env node
import { Command } from 'commander';
import { createProject } from './commands/create';
import { addTool } from './commands/add-tool';
import { version } from '../package.json';

const program = new Command();

program
  .name('oldowan')
  .description('CLI tool for creating and managing an Oldowan MCP server')
  .version(version);

program
  .command('create')
  .description('Create a new Oldowan MCP server project')
  .argument('<project-name>', 'name of the project')
  .option('-t, --template <template>', 'template to use', 'default')
  .action(createProject);

program
  .command('add-tool')
  .description('Add a new tool to your Oldowan project')
  .argument('[name]', 'name of the tool', 'example')
  .option('-d, --description <description>', 'description of the tool')
  .action(addTool);

// Future commands can be added here
program
  .command('deploy')
  .description('[Coming Soon] Deploy Oldowan server to cloud platforms')
  .action(() => {
    console.log('Deployment feature coming soon!');
  });

program.parse(process.argv);