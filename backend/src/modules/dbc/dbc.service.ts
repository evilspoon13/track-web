import type { ApiMessage } from "../../common/types/api.types";
import { sendReloadSignal } from "../../common/system/signal.service";

export async function readDbc(): Promise<ApiMessage> {
  // Read current DBC from shared mem
  
  return {msg: "Read DBC"};
}

export async function writeDbc( _newDbc: unknown,): Promise<ApiMessage> {
  // Write new dbc to shared memory
  

  // Signal can-reader to reload
  sendReloadSignal("fsae-can-reader.service");

  return {msg: "Write DBC"};
}
