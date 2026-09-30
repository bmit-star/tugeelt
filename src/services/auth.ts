import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

export const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/spreadsheets.readonly"
];

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: "select_account"
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // When token expires or after page reload, prompt user when action is triggered
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Google хаягаар нэвтрэх үед Access Token авахад алдаа гарлаа");
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Google sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  clearStoredSessionToken();
};

export const SESSION_TOKEN_KEY = "fleet_session_token";

export const getStoredSessionToken = (): string | null => {
  try {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const payloadStr = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
        const payload = JSON.parse(payloadStr);
        if (payload.expiresAt && Date.now() > payload.expiresAt) {
          clearStoredSessionToken();
          return null;
        }
      } catch (e) {
        // ignore decoding error
      }
    }
    return token;
  } catch {
    return null;
  }
};

export const setStoredSessionToken = (token: string): void => {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch (e) {
    console.error("Failed to store session token", e);
  }
};

export const clearStoredSessionToken = (): void => {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem("fleet_manager_authenticated_session_v1");
  } catch (e) {
    console.error("Failed to clear session token", e);
  }
};

export const driverLogin = async (code: string): Promise<any> => {
  const res = await fetch("/api/auth/driver-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Жолоочийн нэвтрэлт амжилтгүй боллоо");
  }
  if (data.token) {
    setStoredSessionToken(data.token);
  }
  return data;
};

export const managerLogin = async (password: string): Promise<any> => {
  const res = await fetch("/api/auth/manager-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Менежерийн код буруу байна");
  }
  if (data.token) {
    setStoredSessionToken(data.token);
  }
  return data;
};
