const chalk = require('chalk');

module.exports.handler = function (event, context, callback) {
  // throw new Error('xxx')
  console.log(event.toString());
  // console.dir(context);
  console.log(new Intl.DateTimeFormat('en', { timeZoneName: 'long' }).format().includes('China Standard Time'));
  console.log(chalk.red('hello world'));
  console.log(chalk.yellow('hello world'));
  console.log(chalk.green('hello world'));
  callback(null, 'hello world');
};