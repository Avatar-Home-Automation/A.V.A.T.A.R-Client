# Changelog - Version 3.2.1

## 📅 Release Date
10 february 2025

---

## 🚀 New Features and Improvements

### ✨ New Features
- **[Versionning]**: Improvement in the process of searching for new versions of the application.
- **[intercom]**: Checks if the HTTP route has been configured before executing the intercom.

---

## 🐞 Bug Fixes
- Missing module `underscore.js` added to the file _reportLibrairy.js_ for the `Fix package with vulnerabilities` function.
- The check for the existence of a plugin has been moved up to avoid an error in the `Avatar.call` function.
- Added a check for the existence of the HTTP route to avoid an error in the `setStaticFolder` function.
- Fixed minor visual bugs.  
- Corrected application messages.

---

## ⚠️ Breaking Changes
- If you have plugins with `npm` packages, you can update them by removing the _node_modules_ directory and, if necessary, adding a _package.json_ file in the plugin's GitHub project.  


---

## 📚 Updated Documentation
- Refer to the [documentation](https://avatar-home-automation.github.io/docs/) for more information about the new features.  


---

## 📩 Feedback and Support
If you encounter issues or have questions, open an [issue](https://github.com/Avatar-Home-Automation/A.V.A.T.A.R-Client/issues) or contact us at [avatar.home.automation@gmail.com]

---

💣 This Changelog will self-destruct upon the next update installation. In the meantime, you can view it in the `information` command and by clicking on the `Change log` link.

<br><br>