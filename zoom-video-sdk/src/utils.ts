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
    // Individual Recording (ISO) - Enabled by Zoom Support
    cloud_recording_option: 1, // 1 = Enable individual user recording
    cloud_recording_election: 1, // 1 = User opts-in to individual recording
    cloud_recording_transcript_option: 2, // 0 = none, 1 = transcript only, 2 = transcript + AI summary
  };

  const sHeader = JSON.stringify(oHeader);
  const sPayload = JSON.stringify(oPayload);
  const sdkJWT = KJUR.KJUR.jws.JWS.sign("HS256", sHeader, sPayload, sdkSecret);
  return sdkJWT;
}