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
    return userContainers.get(userId)!;
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

// Remove user container
function removeUserContainer(userId: number) {
  const container = userContainers.get(userId);
  if (container) {
    container.rowElement.remove();
    userContainers.delete(userId);
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

  if (event.action === 'Stop') {
    const element = await mediaStream.detachVideo(event.userId);
    if (Array.isArray(element))
      element.forEach((el) => el.remove())
    else if (element) element.remove();

    // If user has no screen share either, remove the container
    const container = userContainers.get(event.userId);
    if (container && !user?.sharerOn) {
      removeUserContainer(event.userId);
    }
  } else {
    const container = getUserContainer(event.userId, username);
    if (container) {
      console.log('[renderVideo] Attaching video for user:', username);
      const userVideo = await mediaStream.attachVideo(event.userId, VideoQuality.Video_720P);
      // Find the video-player-container and append to it
      const videoPlayerContainer = container.videoContainer.querySelector('video-player-container');
      if (videoPlayerContainer) {
        // Remove the "Video" label
        const label = container.videoContainer.querySelector('.video-label');
        if (label) label.remove();
        videoPlayerContainer.appendChild(userVideo as VideoPlayer);
        console.log('[renderVideo] Video attached successfully');
      } else {
        console.error('[renderVideo] video-player-container not found!');
      }
    } else {
      console.log('[renderVideo] No container available for user:', event.userId);
    }
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
      console.log('[renderShare] Attaching screen share for user:', username);
      const element = await mediaStream.attachShareView(userId).catch(e => console.log('error attaching share view', e));
      if (element && element instanceof Node) {
        // Find the screen-player-container and append to it
        const screenPlayerContainer = container.screenContainer.querySelector('video-player-container');
        if (screenPlayerContainer) {
          // Remove the "Screen" label
          const label = container.screenContainer.querySelector('.screen-label');
          if (label) label.remove();
          screenPlayerContainer.appendChild(element);
          console.log('[renderShare] Screen share attached successfully');
        } else {
          console.error('[renderShare] video-player-container not found in screen container!');
        }
      } else {
        console.log('[renderShare] Failed to get screen share element');
      }
    } else {
      console.log(`[renderShare] Max ${MAX_USERS} users reached. Ignoring share from user ${userId}`);
    }
  } else if (action === "Stop") {
    const element = await mediaStream.detachShareView(userId).catch(e => console.log('error detaching share view', e));
    if (element && Array.isArray(element)) {
      element.forEach((el: HTMLElement) => el.remove());
    } else if (element && element instanceof Node) {
      element.remove();
    }

    // If user has no video either, remove the container
    const container = userContainers.get(userId);
    if (container && !user?.bVideoOn) {
      removeUserContainer(userId);
    } else if (container) {
      // Re-add the "Screen" label and video-player-container
      const screenPlayerContainer = container.screenContainer.querySelector('video-player-container');
      if (screenPlayerContainer) {
        screenPlayerContainer.innerHTML = '';
      }
      const existingLabel = container.screenContainer.querySelector('.screen-label');
      if (!existingLabel) {
        const screenLabel = document.createElement('div');
        screenLabel.className = 'screen-label';
        screenLabel.textContent = 'Screen';
        container.screenContainer.insertBefore(screenLabel, container.screenContainer.firstChild);
      }
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
