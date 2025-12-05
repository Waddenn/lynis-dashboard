# Lynis Dashboard

A modern, offline-first web dashboard for visualizing [Lynis](https://cisofy.com/lynis/) security audit reports. This tool parses your `lynis-report.dat` file and presents the data in a clean, user-friendly interface.

## Features

- **Drag & Drop Interface**: Easily upload your `lynis-report.dat` file.
- **Offline & Secure**: All parsing happens locally in your browser. No data is sent to any server.

## Usage

1.  Clone this repository or download the files.
2.  Open `index.html` in any modern web browser.
3.  Drag and drop your `lynis-report.dat` file onto the upload zone.

## Logic
The dashboard is built with vanilla HTML, CSS, and JavaScript. It parses the parsing logic handles the `key=value` structure of the Lynis report, including array fields like `warning[]` and `suggestion[]`.
