const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Creates a webview panel (Extension Preview) with the given message data.
 * @param {vscode.ExtensionContext} context
 * @param {object} messageData - The message data to be passed to the webview.
 */
function createWebviewPanel(context, messageData) {
	const panel = vscode.window.createWebviewPanel(
		'webviewVSIX', // Identifies the type of the webview. Used internally
		`Package: ${messageData.packageJsonData.displayName}`, // Title of the panel displayed to the user

		vscode.ViewColumn.One, // Editor column to show the new webview panel in
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);
	const htmlPath = path.join(context.extensionPath, 'views', 'webview.html');
	const htmlContent = fs.readFileSync(htmlPath, 'utf8');
	panel.webview.html = htmlContent;

	panel.webview.postMessage(messageData);

	return panel;
}

module.exports = {
	createWebviewPanel
};