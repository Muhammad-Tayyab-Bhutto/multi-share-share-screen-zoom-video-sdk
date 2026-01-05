# Zoom VideoSDK Screenshare

A web application demonstrating multiple simultaneous screen sharing capabilities using Zoom Video SDK. This project showcases real-time video communication, screen sharing with multiple participants, and cloud recording features.

## Features

- 🎥 **Video Communication**: Join video sessions with audio and video
- 🖥️ **Multiple Screen Sharing**: Support for simultaneous screen sharing from multiple participants
- ☁️ **Cloud Recording**: Start, pause, resume, and stop cloud recordings
- 🎬 **Video Element & Canvas Support**: Flexible screen share rendering with both video elements and canvas fallback
- 👥 **Peer Management**: Real-time video and screen share state updates for all participants

## Prerequisites

Before running this application, ensure you have:

- Node.js (v16 or higher)
- A Zoom Video SDK account
- SDK Key and SDK Secret from your [Zoom Marketplace](https://marketplace.zoom.us/) Video SDK app

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd videosdk-web-screenshare
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory by copying the example file:

```bash
cp .env.example .env
```

Edit the `.env` file and add your Zoom SDK credentials:

```env
VITE_SDK_KEY=your_sdk_key_here
VITE_SDK_SECRET=your_sdk_secret_here
```

> **⚠️ Security Warning**: Do not expose your SDK Secret to the client in production. Use a backend service to sign JWT tokens. This example stores credentials in `.env` for development simplicity only.

### 4. Run the Development Server

```bash
npm run dev
```

The application will start at `http://localhost:5173` (or another port if 5173 is occupied).

## Build for Production

To create a production build:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## How to Use

1. **Join a Session**: Click the "Join" button to enter the video session
2. **Share Your Screen**: Click "Share Screen" to start sharing your screen
3. **Cloud Recording**:
   - Click "Start Cloud Recording" to begin recording the session
   - Use "Pause Recording" to pause/resume the recording
   - Click "Stop Recording" to end the recording
4. **Leave Session**: Click "Leave" to exit the session

## Project Structure

```
videosdk-web-screenshare/
├── src/
│   ├── main.ts           # Main application logic
│   ├── utils.ts          # JWT signature generation utility
│   └── style.css         # Application styles
├── public/               # Static assets
├── index.html            # Main HTML file
├── .env.example          # Environment variables template
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── tailwind.config.js    # Tailwind CSS configuration
```

## Technologies Used

- **[Zoom Video SDK](https://developers.zoom.us/docs/video-sdk/)**: Core video and screen sharing functionality
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **jsrsasign**: JWT signature generation

## Key Features Explained

### Multiple Screen Sharing

This application is configured to support `SharePrivilege.MultipleShare`, allowing multiple participants to share their screens simultaneously. Each shared screen is rendered in the share container.

### Cloud Recording

The application includes full cloud recording capabilities:
- Start recording during an active session
- Pause and resume recording as needed
- Stop recording and save to Zoom Cloud

> **Note**: Cloud recording requires appropriate privileges in your Zoom Video SDK account.

### Video Element & Canvas Fallback

The screen share implementation checks if the browser supports video element sharing. If not, it automatically falls back to canvas-based rendering for broader browser compatibility.

## Browser Compatibility

This application works best with modern browsers that support:
- WebRTC
- MediaStream API
- Screen Capture API

Recommended browsers:
- Chrome 88+
- Firefox 85+
- Edge 88+
- Safari 15+

## Important Security Notes

- **Production Use**: Never expose SDK credentials in client-side code in production
- **Backend Integration**: Implement a secure backend service to generate JWT tokens
- **Token Management**: Use short-lived tokens and implement proper token refresh mechanisms
- **HTTPS Required**: Screen sharing requires HTTPS in production environments

## Troubleshooting

### "Failed to set share privilege to MultipleShare"
- Ensure your SDK account has multiple screen sharing enabled
- Check that you're using the correct SDK credentials

### Cloud Recording Fails
- Verify that cloud recording is enabled in your Zoom Video SDK account
- Ensure the user has host/co-host privileges

### Screen Share Not Working
- Check browser permissions for screen capture
- Ensure you're accessing the app via HTTPS (required for screen sharing in most browsers)
- Check browser console for detailed error messages

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Resources

- [Zoom Video SDK Documentation](https://developers.zoom.us/docs/video-sdk/)
- [Zoom Video SDK Reference](https://developers.zoom.us/docs/api/rest/)
- [Zoom Marketplace](https://marketplace.zoom.us/)

## License

This project is provided as-is for demonstration purposes.

## Contributing

Feel free to submit issues and pull requests for improvements and bug fixes.
