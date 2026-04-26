# Original Youtube

`Original Youtube` is a Chrome extension that reshapes modern YouTube into a cleaner, more nostalgic browsing experience inspired by the platform's older layouts.

![Original Youtube Screenshot](docs/original-youtube-screenshot.png)

## About

- Type: Chrome extension built with Manifest V3
- Goal: recreate a simpler YouTube homepage and browsing experience
- Inspiration: classic YouTube, especially the cleaner 2010s and 2018-era layout feel
- Focus: reduce clutter such as Shorts, featured promos, Playables, prompt modules, and other modern distractions
- Customization: supports theme switching, custom logo replacement, and custom GIF/media replacements for removed ad slots

## Features

- Restores a more old-school YouTube look and feel
- Hides distracting homepage modules and promotional sections
- Replaces removed ad spaces with your own GIFs or media
- Supports custom branding with a retro YouTube logo
- Includes light and dark mode support
- Runs locally in Chrome with no build step required

## Here's how this app can help you!

- Make YouTube feel calmer and less cluttered when you just want to browse videos
- Reduce visual noise from Shorts, promos, featured modules, and experimental UI sections
- Personalize the homepage with your own GIFs and logo assets
- Bring back a layout that feels closer to the YouTube many users remember
- Create a more focused viewing environment for music, studying, or casual watching

## How To Run

1. Download or clone this repository to your machine.
2. Open `chrome://extensions` in Google Chrome.
3. Turn on `Developer mode` in the top-right corner.
4. Click `Load unpacked`.
5. Select the project folder: `classic-youtube-extension`
6. Open YouTube in Chrome and refresh the page if it was already open.

## Customization

- Theme: open the extension options page to switch between light and dark mode
- Logo: place your preferred logo in `assets/gifs/` and set its filename in `assets/gifs/manifest.json`
- GIF replacements: add GIFs or supported media files to `assets/gifs/` and list them in `assets/gifs/manifest.json`

## Notes

- This project currently runs as a local unpacked Chrome extension
- No install scripts or package manager setup are required
- After changing assets or code, refresh the extension in `chrome://extensions` before testing again
