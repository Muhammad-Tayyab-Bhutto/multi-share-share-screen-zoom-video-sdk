import ZoomVideo, { event_peer_share_state_change, event_peer_video_state_change, VideoPlayer, VideoQuality } from "@zoom/videosdk";
import { generateSignature } from "./utils";
import "./style.css";

// You should sign your JWT with a backend service in a production use-case
const sdkKey = import.meta.env.VITE_SDK_KEY as string;
const sdkSecret = import.meta.env.VITE_SDK_SECRET as string;

const myShareEle = document.querySelector('#my-screen-share-content-video')! as HTMLVideoElement;
const myShareCanvas = document.querySelector('#my-screen-share-content-canvas')! as HTMLCanvasElement;
const shareContainer = document.querySelector('#share-container')! as HTMLElement;
const videoContainer = document.querySelector('video-player-container') as HTMLElement;
const topic = "TestOne";
const role = 1;
const username = `User-${String(new Date().getTime()).slice(6)}`;
const client = ZoomVideo.createClient();
await client.init("en-US", "Global", { patchJsMedia: true });

const startCall = async () => {
  // generate a token to join the session - in production this will be done by your backend
  const token = generateSignature(topic, role, sdkKey, sdkSecret);
  client.on("peer-video-state-change", renderVideo);
  client.on("peer-share-state-change", renderShare);
  await client.join(topic, token, username);
  const mediaStream = client.getMediaStream();
  await mediaStream.startAudio();
  await mediaStream.startVideo();
  await renderVideo({ action: 'Start', userId: client.getCurrentUserInfo().userId });

  client.getAllUser().forEach(async (user) => {
    if (user.sharerOn) {
      const element = await mediaStream.attachShareView(user.userId);
      if (element instanceof VideoPlayer) shareContainer.appendChild(element);
      else console.error("Failed to attach share view", element);
    }
  });
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

const renderShare: typeof event_peer_share_state_change = async (event) => {
  const { action, userId } = event;
  console.log(event);
  const mediaStream = client.getMediaStream();
  if (action === "Start") {
    const element = await mediaStream.attachShareView(userId);
    if (element instanceof VideoPlayer) shareContainer.appendChild(element);
  } else if (action === "Stop") {
    const element = await mediaStream.detachShareView(userId);
    if (Array.isArray(element)) {
      element.forEach(el => el.remove());
    } else {
      if (element instanceof VideoPlayer) element.remove();
    }
  }
}

const startShare = async () => {
  const mediaStream = client.getMediaStream();
  client.on('passively-stop-share', handlePassiveStop)
  if (mediaStream.isStartShareScreenWithVideoElement()) {
    await mediaStream.startShareScreen(myShareEle, { captureHeight: 720, captureWidth: 1280, displaySurface: "monitor" })
    myShareEle.style.display = 'block';
  } else {
    console.log("can't use video element")
    await mediaStream.startShareScreen(myShareCanvas, { captureHeight: 720, captureWidth: 1280, displaySurface: "monitor" })
    myShareCanvas.style.display = 'block';
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
  }
  client.off("peer-video-state-change", renderVideo);
  await client.leave();
}

// UI Logic
const startBtn = document.querySelector("#start-btn") as HTMLButtonElement;
const stopBtn = document.querySelector("#stop-btn") as HTMLButtonElement;
const shareBtn = document.querySelector("#share-btn") as HTMLButtonElement;

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
});


shareBtn.addEventListener("click", async () => {
  await startShare()
})

stopBtn.addEventListener("click", async () => {
  await leaveCall();
  stopBtn.style.display = "none";
  startBtn.style.display = "block";
  startBtn.innerHTML = "Join";
  startBtn.disabled = false;
  shareBtn.style.display = "none";
});
