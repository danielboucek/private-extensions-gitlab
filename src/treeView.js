const vscode = require('vscode');
const { getPackageData, installExtension, checkForUpdates, openVSIX } = require('./packageHandler.js');

function treeViewActivate(context) {
	const _onDidChangeTreeData = new vscode.EventEmitter();
	const onDidChangeTreeData = _onDidChangeTreeData.event;
	let packages = [];
	let isRefreshing = false;

	const treeDataProvider = {
		onDidChangeTreeData,
		getTreeItem,
		getChildren
	};

	/**
	 * Refreshes the tree view by clearing the current packages and firing the change event.
	 * If a refresh is already in progress, the function will return immediately.
	 */
	function refresh() {
		if (isRefreshing) {
			return;
		}
		isRefreshing = true;
		packages = [];
		_onDidChangeTreeData.fire();
		isRefreshing = false;
	}

	function update(action, targetPkg) {
		switch (action) {
			case 'install':
				const installItem = packages.find(pkg => pkg.tooltip === targetPkg.extension_id);
				if (installItem) {
					installItem.status = 'installed';
					installItem.contextValue = undefined;
					installItem.description = `${targetPkg.version} - Installed`;
					updateBadgeCount(packages);
					_onDidChangeTreeData.fire();
				}
				break;
			case 'uninstall':
				const uninstallItem = packages.find(pkg => pkg.tooltip === targetPkg.extension_id);
				if (uninstallItem) {
					uninstallItem.status = undefined;
					uninstallItem.contextValue = 'canInstall';
					uninstallItem.description = `${targetPkg.version}`;
					updateBadgeCount(packages);
					_onDidChangeTreeData.fire();
				}
				break;
		}
	}

	/**
	 * Retrieves the tree item representation of the given element.
	 * @param {vscode.TreeItem} element - The element to be represented as a tree item.
	 * @returns {vscode.TreeItem} The tree item representation of the element.
	 */
	function getTreeItem(element) {
		return element;
	}

	/**
	 * When the element is not provided, it creates and returns the top-level (root) registry names from the packages as TreeItems.
	 * 
	 * If the element's contextValue is 'registry', it returns the children for that registry using getChildrenForRegistry().
	 * Otherwise, it returns an empty array.
	 * @param {vscode.TreeItem} element - The element to be represented as a tree item.
	 * @returns {Promise<vscode.TreeItem[]>} A promise that resolves to an array of TreeItems representing the children of the given element.
	 */
	async function getChildren(element) {
		if (!packages.length) {
			await getGitLabPackages();
		}
		if (!element) {
			const registryNames = [...new Set(packages.map(pkg => pkg.registryName))];
			return registryNames.map(registryName => {
				const pkg = packages.find(p => p.registryName === registryName);
				const parentTreeItem = new vscode.TreeItem(registryName, vscode.TreeItemCollapsibleState.Expanded);
				parentTreeItem.contextValue = 'registry';
				parentTreeItem.tooltip = pkg.url;
				return parentTreeItem;
			});
		} else if (element.contextValue === 'registry') {
			return getChildrenForRegistry(element.label);
		}
		return [];
	}

	/**
	 * Asynchronously retrieves GitLab packages
	 * 
	 * This function fetches package data, checks for updates, and updates the tree view badge with the count of outdated packages.
	 * It then maps the package data to tree items, setting various properties such as description, icon, tooltip, and command.
	 * @returns {Promise<void>} A promise that resolves when the package data has been processed.
	 */
	async function getGitLabPackages() {
		try {
			const packageList = await getPackageData();
			updateBadgeCount(packageList);
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
				treeItem.registryName = pkg.registryName;
				treeItem.url = pkg.url;
				treeItem.version = pkg.version;
				treeItem.fileName = pkg.file_name;
				treeItem.status = pkg.status;
				treeItem.command = {
					command: 'private-extensions-gitlab.openVSIX',
					arguments: [treeItem]
				};
				return treeItem;
			});
			packages = mappedResponse;
			if (packages.length === 0) {
				treeView.message = 'No packages found.';
			} else {
				treeView.message = '';
			}
		} catch (error) {
			// console.error('Failed to get GitLab packages:', error);
			// vscode.window.showErrorMessage('Failed to get GitLab packages.');
			packages = [];
			treeView.message = 'Failed to get packages, please try again.';
		}
	}

	/**
	 * Retrieves the children packages for a given registry name.
	 * @param {string} registryName - The name of the registry to filter packages by.
	 * @returns {Array} An array of packages that belong to the specified registry.
	 */
	function getChildrenForRegistry(registryName) {
		return packages.filter(pkg => pkg.registryName === registryName);
	}

	/**
	 * Updates the badge count on the tree view based on the number of outdated packages.
	 * @param {Array} packageList - The list of fetched packages to check for updates.
	 */
	function updateBadgeCount(packageList) {
		const outdatedCount = checkForUpdates(packageList);
		if (outdatedCount > 0) {
			treeView.badge = {
				value: outdatedCount,
				tooltip: `${outdatedCount} update${outdatedCount > 1 ? 's' : ''} available`
			};
		} else {
			treeView.badge = { value: 0, tooltip: "" };
		}
	}


	// Creates a TreeView instance for the 'privateMarketplaceGitlab' view.
	const treeView = vscode.window.createTreeView('privateMarketplaceGitlab', { treeDataProvider });

	// Call getChildren to populate the tree view during activation
	if (treeView.visible === true) {
		getChildren();
	}



	let refreshCommand = vscode.commands.registerCommand('private-extensions-gitlab.refresh', async () => {
		await refresh();
	});
	let updateCommand = vscode.commands.registerCommand('private-extensions-gitlab.update', (action, targetPkg) => {
		update(action, targetPkg);
	});
	let downloadCommand = vscode.commands.registerCommand('private-extensions-gitlab.download', (item) => {
		const pkg = {
			extension_id: item.tooltip,
			url: item.url,
			version: item.version,
			file_name: item.fileName
		};
		installExtension(pkg);
	});
	let openSettingsCommand = vscode.commands.registerCommand('private-extensions-gitlab.openSettings', () => {
		vscode.commands.executeCommand('workbench.action.openSettings', '@ext:DanielBoucek.private-extensions-gitlab');
	});
	let itemClickedCommand = vscode.commands.registerCommand('private-extensions-gitlab.openVSIX', (item) => {
		const pkg = {
			extension_id: item.tooltip,
			url: item.url,
			version: item.version,
			file_name: item.fileName,
			status: item.status
		};
		openVSIX(context, pkg);
	});

	context.subscriptions.push(refreshCommand, updateCommand, downloadCommand, openSettingsCommand, itemClickedCommand);
}

module.exports = {
	treeViewActivate
};