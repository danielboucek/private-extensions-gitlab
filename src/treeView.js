const vscode = require('vscode');
const { getPackageData, installExtension, checkForUpdates, openVSIX } = require('./packageHandler.js');

function treeViewActivate(context) {
	class GitLabPackageProvider {
		constructor() {
			this._onDidChangeTreeData = new vscode.EventEmitter();
			this.onDidChangeTreeData = this._onDidChangeTreeData.event;
			this.packages = []; // Initialize as an empty array
			this.isRefreshing = false;

			// Fetch the package data on initialization
			this.initialize();
		}


		async initialize() {
			this.packages = await this.getGitLabPackages();
			this._onDidChangeTreeData.fire();
		}

		async refresh() {
			if (this.isRefreshing) {
				return; // If a refresh is already in progress, do nothing
			}
			this.isRefreshing = true;
			this.packages = await this.getGitLabPackages();
			this._onDidChangeTreeData.fire();
			this.isRefreshing = false;
		}

		getTreeItem(element) {
			return element;
		}

		getChildren(element) {
			if (!element) {
				// Parent level: Return unique registryNames as TreeItems
				const registryNames = [...new Set(this.packages.map(pkg => pkg.registryName))];
				return registryNames.map(registryName => {
					// Find back the first package that matches the registryName
					const pkg = this.packages.find(p => p.registryName === registryName);
					const parentTreeItem = new vscode.TreeItem(registryName, vscode.TreeItemCollapsibleState.Expanded);
					parentTreeItem.contextValue = 'registry';
					parentTreeItem.tooltip = pkg.url
					return parentTreeItem;
				});
			} else if (element.contextValue === 'registry') {
				// Child level: Return the TreeItems that match the registryName
				return this.getChildrenForRegistry(element.label);
			}
			return [];
		}

		getChildrenForRegistry(registryName) {
			// Filter the packages array based on the registryName
			return this.packages
				.filter(pkg => pkg.registryName === registryName)
		}

		async getGitLabPackages() {
			try {
				const packageList = await getPackageData();
				const outdatedCount = checkForUpdates(packageList);
				// Update the view badge based on the number of outdated packages
				if (outdatedCount > 0) {
					treeView.badge = { value: outdatedCount, tooltip: `${outdatedCount} updates available` };
				} else {
					treeView.badge = { value: 0, tooltip: "" };
				}
				console.log("Outdated Count:", outdatedCount);
				const mappedResponse = packageList.map(pkg => {
					const treeItem = new vscode.TreeItem(`${pkg.name}`);
					if (pkg.status === 'installed') {
						treeItem.description = `${pkg.version} - Installed`;
					} else if (pkg.status === 'outdated') {
						treeItem.description = `${pkg.version} - Outdated`;
						treeItem.contextValue = 'canInstall';
					} else {
						treeItem.description = pkg.version;
						treeItem.contextValue = 'canInstall';
					}
					treeItem.iconPath = new vscode.ThemeIcon('package');
					treeItem.tooltip = pkg.extension_id;

					// Add more relevant data to the treeItem
					treeItem.registryName = pkg.registryName;
					treeItem.url = pkg.url;
					treeItem.version = pkg.version;
					treeItem.fileName = pkg.file_name;
					treeItem.status = pkg.status;

					// Fires a command when the item is clicked
					treeItem.command = {
						command: 'private-extensions-gitlab.openVSIX',
						arguments: [pkg]
					};

					return treeItem;
				});
				return mappedResponse;
			} catch (error) {
				console.error('Failed to get GitLab packages:', error);
				vscode.window.showErrorMessage('Failed to get GitLab packages.');
				return [];
			}
		}
	}
	const gitLabPackageProvider = new GitLabPackageProvider();
	const treeView = vscode.window.createTreeView('privateMarketplaceGitlab', { treeDataProvider: gitLabPackageProvider });

	treeView.onDidChangeVisibility(async ({ visible }) => {
		if (visible) {
			// await gitLabPackageProvider.getGitLabPackages();
			// Added manual refresh, instead of automatic??
		}
	});

	let refreshCommand = vscode.commands.registerCommand('private-extensions-gitlab.refresh', async () => {
		gitLabPackageProvider.refresh();
	});
	let downloadCommand = vscode.commands.registerCommand('private-extensions-gitlab.download', (item) => {
		const pkg = {
			extension_id: item.tooltip, // The tooltip contains the extension_id
			url: item.url,
			version: item.version,
			file_name: item.fileName
		}
		installExtension(pkg);
	});
	let openSettingsCommand = vscode.commands.registerCommand('private-extensions-gitlab.openSettings', () => {
		vscode.commands.executeCommand('workbench.action.openSettings', '@ext:DanielBoucek.private-extensions-gitlab');
	});
	let itemClickedCommand = vscode.commands.registerCommand('private-extensions-gitlab.openVSIX', (item) => {
		openVSIX(context, item)
	});

	context.subscriptions.push(refreshCommand, downloadCommand, openSettingsCommand, itemClickedCommand);
}

module.exports = {
	treeViewActivate
}