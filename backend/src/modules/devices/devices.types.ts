export interface RegisterDeviceBody {
  device_id?: string;
  teamMembers: string[];
}

export interface RegisterDeviceResult {
  device_id: string;
  teamMembers: string[];
  memberUids: string[];
  skippedEmails: string[];
}

