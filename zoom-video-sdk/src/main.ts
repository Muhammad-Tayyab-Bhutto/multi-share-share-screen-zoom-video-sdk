import ZoomVideo, { event_peer_share_state_change, event_peer_video_state_change, SharePrivilege, VideoPlayer, VideoQuality } from "@zoom/videosdk";
import { generateSignature } from "./utils";
import "./style.css";

// You should sign your JWT with a backend service in a production use-case
const sdkKey = import.meta.env.VITE_SDK_KEY as string;
const sdkSecret = import.meta.env.VITE_SDK_SECRET as string;

const myShareEle = document.querySelector('#my-screen-share-content-video')! as HTMLVideoElement;
const myShareCanvas = document.querySelector('#my-screen-share-content-canvas')! as HTMLCanvasElement;
const usersContainer = document.querySelector('#users-container')! as HTMLElement;

const topic = "TestOne";
const role = 1;
const username = `User-${String(new Date().getTime()).slice(6)}`;
const client = ZoomVideo.createClient();
const init = async () => {
  await client.init("en-US", "Global", { patchJsMedia: true });
};
await init();

// User container management - track up to 4 users
interface UserContainer {
  userId: number;
  rowElement: HTMLElement;
  screenContainer: HTMLElement;
  videoContainer: HTMLElement;
  username: string;
  isVideoAttaching?: boolean;
  isScreenAttaching?: boolean;
  pendingRemovalTimeout?: any;
  videoElement?: any;
  shareElement?: any;
  isVideoVisible?: boolean;
  isShareVisible?: boolean;
}

const userContainers = new Map<number, UserContainer>();
const MAX_USERS = 4;

// Create user row container
function createUserRow(userId: number, username: string): UserContainer {
  console.log('[createUserRow] Creating row for userId:', userId, 'username:', username);
  const rowElement = document.createElement('div');
  rowElement.className = 'user-row';
  rowElement.id = `user-row-${userId}`;

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'user-content';

  // Screen container with video-player-container wrapper
  const screenContainer = document.createElement('div');
  screenContainer.className = 'screen-container';
  const screenPlayerContainer = document.createElement('video-player-container');
  screenPlayerContainer.className = 'screen-player-container';
  const screenLabel = document.createElement('div');
  screenLabel.className = 'screen-label';
  screenLabel.textContent = 'Screen';
  screenContainer.appendChild(screenLabel);
  screenContainer.appendChild(screenPlayerContainer);

  // Video container with video-player-container wrapper
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container';
  const videoPlayerContainer = document.createElement('video-player-container');
  videoPlayerContainer.className = 'video-player-container';
  const videoLabel = document.createElement('div');
  videoLabel.className = 'video-label';
  videoLabel.textContent = 'Video';
  videoContainer.appendChild(videoLabel);
  videoContainer.appendChild(videoPlayerContainer);

  const userLabel = document.createElement('div');
  userLabel.className = 'user-label';
  userLabel.textContent = username || `U${userContainers.size + 1}`;

  contentWrapper.appendChild(screenContainer);
  contentWrapper.appendChild(videoContainer);

  rowElement.appendChild(contentWrapper);
  rowElement.appendChild(userLabel);

  usersContainer.appendChild(rowElement);

  console.log('[createUserRow] Row created and appended. Structure:', {
    rowElement,
    screenContainer,
    videoContainer,
    userLabel
  });

  return { userId, rowElement, screenContainer, videoContainer, username };
}

// Get or create user container
function getUserContainer(userId: number, username?: string): UserContainer | null {
  if (userContainers.has(userId)) {
    console.log('[getUserContainer] Found existing container for user:', userId);
    const container = userContainers.get(userId)!;
    // Cancel any pending removal if we are reusing this exact ID
    if (container.pendingRemovalTimeout) {
      console.log('[getUserContainer] Cancelling pending removal for user:', userId);
      clearTimeout(container.pendingRemovalTimeout);
      delete container.pendingRemovalTimeout;
      container.rowElement.classList.remove('pending-removal');
    }
    return container;
  }

  // Try to find an orphaned container with the same username (reconnect scenario)
  if (username) {
    for (const [oldId, container] of userContainers.entries()) {
      if (container.username === username && container.pendingRemovalTimeout) {
        console.log(`[getUserContainer] Adopting orphaned container for ${username} (Old ID: ${oldId} -> New ID: ${userId})`);

        // Cancel removal
        clearTimeout(container.pendingRemovalTimeout);
        delete container.pendingRemovalTimeout;
        container.rowElement.classList.remove('pending-removal');

        // Update container mapping
        container.userId = userId;
        container.rowElement.id = `user-row-${userId}`;
        userContainers.delete(oldId);
        userContainers.set(userId, container);

        return container;
      }
    }
  }

  if (userContainers.size >= MAX_USERS) {
    console.log(`[getUserContainer] Max ${MAX_USERS} users reached. Cannot add user ${userId}`);
    return null;
  }

  const displayName = username || `U${userContainers.size + 1}`;
  console.log('[getUserContainer] Creating new container for user:', userId, 'name:', displayName);
  const container = createUserRow(userId, displayName);
  userContainers.set(userId, container);
  console.log('[getUserContainer] Container created. Total containers:', userContainers.size);
  return container;
}

// Remove user container with grace period
function removeUserContainer(userId: number) {
  const container = userContainers.get(userId);
  if (container) {
    if (container.pendingRemovalTimeout) {
      return; // Already scheduled
    }

    console.log(`[removeUserContainer] Scheduling removal for user ${userId} in 2000ms`);
    container.rowElement.classList.add('pending-removal');

    container.pendingRemovalTimeout = setTimeout(async () => {
      console.log(`[removeUserContainer] Executing removal for user ${userId}`);

      // NOW we detach and cleanup because the user is actually gone
      const mediaStream = client.getMediaStream();
      try {
        if (container.videoElement) {
          await mediaStream.detachVideo(userId);
          container.videoElement.remove();
        }
        if (container.shareElement) {
          await mediaStream.detachShareView(userId);
          container.shareElement.remove();
        }
      } catch (e) {
        console.log('[removeUserContainer] Error cleaning up media:', e);
      }

      container.rowElement.remove();
      userContainers.delete(userId);
    }, 2000);
  }
}

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
  console.log('[renderVideo]', event.action, 'userId:', event.userId);
  const mediaStream = client.getMediaStream();
  const user = client.getAllUser().find(u => u.userId === event.userId);
  const username = user?.displayName || `U${userContainers.size + 1}`;
  console.log('[renderVideo] username:', username, 'user:', user);

  const container = getUserContainer(event.userId, username);
  if (!container) {
    console.log('[renderVideo] No container available for user:', event.userId);
    return;
  }

  try {
    if (event.action === 'Stop') {
      // PERSISTENT ATTACHMENT: Just hide the element, DO NOT DETACH
      console.log('[renderVideo] Hiding video for user:', username);
      if (container.videoElement) {
        container.videoElement.style.display = 'none';
        container.isVideoVisible = false;
      }

      // If user has no screen share either AND is truly gone (handled by user removal logic usually)
      // But here we just hide the video. The container removal logic is separate.
    } else {
      // Start Action
      const videoPlayerContainer = container.videoContainer.querySelector('video-player-container');
      if (videoPlayerContainer) {
        // Prepare container
        const label = container.videoContainer.querySelector('.video-label');
        if (label) label.remove();

        // If we already have a video element, just show it
        if (container.videoElement) {
          console.log('[renderVideo] Showing existing video element for:', username);
          container.videoElement.style.display = 'block';
          container.isVideoVisible = true;

          // Re-attach ONLY if it might have been detached (e.g. by reuse logic)
          // OR if the SDK requires re-attach for a new stream ID.
          // To be safe and avoid context churn, we TRY to just show it.
          // Check if we need to re-attach: The 'Start' event implies new data.
          // However, if we didn't detach, it might just resume?
          // Let's try to re-attach using the SAME element.
          try {
            await mediaStream.attachVideo(event.userId, VideoQuality.Video_720P, container.videoElement);
          } catch (e) {
            console.log('[renderVideo] Re-attach failed, but element exists. Continuing.', e);
          }
          return;
        }

        if (container.isVideoAttaching) { console.log('[renderVideo] Video attach in progress'); return; }

        container.isVideoAttaching = true;
        try {
          console.log('[renderVideo] Creating NEW video element for:', username);
          videoPlayerContainer.innerHTML = '';
          const userVideo = await mediaStream.attachVideo(event.userId, VideoQuality.Video_720P);
          container.videoElement = userVideo;
          videoPlayerContainer.appendChild(userVideo as any);
          container.isVideoVisible = true;
          console.log('[renderVideo] Video attached successfully');
        } finally {
          container.isVideoAttaching = false;
        }
      } else {
        console.error('[renderVideo] video-player-container not found!');
      }
    }
  } catch (e) {
    console.error('[renderVideo] Error handling video state change:', e);
  }
};

const startShare = async () => {
  const mediaStream = client.getMediaStream();
  client.on('passively-stop-share', handlePassiveStop);

  const userId = client.getCurrentUserInfo().userId;
  const user = client.getAllUser().find(u => u.userId === userId);
  const username = user?.displayName || `U${userContainers.size + 1}`;
  const container = getUserContainer(userId, username);

  let shareElement = myShareEle;

  if (mediaStream.isStartShareScreenWithVideoElement()) {
    await mediaStream.startShareScreen(myShareEle, { simultaneousShareView: true });
  } else {
    console.log(`couldn't start share with video element, starting with canvas instead`);
    shareElement = myShareCanvas as any;
    await mediaStream.startShareScreen(myShareCanvas, { simultaneousShareView: true });
  }

  if (container) {

    // Actually we know it's video-player-container or screen-player-container class
    const targetContainer = container.screenContainer.querySelector('video-player-container');

    if (targetContainer) {
      const label = container.screenContainer.querySelector('.screen-label');
      if (label) label.remove();

      shareElement.classList.remove('hidden');
      shareElement.style.display = 'block';
      targetContainer.appendChild(shareElement);
      console.log('[startShare] Local screen share moved to container');
    } else {
      console.error('[startShare] Target container not found');
    }
  }
}

const renderShare: typeof event_peer_share_state_change = async (event) => {
  const { action, userId } = event;
  console.log('[renderShare]', action, 'userId:', userId);
  const mediaStream = client.getMediaStream();
  const user = client.getAllUser().find(u => u.userId === userId);
  const username = user?.displayName || `U${userContainers.size + 1}`;
  console.log('[renderShare] username:', username, 'user:', user);

  if (action === "Start") {
    const container = getUserContainer(userId, username);
    if (container) {
      const screenPlayerContainer = container.screenContainer.querySelector('video-player-container');

      if (screenPlayerContainer) {
        // Remove label
        const label = container.screenContainer.querySelector('.screen-label');
        if (label) label.remove();

        // If already exists, just show it
        if (container.shareElement) {
          console.log('[renderShare] Showing existing share element for:', username);
          container.shareElement.style.display = 'block';
          container.isShareVisible = true;
          try {
            await mediaStream.attachShareView(userId, container.shareElement);
          } catch (e) {
            console.log('[renderShare] Re-attach failed, but element exists. Continuing.', e);
          }
          return;
        }

        if (container.isScreenAttaching) { console.log('[renderShare] Screen attach already in progress'); return; }

        container.isScreenAttaching = true;
        try {
          console.log('[renderShare] Creating NEW share element for:', username);
          screenPlayerContainer.innerHTML = '';
          const element = await mediaStream.attachShareView(userId);
          if (element && element instanceof Node) {
            container.shareElement = element;
            screenPlayerContainer.appendChild(element);
            container.isShareVisible = true;
          }
          console.log('[renderShare] Screen share attached successfully');

        } catch (e) {
          console.error('[renderShare] Error attaching share:', e);
        } finally {
          container.isScreenAttaching = false;
        }
      }
    } else {
      console.log(`[renderShare] Max ${MAX_USERS} users reached. Ignoring share from user ${userId}`);
    }
  } else if (action === "Stop") {
    // PERSISTENT ATTACHMENT: Just hide, DO NOT DETACH
    const container = userContainers.get(userId);
    if (container && container.shareElement) {
      console.log('[renderShare] Hiding share for user:', username);
      container.shareElement.style.display = 'none';
      container.isShareVisible = false;

      // Restore label for UX
      const screenLabel = document.createElement('div');
      screenLabel.className = 'screen-label';
      screenLabel.textContent = 'Screen';
      // Need to insert it but not break the flow.
      // Actually, just leave it blank or show "Screen Ended".
    }
  }
}

const handlePassiveStop = () => {
  // Move elements back to body and hide
  document.body.appendChild(myShareEle);
  document.body.appendChild(myShareCanvas);

  myShareEle.style.display = 'none';
  myShareCanvas.style.display = 'none';
  myShareEle.classList.add('hidden');
  myShareCanvas.classList.add('hidden');

  // Restore local user screen container label
  try {
    const userId = client.getCurrentUserInfo().userId;
    const container = userContainers.get(userId);
    if (container) {
      const screenPlayerContainer = container.screenContainer.querySelector('video-player-container');
      if (screenPlayerContainer) {
        // Remove any remaining children (though we moved main one)
        // screenPlayerContainer.innerHTML = ''; 
        // Actually don't clear innerHTML if we moved the element out, just ensure it's empty
      }

      const existingLabel = container.screenContainer.querySelector('.screen-label');
      if (!existingLabel) {
        const screenLabel = document.createElement('div');
        screenLabel.className = 'screen-label';
        screenLabel.textContent = 'Screen';
        container.screenContainer.insertBefore(screenLabel, container.screenContainer.firstChild);
      }
    }
  } catch (e) {
    console.error('Error in handlePassiveStop:', e);
  }

  client.off('passively-stop-share', handlePassiveStop)
}

const leaveCall = async () => {
  const mediaStream = client.getMediaStream();

  // Clean up all user containers
  // Ensure local share elements are rescued before destroying containers
  document.body.appendChild(myShareEle);
  document.body.appendChild(myShareCanvas);
  myShareEle.style.display = 'none';
  myShareCanvas.style.display = 'none';

  for (const [userId] of userContainers) {
    const videoElement = await mediaStream.detachVideo(userId).catch(() => null);
    if (Array.isArray(videoElement))
      videoElement.forEach((el) => el.remove())
    else if (videoElement) videoElement.remove();

    const shareElement = await mediaStream.detachShareView(userId).catch(() => null);
    if (Array.isArray(shareElement)) {
      shareElement.forEach(el => el.remove());
    } else if (shareElement && shareElement instanceof Node) {
      shareElement.remove();
    }

    removeUserContainer(userId);
  }

  client.off("peer-video-state-change", renderVideo);
  client.off("peer-share-state-change", renderShare);
  myShareEle.style.display = 'none';
  myShareCanvas.style.display = 'none';
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
