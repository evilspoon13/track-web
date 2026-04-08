export interface RegisterDeviceBody {
  teamMembers: string[];
}

export interface RegisterDeviceResult {
  device_id: string;
  teamMembers: string[];
  memberUids: string[];
}
