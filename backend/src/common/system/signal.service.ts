import { execFile } from "node:child_process";

export function sendReloadSignal(process: string) {
    execFile("systemctl", ["kill", "-s", "HUP", process], (err) => {
    if (err) {
      console.error("Failed to send SIGHUP:", err);
      return;
    }
    console.log("Reload signal sent");
  });

}
