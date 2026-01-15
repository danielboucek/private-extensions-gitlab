# Changelog

### Release Notes

#### 1.1.4

- Added validation for semantic versioning in packages, invalid versions are ignored

#### 1.1.3

- Fixed an issue where icon was needed in order to open the extension preview
- Added placeholder icon when non provided

#### 1.1.2

- Fixed GitLab's packages API pagination issues
- Fixed incorrect comparison of package versions

#### 1.1.1

- Added command to remove the stored access token from the SecretStorage
- Added outputChannel for error and info logging
- Fixed an issue that caused duplicate packages in the tree view
- Fixed an issue where automatic updates were checked for only when the tree view opened and not when the extension loaded

#### 1.1.0

- Fixes an issues regarding the loading state of the Tree View
- Fixes an issue that caused endless extension update loop until the extension host was refreshed
- Tweaked unnecessary API fetch calls to the GitLab package registry
- Added information messages to the Tree View

#### 1.0.0

- Initial release
