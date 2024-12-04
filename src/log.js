const vscode = require('vscode');

const outputChannel = vscode.window.createOutputChannel('Private Extension Manager');

/**
 * Logs a message to the output channel with a timestamp.
 * If an error is provided, logs the error stack as well.
 * Optionally shows a notification with an option to view details.
 *
 * @param {string} message - The message to log.
 * @param {Error} [error] - An optional error object to log.
 * @param {boolean} [showNotification=false] - Whether to show a notification with an option to view details.
 */
function logMessage(message, error, showNotification = false) {
	const timestamp = getLocalTimestamp();
	if (error) {
		outputChannel.appendLine(`${timestamp} [error] ${message}`);
		outputChannel.appendLine(`${timestamp} [error] ${error.stack}`);
		if (showNotification) {
			vscode.window.showErrorMessage(
				message,
				'View Details'
			).then(selection => {
				if (selection === 'View Details') {
					outputChannel.show(true);
				}
			});
		}
	} else {
		outputChannel.appendLine(`${timestamp} [info] ${message}`);
	}
}

function getLocalTimestamp() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');
	const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}


module.exports = {
	logMessage
}

