# GeminiUI Enhancer

Tired of scrolling endlessly to find that one specific past conversation in Gemini? So was I! That's why I built **GeminiUI Enhancer**, a Chrome extension designed to make your Gemini experience smoother and more efficient.

This extension automatically collects your Gemini chat titles and URLs, storing them locally in your browser. It then provides an enhanced interface (currently a separate, clean UI) to easily browse, search, and revisit your past discussions.

While the current version uses a separate interface, the ultimate vision is to integrate these enhancements directly into the Gemini UI itself, making it feel like a native improvement.

## Features

- **Automatic Conversation Archiving**: Silently captures your chat titles and direct URLs from the Gemini sidebar as you use it.
- **Local Data Storage**: All your conversation data is stored securely in your browser's local storage. Nothing is sent to any external servers.
- **Enhanced Browsing & Searching**: Access a dedicated view to see all your archived conversations with fast client-side search.
- **Preserves History**: New conversations are added to your existing collection, so you don't lose track of older chats even if they are not immediately visible on Gemini's page.

## How it Works

The extension has two main parts:

1.  **Content Script (`extension/src/content.js`)**: This script runs on the Gemini website (`gemini.google.com`). It observes the conversation list in the sidebar, clicks "Show more" to load older conversations if necessary, and extracts the title and URL for each chat.
2.  **Storage & UI**:
    *   The extracted data is saved into `chrome.storage.local`.
    *   The extension's popup (`popup.html`, `src/popup.js`) provides a quick overview and a link to the main UI.
    *   The main UI (`website/index.html`, `website/script.js`, `website/styles.css`) reads from this storage to display your conversations and allow you to search them.

## Installation

### For Users & Testers

1.  Clone this repository or download it as a ZIP file and unzip it.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" (usually a toggle in the top right corner).
4.  Click "Load unpacked" and select the `extension` folder from the cloned/downloaded project.
5.  Visit [Gemini](https://gemini.google.com/app). The extension will start working automatically in the background.
6.  Click the GeminiUI Enhancer icon in your Chrome toolbar to see stats or open the enhanced conversation viewer.

## Why This Project Exists

I created GeminiUI Enhancer because I found it increasingly difficult to navigate and find specific past conversations within the standard Gemini interface. As the list of chats grows, important discussions can get buried. This tool aims to solve that by providing a persistent, easily searchable archive of your interactions. Full disclosure: this was 99% vibe coded, so the initial quality might be a bit questionable, which is all the more reason to jump in and help improve it!

## Contributing - Let's Make Gemini Better!

This project is open source and there's a **huge potential for growth and improvement!** I believe that with community effort, we can build something truly valuable for all Gemini users.

Here are some ideas for how you could contribute:

*   **Direct UI Integration**: The holy grail! Help figure out how to seamlessly embed these features (like an improved search or categorized view) directly into the Gemini web interface itself, rather than a separate page.
*   **UI/UX Enhancements**: Improve the design and usability of the current conversation viewer.
*   **Advanced Search/Filtering**: Add options like date range filtering, sorting, or full-text search within conversations (this would be a bigger undertaking, requiring more data capture).
*   **Tagging/Categorization**: Allow users to tag or categorize conversations.
*   **Performance Optimization**: Especially for users with thousands of conversations.
*   **Bug Fixes & Refinements**: Help make the existing functionality more robust.

### How to Get Started

1.  **Fork the repository.**
2.  **Clone your fork:** `git clone https://github.com/YOUR_USERNAME/GeminiUI-Enhancer.git`
3.  **Create a new branch for your feature or fix:** `git checkout -b my-awesome-feature`
4.  **Make your changes.** (Remember to follow the existing coding style and linting rules if any are established.)
5.  **Test your changes thoroughly.**
6.  **Commit your changes:** `git commit -am 'Add some awesome feature'`
7.  **Push to your branch:** `git push origin my-awesome-feature`
8.  **Open a Pull Request** against the main repository.

I'm excited to see what we can build together! Even small contributions or suggestions are welcome.

## Development Notes

### Project Structure

*   `extension/`: Contains all files for the Chrome extension itself.
    *   `manifest.json`: Core configuration file for the extension.
    *   `src/content.js`: Injected into Gemini pages to scrape conversation data.
    *   `src/background.js`: Handles background tasks, like listening for messages.
    *   `popup.html` & `src/popup.js`: UI for the extension's toolbar popup.
*   `website/`: Contains the standalone webpage for viewing and searching conversations.
    *   `index.html`: The main page structure.
    *   `styles.css`: CSS for the page.
    *   `script.js`: JavaScript for fetching data from storage and handling search.

## Making a New Release

This project uses GitHub Actions to automate the creation of releases. To make a new release, follow these steps:

1.  **Update Version in Manifest**: Increment the `"version"` number in the `manifest.json` file (e.g., from `"1.0.0"` to `"1.0.1"`). Ensure it follows [semantic versioning](https://semver.org/) principles.

2.  **Commit the Version Change**:
    ```bash
    git add manifest.json
    git commit -m "Bump version to vX.Y.Z" 
    ```
    (Replace `X.Y.Z` with the new version number).

3.  **Tag the Commit**: Create a new Git tag that matches the version in `manifest.json`. The tag must start with `v`.
    ```bash
    git tag vX.Y.Z
    ```
    (Again, replace `X.Y.Z` with the new version number).

4.  **Push Changes and Tag to GitHub**:
    ```bash
    git push
    git push origin vX.Y.Z
    ```

Once the tag is pushed, the "Create Release" GitHub Action will automatically run. It will:
*   Verify that the tag version matches the version in `manifest.json`.
*   Package the extension into a `gemini-ui-enhancer-vX.Y.Z.zip` file.
*   Create a new GitHub Release named after the tag, attaching the ZIP file.

### Local Packaging (for testing)

If you want to test the packaging process locally without creating a full release, you can use the `yarn package` script:

```bash
yarn package
```

This will generate a `gemini-ui-enhancer.zip` file in the project root, containing the extension files. This is useful for ensuring the correct files are included before tagging a release.

## Credits

Originally created by @Enrico2 from Lemonberry Labs - Let's add your name here if you contribute! 