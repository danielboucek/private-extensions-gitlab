const vscode = require('vscode');
const { fetchPackages, fetchPackageFiles, checkAxiosAccessToken, fetchVsixFile, getProjectData } = require('./gitlab.js');
const fs = require('fs');
const tmp = require('tmp');
const unzipper = require('unzipper');
const { createWebviewPanel } = require('./webview.js');
const { marked } = require('marked');

function packageHandlerActivate(context) {
	// Command to fetch the package list -- Probably not needed!
	let fetchPackagesCommand = vscode.commands.registerCommand('private-extensions-gitlab.fetchPackages', async function () {
		await getPackageData(context);
	});

	context.subscriptions.push(fetchPackagesCommand);
}

let packageDataList = [];

/**
 * Calls functions to fetch needed data from the GitLab API and processes relevant data into an array.
 * @returns {Promise<Array<{name: string, extension_id: string, version: string, file_name: string, status: string}>>} The processed packageDataList.
 */
async function getPackageData() {
	if (!checkAxiosAccessToken()) {
		vscode.window.showWarningMessage(
			'Please set your GitLab Access Token',
			'Set Token'
		).then(selection => {
			if (selection === 'Set Token') {
				vscode.commands.executeCommand('private-extensions-gitlab.setToken');
			}
		});
		return [];
	}

	// Get the package URLs from the settings
	const packageUrls = vscode.workspace.getConfiguration('private-extensions-gitlab').get('packageUrls');
	if (packageUrls.length === 0) {
		vscode.window.showWarningMessage(
			'Please set the package registry URLs in the settings.',
			'Open Settings'
		).then(selection => {
			if (selection === 'Open Settings') {
				vscode.commands.executeCommand('workbench.action.openSettings', '@ext:DanielBoucek.private-extensions-gitlab');
			}
		});
		return [];
	}
	// Get all the packages from all the URLs provided
	packageDataList = []; // Start with an empty array
	for (const url of packageUrls) {
		const response = await fetchPackages(url);
		// Filter the list so it only contains the latest version of each package
		const packageList = filterPackagesVersion(response);
		console.log("Filtered Response:", packageList);

		// Fetch the project data to get the project/registry name
		const projectData = await getProjectData(url)
		const registryName = projectData.name_with_namespace;

		// Push only the relevant data to the array 
		for (const pkg of packageList) {
			const [packageFile] = await fetchPackageFiles(pkg.id, url);
			const status = checkExtensionVersion(pkg.name, pkg.version)
			packageDataList.push({
				name: pkg.name.split('.')[1],
				extension_id: pkg.name,
				version: pkg.version,
				file_name: packageFile.file_name,
				status: status,
				url: url,
				registryName: registryName
			});
		}
	}
	console.log("packageDataList:", packageDataList);
	return packageDataList;
}

/**
 * Filters packages based on their version and for each name keeps the highest version.
 * @param {Array} response - The response array from fetchPackages().
 * @returns {Array} The filtered list of packages.
 */
function filterPackagesVersion(response) {
	const packages = response.data;
	const filteredPackages = {};

	packages.forEach((pkg) => {
		const { name, version } = pkg;
		if (!filteredPackages[name] || version > filteredPackages[name].version) {
			filteredPackages[name] = pkg;
		}
	});

	const filteredPackageList = Object.values(filteredPackages);

	return filteredPackageList;
}

/**
 * Compares the version of installed VS Code extension with the package version.
 * @param {string} extensionId - The ID of the extension to check.
 * @param {string} extensionVersion - The required version of the extension.
 * @returns {"outdated" | "installed" | undefined} "outdated" if the extension is outdated, "installed" if the extension is up to date, or undefined if the extension is not found.
 */
function checkExtensionVersion(extensionId, extensionVersion) {
	// getExtension check for only for installed and enabled extensions -> issue: https://github.com/microsoft/vscode/issues/145307
	const extension = vscode.extensions.getExtension(extensionId);
	console.log("Extension:", extension);
	if (extension) {
		if (extension.packageJSON.version < extensionVersion) {
			return "outdated";
		} else {
			return "installed";
		}
	} else {
		return
	}
}

/**
 * Installs an extension from a package.
 * @param {Object} pkg - The package data.
 * @param {string} source - The source of the installation - null or 'automaticUpdate'.
 */
async function installExtension(pkg, source) {
	console.log("Installing extension:", pkg);
	const tempFile = await tempFileStream(pkg);

	// Convert the temporary file path to a vscode.Uri.file
	const vsixUri = vscode.Uri.file(tempFile.name);

	// Install the extension using the VS Code API
	try {
		await vscode.commands.executeCommand('workbench.extensions.installExtension', vsixUri);

		if (pkg.status === "outdated" && source !== "automaticUpdate") {
			vscode.window.showInformationMessage(`Extension ${pkg.extension_id} updated successfully.`);
		} else if (pkg.status !== "outdated") {
			vscode.window.showInformationMessage(`Extension ${pkg.extension_id} installed successfully.`);
		}

		// Delete the temporary file before the extension host restarts
		fs.unlink(tempFile.name, async (err) => {
			if (err) {
				console.error(`Error deleting temporary file: ${err}`);
			} else {
				console.log('Temporary file deleted successfully.');
				// Refresh the extension host when updating -- THIS WILL ALSO TERMINATE AND RESTART CURRENT EXTENSION
				if (pkg.status === "outdated" && source !== "automaticUpdate") {
					// console.log("Restarting extension host...");
					// await vscode.commands.executeCommand('workbench.action.restartExtensionHost');
					// ?? MAYBE NEVER RESTART THE HOST WITHOUT USER'S EXPLICIT ACTION ??
				}
			}
		});

		// Refresh the tree view
		await vscode.commands.executeCommand('private-extensions-gitlab.refresh');

	} catch (error) {
		console.error(`Error installing the extension: ${error}`);
		vscode.window.showErrorMessage('Failed to install the extension.');
	}
}

/**
 * Creates a temporary file stream for the given package.
 * @param {Object} pkg - The package data.
 */
async function tempFileStream(pkg) {
	// Install the extension using the package data
	const fileStream = await fetchVsixFile(pkg);

	// Create a temporary file
	const tempFile = tmp.fileSync({ postfix: '.vsix' });

	// Create a write stream to the temporary file
	const writer = fs.createWriteStream(tempFile.name);

	// Pipe the response stream to the write stream
	fileStream.pipe(writer);

	// Return a promise that resolves when the writing is finished
	await new Promise((resolve, reject) => {
		writer.on('finish', resolve);
		writer.on('error', reject);
	});
	return tempFile;
}

/**
 * Checks for updates in the packageDataList based on the status string and installs updates if autoUpdate is enabled.
 * @param {Array} packageDataList - The array returned from getPackageData().
 * @returns {number} The number of outdated packages found.
 */
function checkForUpdates(packageDataList) {
	console.log("Checking for updates...");
	let outdatedCount = 0;
	for (const pkg of packageDataList) {
		if (pkg.status === "outdated") {
			outdatedCount += 1;
			const autoUpdate = vscode.workspace.getConfiguration('private-extensions-gitlab').get('autoUpdate');
			if (autoUpdate) {
				installExtension(pkg, "automaticUpdate");
			}
		}
	}
	console.log("Checking finished");
	return outdatedCount;
}

/**
 * Opens a VSIX package and extracts relevant information to be displayed in a webview panel.
 * @param {object} context - The context object provided by the extension.
 * @param {Object} pkg - The path to the VSIX package.
 * @returns {Promise<void>} - A promise that resolves when the webview panel is created.
 */
async function openVSIX(context, pkg) {
	const tempFile = await tempFileStream(pkg);
	const directory = await unzipper.Open.file(tempFile.name);

	// Find the package.json file and read and parse its content
	const packageJson = directory.files.find(file => file.path.toLowerCase().endsWith('extension/package.json'));
	const packageJsonContent = await packageJson.buffer();
	const packageJsonData = JSON.parse(packageJsonContent.toString('utf8'));

	const iconImg = directory.files.find(file => file.path.toLowerCase().endsWith(packageJsonData.icon));
	const iconContent = await iconImg.buffer();
	const iconBase64 = iconContent.toString('base64');

	// Find the README.md and CHANGELOG.md files
	const readmeFile = directory.files.find(file => file.path.toLowerCase().endsWith('extension/readme.md'));
	const readmeContent = await readmeFile.buffer();
	const readmeHtml = marked(readmeContent.toString('utf8'));

	const changelogFile = directory.files.find(file => file.path.toLowerCase().endsWith('extension/changelog.md'));
	const changelogContent = await changelogFile.buffer();
	const changelogHtml = marked(changelogContent.toString('utf8'));

	const messageData = {
		packageJsonData: packageJsonData,
		iconBase64: iconBase64,
		readmeHtml: readmeHtml,
		changelogHtml: changelogHtml,
		extension_id: pkg.extension_id,
		url: pkg.url,
		version: pkg.version,
		file_name: pkg.file_name,
		status: pkg.status
	};

	const webviewPanel = createWebviewPanel(context, messageData);
	webviewPanelActivate(webviewPanel);
}

/**
 * Activates the webview panel and handles incoming messages.
 * @param {vscode.WebviewPanel} webviewPanel - The webview panel to activate.
 */
function webviewPanelActivate(webviewPanel) {
	webviewPanel.webview.onDidReceiveMessage(async message => {
		if (message.command === 'install') {
			const pkg = message.data;
			await installExtension(pkg);
			webviewPanel.webview.postMessage({ command: 'installSuccess' });
		} else if (message.command === 'uninstall') {
			const extensionId = message.data.extension_id;
			await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', extensionId);
			webviewPanel.webview.postMessage({ command: 'uninstallSuccess' });

			// Refresh the tree view
			await vscode.commands.executeCommand('private-extensions-gitlab.refresh');
		};
	});
}


module.exports = {
	packageHandlerActivate,
	getPackageData,
	installExtension,
	checkForUpdates,
	openVSIX
}