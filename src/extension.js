// const vscode = require('vscode');
const { gitlabActivate } = require('./gitlab.js');
const { treeViewActivate } = require('./treeView.js');
const { packageHandlerActivate } = require('./packageHandler.js');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	await gitlabActivate(context);
	treeViewActivate(context);
	packageHandlerActivate(context);
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
};