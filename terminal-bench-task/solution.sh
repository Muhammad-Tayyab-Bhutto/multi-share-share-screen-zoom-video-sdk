#!/bin/bash

# Create directories
mkdir -p src
mkdir -p public

# 1. package.json
cat <<'EOF' > package.json
{
  "name": "zoom-vite",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.12",
    "@types/jsrsasign": "^10.5.15",
    "tailwindcss": "^4.1.12",
    "typescript": "^5.9.2",
    "vite": "^6.0.0"
  },
  "dependencies": {
    "@zoom/videosdk": "^2.3.5",
    "jsrsasign": "^11.1.0"
  }
}
EOF

# 2. tsconfig.json
cat <<'EOF' > tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
EOF

# 3. vite.config.ts
cat <<'EOF' > vite.config.ts
// vite config
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  build: {
    target: 'esnext'
  },
  plugins: [tailwindcss()]
})
EOF

# 4. tailwind.config.js
cat <<'EOF' > tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
EOF

# 5. index.html
cat <<'EOF' > index.html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Zoom VideoSDK Screenshare</title>
</head>

<body class="flex flex-1 flex-col h-full min-h-screen relative">
  <h1 class="text-3xl font-bold text-center my-4">Zoom VideoSDK Screenshare</h1>
  <div class="flex flex-row self-center">
    <button id="start-btn" class="bg-blue-500 text-white font-bold py-2 px-4 rounded mb-4 w-64 self-center">
      Join
    </button>
    <button id="share-btn" class="hidden bg-blue-500 text-white font-bold py-2 px-4 rounded mb-4 w-64 self-center">
      Share Screen
    </button>
  </div>
  <div class="flex flex-row self-center m-2">
    <button id="stop-btn" class="hidden bg-blue-500 text-white font-bold py-2 px-4 rounded mb-4 w-64 self-center">
      Leave
    </button>
  </div>
  <div class="flex flex-row self-center m-2 gap-2">
    <button id="start-recording-btn" class="hidden bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded mb-4 w-64 self-center">
      Start Cloud Recording
    </button>
    <button id="pause-recording-btn" class="hidden bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded mb-4 w-64 self-center">
      Pause Recording
    </button>
    <button id="stop-recording-btn" class="hidden bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded mb-4 w-64 self-center">
      Stop Recording
    </button>
  </div>
  <!-- self screen share -->
  <video class="flex flex-row self-center m-2 h-96 hidden max-w-[65rem] max-h-[65rem]"
    id="my-screen-share-content-video" height="1080" width="1920"></video>
  <canvas class="flex flex-row self-center m-2 h-96 hidden max-w-[65rem] max-h-[65rem]"
    id="my-screen-share-content-canvas" height="1080" width="1920"></canvas>
  <!-- remote screen share -->
  <video-player-container id="share-container"
    class="max-w-[65rem] max-h-[65rem] flex flex-wrap gap-2"></video-player-container>
  <!-- user videos -->
  <video-player-container id="video-container"
    class="max-w-[65rem] max-h-[65rem] flex flex-wrap gap-2"></video-player-container>
  <script src="/coi-serviceworker.js"></script>
  <script type="module" src="/src/main.ts"></script>
</body>

</html>
EOF

# 6. src/style.css
cat <<'EOF' > src/style.css
@import "tailwindcss";

body {
  height: 100vh;
  overflow-y: scroll;
}

video-player-container {
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 40px;
  width: 100%;
  display: grid !important;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

video-player-container:has(> :nth-child(2)) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

video-player-container:has(> :nth-child(5)) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

video-player {\n  width: 100%;
  height: auto;
  aspect-ratio: 16/9;
}

#my-screen-share-content-video,
#my-screen-share-content-canvas {
  width: 100%;
  height: auto;
  display: none;
}

#users-screen-share-content-canvas {
  width: 100%;
  height: auto;
  display: none;
}
EOF

# 7. src/utils.ts
cat <<'EOF' > src/utils.ts
import KJUR from "jsrsasign";

// You should sign your JWT with a backend service in a production use-case
export function generateSignature(sessionName: string, role: number, sdkKey: string, sdkSecret: string) {
  const iat = Math.round(new Date().getTime() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;
  const oHeader = { alg: "HS256", typ: "JWT" };

  const oPayload = {
    app_key: sdkKey,
    tpc: sessionName,
    role_type: role,
    version: 1,
    iat: iat,
    exp: exp,
  };

  const sHeader = JSON.stringify(oHeader);
  const sPayload = JSON.stringify(oPayload);
  const sdkJWT = KJUR.KJUR.jws.JWS.sign("HS256", sHeader, sPayload, sdkSecret);
  return sdkJWT;
}
EOF

# 8. src/main.ts
cat <<'EOF' > src/main.ts
import ZoomVideo, { event_peer_share_state_change, event_peer_video_state_change, SharePrivilege, VideoPlayer, VideoQuality } from "@zoom/videosdk";
import { generateSignature } from "./utils";
import "./style.css";

// You should sign your JWT with a backend service in a production use-case
const sdkKey = import.meta.env.VITE_SDK_KEY as string;
const sdkSecret = import.meta.env.VITE_SDK_SECRET as string;

const myShareEle = document.querySelector('#my-screen-share-content-video')! as HTMLVideoElement;
const myShareCanvas = document.querySelector('#my-screen-share-content-canvas')! as HTMLCanvasElement;
const shareContainer = document.querySelector('#share-container')! as HTMLElement;
const videoContainer = document.querySelector('#video-container') as HTMLElement;

const topic = "TestOne";
const role = 1;
const username = `User-${String(new Date().getTime()).slice(6)}`;
const client = ZoomVideo.createClient();
await client.init("en-US", "Global", { patchJsMedia: true });

// Track active screen shares to limit rendering to 4
const activeShareUserIds = new Set<number>();

const startCall = async () => {
  // generate a token to join the session - in production this will be done by your backend
  const token = generateSignature(topic, role, sdkKey, sdkSecret);
  client.on("peer-video-state-change", renderVideo);
  client.on("peer-share-state-change", renderShare);
  await client.join(topic, token, username);
  const mediaStream = client.getMediaStream();
  await mediaStream.startAudio();
  await mediaStream.startVideo();
  await mediaStream.setSharePrivilege(SharePrivilege.MultipleShare);
  if (mediaStream.getSharePrivilege() !== SharePrivilege.MultipleShare) {
    alert("Failed to set share privilege to MultipleShare");
  }
  console.log(`share privilege: ${SharePrivilege[mediaStream.getSharePrivilege()]}`);
  await renderVideo({ action: 'Start', userId: client.getCurrentUserInfo().userId });
};

const renderVideo: typeof event_peer_video_state_change = async (event) => {
  const mediaStream = client.getMediaStream();
  if (event.action === 'Stop') {
    const element = await mediaStream.detachVideo(event.userId);
    if (Array.isArray(element))
      element.forEach((el) => el.remove())
    else if (element) element.remove();
  } else {
    const userVideo = await mediaStream.attachVideo(event.userId, VideoQuality.Video_720P);
    videoContainer.appendChild(userVideo as VideoPlayer);
  }
};

const startShare = async () => {
  const mediaStream = client.getMediaStream();
  client.on('passively-stop-share', handlePassiveStop)
  if (mediaStream.isStartShareScreenWithVideoElement()) {
    await mediaStream.startShareScreen(myShareEle, { simultaneousShareView: true })
    myShareEle.style.display = 'block';
  } else {
    console.log(`couldn't start share with video element, starting with canvas instead`);
    await mediaStream.startShareScreen(myShareCanvas, { simultaneousShareView: true })
    myShareCanvas.style.display = 'block';
  }
}

const renderShare: typeof event_peer_share_state_change = async (event) => {
  const { action, userId } = event;
  const mediaStream = client.getMediaStream();
  if (action === "Start") {
    // Only render if we haven't reached the limit of 4
    if (activeShareUserIds.size < 4) {
      activeShareUserIds.add(userId);
      const element = await mediaStream.attachShareView(userId).catch(e => console.log('error attaching share view', e));
      if (element && element instanceof Node) {
        shareContainer.appendChild(element);
      }
    } else {
      console.log(`Max 4 screen shares reached. Ignoring share from user ${userId}`);
    }
  } else if (action === "Stop") {
    // Only attempt to detach if we were actually rendering this user
    if (activeShareUserIds.has(userId)) {
      activeShareUserIds.delete(userId);
      const element = await mediaStream.detachShareView(userId).catch(e => console.log('error detaching share view', e));
      if (element && Array.isArray(element)) {
        element.forEach((el: HTMLElement) => el.remove());
      } else if (element && element instanceof Node) {
        element.remove();
      }
    }
  }
}

const handlePassiveStop = () => {
  myShareEle.style.display = 'none';
  myShareCanvas.style.display = 'none';
  shareContainer.style.display = 'none';
  client.off('passively-stop-share', handlePassiveStop)
}

const leaveCall = async () => {
  const mediaStream = client.getMediaStream();
  for (const user of client.getAllUser()) {
    const element = await mediaStream.detachVideo(user.userId);
    if (Array.isArray(element))
      element.forEach((el) => el.remove())
    else if (element) element.remove();
    if (user.sharerOn) {
      // Only detach if we were tracking it (meaning we attached it)
      if (activeShareUserIds.has(user.userId)) {
        const element = await mediaStream.detachShareView(user.userId).catch(e => console.log('error detaching share view', e));
        if (Array.isArray(element)) {
          element.forEach(el => el.remove());
        } else {
          if (element && element instanceof Node) element.remove();
        }
      }
    }
  }
  client.off("peer-video-state-change", renderVideo);
  client.off("peer-share-state-change", renderShare);
  activeShareUserIds.clear();
  myShareEle.style.display = 'none';
  myShareCanvas.style.display = 'none';
  shareContainer.style.display = 'none';
  await client.leave();
}

// Cloud Recording State
let isRecording = false;
let isPaused = false;

// UI Logic
const startBtn = document.querySelector("#start-btn") as HTMLButtonElement;
const stopBtn = document.querySelector("#stop-btn") as HTMLButtonElement;
const shareBtn = document.querySelector("#share-btn") as HTMLButtonElement;
const startRecordingBtn = document.querySelector("#start-recording-btn") as HTMLButtonElement;
const pauseRecordingBtn = document.querySelector("#pause-recording-btn") as HTMLButtonElement;
const stopRecordingBtn = document.querySelector("#stop-recording-btn") as HTMLButtonElement;

// Cloud Recording Functions
const startCloudRecording = async () => {
  try {
    const recordingClient = client.getRecordingClient();
    await recordingClient.startCloudRecording();
    isRecording = true;
    isPaused = false;

    // Update UI
    startRecordingBtn.style.display = "none";
    pauseRecordingBtn.style.display = "block";
    stopRecordingBtn.style.display = "block";
    pauseRecordingBtn.innerHTML = "Pause Recording";

    console.log("Cloud recording started");
  } catch (error) {
    console.error("Failed to start cloud recording:", error);
    alert("Failed to start cloud recording. Make sure you have recording privileges.");
  }
};

const pauseCloudRecording = async () => {
  try {
    const recordingClient = client.getRecordingClient();

    if (isPaused) {
      // Resume recording
      await recordingClient.resumeCloudRecording();
      isPaused = false;
      pauseRecordingBtn.innerHTML = "Pause Recording";
      console.log("Cloud recording resumed");
    } else {
      // Pause recording
      await recordingClient.pauseCloudRecording();
      isPaused = true;
      pauseRecordingBtn.innerHTML = "Resume Recording";
      console.log("Cloud recording paused");
    }
  } catch (error) {
    console.error("Failed to pause/resume cloud recording:", error);
    alert("Failed to pause/resume cloud recording.");
  }
};

const stopCloudRecording = async () => {
  try {
    const recordingClient = client.getRecordingClient();
    await recordingClient.stopCloudRecording();
    isRecording = false;
    isPaused = false;

    // Update UI
    startRecordingBtn.style.display = "block";
    pauseRecordingBtn.style.display = "none";
    stopRecordingBtn.style.display = "none";
    pauseRecordingBtn.innerHTML = "Pause Recording";

    console.log("Cloud recording stopped");
  } catch (error) {
    console.error("Failed to stop cloud recording:", error);
    alert("Failed to stop cloud recording.");
  }
};

startBtn.addEventListener("click", async () => {
  if (!sdkKey || !sdkSecret) {
    alert("Please enter SDK Key and SDK Secret in the .env file");
    return;
  }
  startBtn.innerHTML = "Connecting...";
  startBtn.disabled = true;
  await startCall();
  startBtn.innerHTML = "Connected";
  startBtn.style.display = "none";
  stopBtn.style.display = "block";
  shareBtn.style.display = "block";
  startRecordingBtn.style.display = "block"; // Show recording button when connected
});

shareBtn.addEventListener("click", async () => {
  await startShare()
})

stopBtn.addEventListener("click", async () => {
  // Stop recording if active
  if (isRecording) {
    await stopCloudRecording();
  }

  await leaveCall();
  stopBtn.style.display = "none";
  startBtn.style.display = "block";
  startBtn.innerHTML = "Join";
  startBtn.disabled = false;
  shareBtn.style.display = "none";
  startRecordingBtn.style.display = "none";
  pauseRecordingBtn.style.display = "none";
  stopRecordingBtn.style.display = "none";
});

// Cloud Recording Event Listeners
startRecordingBtn.addEventListener("click", async () => {
  await startCloudRecording();
});

pauseRecordingBtn.addEventListener("click", async () => {
  await pauseCloudRecording();
});

stopRecordingBtn.addEventListener("click", async () => {
  await stopCloudRecording();
});
EOF

# 9. public/coi-serviceworker.js
cat <<'EOF' > public/coi-serviceworker.js
/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
let coepCredentialless = false;
if (typeof window === "undefined") {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) =>
    event.waitUntil(self.clients.claim())
  );

  self.addEventListener("message", (ev) => {
    if (!ev.data) {
      return;
    } else if (ev.data.type === "deregister") {
      self.registration
        .unregister()
        .then(() => {
          return self.clients.matchAll();
        })
        .then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        });
    } else if (ev.data.type === "coepCredentialless") {
      coepCredentialless = ev.data.value;
    }
  });

  self.addEventListener("fetch", function (event) {
    const r = event.request;
    if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
      return;
    }

    const request =
      coepCredentialless && r.mode === "no-cors"
        ? new Request(r, {
            credentials: "omit",
          })
        : r;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) {
            return response;
          }

          const newHeaders = new Headers(response.headers);
          newHeaders.set(
            "Cross-Origin-Embedder-Policy",
            coepCredentialless ? "credentialless" : "require-corp"
          );
          if (!coepCredentialless) {
            newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
          }
          newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch((e) => console.error(e))
    );
  });
} else {
  (() => {
    const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
    window.sessionStorage.removeItem("coiReloadedBySelf");
    const coepDegrading = reloadedBySelf == "coepdegrade";

    // You can customize the behavior of this script through a global `coi` variable.
    const coi = {
      shouldRegister: () => !reloadedBySelf,
      shouldDeregister: () => false,
      coepCredentialless: () => true,
      coepDegrade: () => true,
      doReload: () => window.location.reload(),
      quiet: false,
      ...window.coi,
    };

    const n = navigator;
    const controlling = n.serviceWorker && n.serviceWorker.controller;

    // Record the failure if the page is served by serviceWorker.
    if (controlling && !window.crossOriginIsolated) {
      window.sessionStorage.setItem("coiCoepHasFailed", "true");
    }
    const coepHasFailed = window.sessionStorage.getItem("coiCoepHasFailed");

    if (controlling) {
      // Reload only on the first failure.
      const reloadToDegrade =
        coi.coepDegrade() && !(coepDegrading || window.crossOriginIsolated);
      n.serviceWorker.controller.postMessage({
        type: "coepCredentialless",
        value:
          reloadToDegrade || (coepHasFailed && coi.coepDegrade())
            ? false
            : coi.coepCredentialless(),
      });
      if (reloadToDegrade) {
        !coi.quiet && console.log("Reloading page to degrade COEP.");
        window.sessionStorage.setItem("coiReloadedBySelf", "coepdegrade");
        coi.doReload("coepdegrade");
      }

      if (coi.shouldDeregister()) {
        n.serviceWorker.controller.postMessage({ type: "deregister" });
      }
    }

    // If we're already coi: do nothing. Perhaps it's due to this script doing its job, or COOP/COEP are
    // already set from the origin server. Also if the browser has no notion of crossOriginIsolated, just give up here.
    if (window.crossOriginIsolated !== false || !coi.shouldRegister()) return;

    if (!window.isSecureContext) {
      !coi.quiet &&
        console.log(
          "COOP/COEP Service Worker not registered, a secure context is required."
        );
      return;
    }

    // In some environments (e.g. Firefox private mode) this won't be available
    if (!n.serviceWorker) {
      !coi.quiet &&
        console.error(
          "COOP/COEP Service Worker not registered, perhaps due to private mode."
        );
      return;
    }

    n.serviceWorker.register(window.document.currentScript.src).then(
      (registration) => {
        !coi.quiet &&
          console.log(
            "COOP/COEP Service Worker registered",
            registration.scope
          );

        registration.addEventListener("updatefound", () => {
          !coi.quiet &&
            console.log(
              "Reloading page to make use of updated COOP/COEP Service Worker."
            );
          window.sessionStorage.setItem("coiReloadedBySelf", "updatefound");
          coi.doReload();
        });

        // If the registration is active, but it's not controlling the page
        if (registration.active && !n.serviceWorker.controller) {
          !coi.quiet &&
            console.log(
              "Reloading page to make use of COOP/COEP Service Worker."
            );
          window.sessionStorage.setItem("coiReloadedBySelf", "notcontrolling");
          coi.doReload();
        }
      },
      (err) => {
        !coi.quiet &&
          console.error("COOP/COEP Service Worker failed to register:", err);
      }
    );
  })();
}
EOF

# 10. .env
cat <<'EOF' > .env
VITE_SDK_KEY=your_sdk_key_here
VITE_SDK_SECRET=your_sdk_secret_here
EOF

# 11. README.md
cat <<'EOF' > README.md
# Zoom Video SDK Screenshare

This project integrates Zoom Video SDK with Vite, TypeScript, and Tailwind CSS.

## Features
- Video Conferencing
- Screen Sharing (Multi-share supported)
- Cloud Recording Controls

## Setup
1. npm install
2. npm run dev
EOF

# Make JavaScript files executable (if they were scripts)
chmod +x public/coi-serviceworker.js
