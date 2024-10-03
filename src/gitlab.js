const vscode = require('vscode');
const axios = require('axios');

/**
 * Activates the GitLab functionality.
 * @param {vscode.ExtensionContext} context
 */
async function gitlabActivate(context) {
	// Command to set or change the GitLab access token
	let setTokenCommand = vscode.commands.registerCommand('private-extensions-gitlab.setToken', async function () {
		const accessToken = await vscode.window.showInputBox({
			prompt: 'Enter your GitLab Access Token',
			ignoreFocusOut: true,
			password: true
		});

		if (accessToken) {
			await context.secrets.store('gitlabAccessToken', accessToken);
			vscode.window.showInformationMessage('GitLab Access Token stored securely.');
			setAxiosAccessToken(context);
		} else {
			vscode.window.showWarningMessage('GitLab Access Token was not set.');
		}
	});

	await setAxiosAccessToken(context);
	context.subscriptions.push(setTokenCommand);
}

/**
 * Sets a 'PRIVATE-TOKEN' to the headers of Axios requests.
 * @param {vscode.ExtensionContext} context
 */
async function setAxiosAccessToken(context) {
	const accessToken = await context.secrets.get('gitlabAccessToken');
	axios.defaults.headers.common['PRIVATE-TOKEN'] = accessToken;
}

/**
 * Checks if the Axios instance has a valid 'PRIVATE-TOKEN' set in the headers.
 * @returns {boolean} Returns true if the access token is set, false otherwise.
 */
function checkAxiosAccessToken() {
	return !!axios.defaults.headers.common['PRIVATE-TOKEN'];
}

/**
 * Fetches packages from GitLab Package Registry.
 * @returns {Promise<Array<{id: number, name: string, version: string}>>} A promise that resolves with an array of packages from the GitLab API.
 */
async function fetchPackages(url) {
	try {
		const response = await axios.get(url);

		// console.log("fetchPackages - response ", response.data)
		return response;
	} catch (error) {
		console.error('Failed to fetch GitLab packages:', error);
		vscode.window.showErrorMessage('Failed to fetch GitLab packages.');
	}
}

/**
 * Fetches the available files for a given package ID from GitLab Package Registry.
 * @param {number} packageId - The ID of the package.
 * @returns {Promise<Array<{file_name: string}>>} - A promise that resolves to the package files data.
 */
async function fetchPackageFiles(packageId, url) {
	try {
		const response = await axios.get(`${url}/${packageId}/package_files`);

		// console.log("fetchPackageFiles - response", response.data);
		return response.data;
	} catch (error) {
		console.error('Failed to fetch GitLab packages files:', error);
		vscode.window.showErrorMessage('Failed to fetch GitLab packages files.');
	}
}

/**
 * Fetches VSIX file from the GitLab API.
 * @param {Object} pkg - Single package from the packageDataList returned from getPackageData().
 * @returns {Promise<stream.Readable>} A promise that resolves to a readable stream containing the VSIX file.
 */
async function fetchVsixFile(pkg) {
	try {
		const url = `${pkg.url}/generic/${pkg.extension_id}/${pkg.version}/${pkg.file_name}`;
		const response = await axios.get(url, { responseType: 'stream' });

		// console.log("fetchVsixFile - response", response.data);
		return response.data;
	} catch (error) {
		console.error('Failed to fetch VSIX file:', error);
		vscode.window.showErrorMessage('Failed to fetch VSIX file.');
	}
}

async function getProjectData(url) {
	try {
		const projectUrl = url.replace("/packages", "");
		const response = await axios.get(projectUrl);

		// console.log("fetchProjectData - response ", response.data)
		return response.data;
	} catch (error) {
		console.error('Failed to fetch Gitlab Project data:', error);
		vscode.window.showErrorMessage('Failed to fetch GitLab Project data.');
	}
}


module.exports = {
	gitlabActivate,
	fetchPackages,
	fetchPackageFiles,
	checkAxiosAccessToken,
	fetchVsixFile,
	getProjectData
}

