# GeminiUI Enhancer

A Chrome extension that enhances the Gemini user interface by collecting conversation data and providing an improved user interface for browsing and searching past conversations.

## Features

- Automatically collects chat titles and URLs from Gemini's sidebar
- Provides a clean, modern interface for viewing all your Gemini conversations
- Fast client-side search functionality
- Works completely locally - your data never leaves your browser

## Structure

The project consists of two main components:

1. **Chrome Extension**: Collects conversation data from Gemini and stores it in browser local storage.
2. **Web UI**: A simple client-side website that displays the collected conversation data with search functionality.

## Installation

### Development Mode

1. Clone this repository or download it as a ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `extension` folder from this project

### Usage

1. Visit [Gemini](https://gemini.google.com/app) in your Chrome browser
2. The extension will automatically start collecting conversation data
3. Click on the extension icon in your toolbar to see statistics and open the enhanced UI
4. Use the search functionality to find specific conversations

## How it Works

The extension:
- Runs on the Gemini website and extracts conversation titles and IDs
- Stores this data in Chrome's local storage
- Provides a web interface to view and search through your conversations

## Development

### Extension Files

- `manifest.json`: Chrome extension configuration
- `src/content.js`: Runs on the Gemini webpage to extract data
- `src/background.js`: Handles background processes and communication
- `popup.html` & `src/popup.js`: The extension popup UI
- `index.html`: Hosts the enhanced UI

### Website Files

- `website/index.html`: Main HTML structure
- `website/styles.css`: Styling for the enhanced UI
- `website/script.js`: Client-side functionality for the UI

## Credits

Created by [Your Name] 