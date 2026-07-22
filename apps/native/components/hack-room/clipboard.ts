import * as Clipboard from "expo-clipboard";

import type { HackRoom, Tone } from "@/components/hack-room/domain";

export async function copyInviteCodeToClipboard(
  room: HackRoom,
  setMessage: (message: { text: string; tone: Tone }) => void,
) {
  try {
    await Clipboard.setStringAsync(room.inviteCode);
    setMessage({
      text: `Copied invite code ${room.inviteCode}`,
      tone: "violet",
    });
  } catch {
    setMessage({
      text: "Could not copy invite code. Please try again.",
      tone: "red",
    });
  }
}
