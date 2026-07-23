import { normalisePosition } from "../core/geo.js";

export class LocationService extends EventTarget {
  constructor() {
    super();
    this.watchId = null;
    this.lastPosition = null;
  }

  supported() { return "geolocation" in navigator; }

  async permissionState() {
    if (!navigator.permissions?.query) return "prompt";
    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      return result.state;
    } catch {
      return "prompt";
    }
  }

  getCurrent(options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.supported()) return reject(new Error("Geolocation is not supported by this browser."));
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.lastPosition = normalisePosition(position);
          resolve(this.lastPosition);
        },
        (error) => reject(new Error(this.messageForError(error))),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000, ...options }
      );
    });
  }

  start(options = {}) {
    if (!this.supported()) throw new Error("Geolocation is not supported by this browser.");
    this.stop();
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.lastPosition = normalisePosition(position);
        this.dispatchEvent(new CustomEvent("position", { detail: this.lastPosition }));
      },
      (error) => this.dispatchEvent(new CustomEvent("error", { detail: new Error(this.messageForError(error)) })),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 7_000, ...options }
    );
    return this.watchId;
  }

  stop() {
    if (this.watchId != null && this.supported()) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }

  messageForError(error) {
    if (error?.code === 1) return "Location permission was denied. Enable it in your browser settings to use zone checks or sharing.";
    if (error?.code === 2) return "Your location is temporarily unavailable. Move into an area with better GPS or network reception.";
    if (error?.code === 3) return "The location request timed out. Try again outdoors or with high accuracy enabled.";
    return error?.message || "Unable to read your location.";
  }
}
