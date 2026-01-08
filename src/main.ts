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
