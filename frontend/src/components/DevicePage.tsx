import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2, Copy, Check } from "lucide-react";
import { authFetch, DeviceNotRegisteredError } from "../utils/layoutIO";

interface DeviceInfo {
  device_id: string;
  teamMembers?: string[];
  team_members?: string[];
  connected?: boolean;
}

type LoadState = "loading" | "loaded" | "no_device" | "error";

export default function DevicePage() {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [members, setMembers] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    authFetch("/api/device")
      .then((r) => r.json())
      .then((data: DeviceInfo) => {
        setDevice(data);
        setMembers(data.teamMembers ?? data.team_members ?? []);
        setLoadState("loaded");
      })
      .catch((err) => {
        if (err instanceof DeviceNotRegisteredError) {
          setLoadState("no_device");
        } else {
          setLoadState("error");
        }
      });
  }, []);

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || members.includes(email)) return;
    setMembers((prev) => [...prev, email]);
    setNewEmail("");
    setDirty(true);
  };

  const handleRemove = (email: string) => {
    setMembers((prev) => prev.filter((m) => m !== email));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      const res = await authFetch("/api/device/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_members: members }),
      });
      if (res.ok) {
        setStatus("Saved");
        setDirty(false);
        setTimeout(() => setStatus(""), 2000);
      } else {
        const data = await res.json();
        setStatus(data.error ?? "Failed to save");
      }
    } catch {
      setStatus("Failed to save");
    }
    setSaving(false);
  };

  const handleCopy = () => {
    if (!device) return;
    navigator.clipboard.writeText(device.device_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loadState === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900">
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      </div>
    );
  }

  if (loadState === "no_device") {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900 p-8">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold text-white">No Device Linked</h2>
          <p className="text-sm text-gray-400">
            Your account isn't linked to a T.R.A.C.K. device yet. To get started, a team
            member with access to the Pi needs to add your email as a team member on the
            captive portal.
          </p>
          <p className="text-xs text-gray-600">
            Connect to the Pi's WiFi access point, open the captive portal, go to the
            Device tab, and add your email to the team members list.
          </p>
        </div>
      </div>
    );
  }

  if (loadState === "error" || !device) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900">
        <span className="text-sm text-red-400">Failed to load device info</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-900">
      <div className="flex h-10 flex-shrink-0 items-center border-b border-gray-800 px-6">
        <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500">
          DEVICE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-md space-y-6">
          {/* Device ID */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Device ID
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-gray-800 px-3 py-2 font-mono text-sm text-gray-300">
                {device.device_id}
              </code>
              <button
                onClick={handleCopy}
                className="rounded bg-gray-800 p-2 text-gray-400 hover:text-white transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {device.connected !== undefined && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${device.connected ? "bg-green-400" : "bg-gray-600"}`} />
                <span className="text-xs text-gray-500">{device.connected ? "Pi online" : "Pi offline"}</span>
              </div>
            )}
          </div>

          {/* Team Members */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Team Members
            </label>
            <p className="mb-3 text-xs text-gray-600">
              Add team member emails to grant access to this device's data in the cloud dashboard.
            </p>

            <div className="space-y-2">
              {members.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between rounded bg-gray-800 px-3 py-2"
                >
                  <span className="font-mono text-sm text-gray-300">{email}</span>
                  <button
                    onClick={() => handleRemove(email)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="teammate@example.com"
                className="flex-1 rounded border border-gray-700 bg-transparent px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none"
              />
              <button
                onClick={handleAdd}
                disabled={!newEmail.trim()}
                className="flex items-center gap-1 rounded bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </button>
            {status && (
              <span className={`text-xs ${status === "Saved" ? "text-green-400" : "text-red-400"}`}>
                {status}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
