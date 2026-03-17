import { jwtDecode } from "jwt-decode";

/**
 * JWT token claims interface
 */
interface JWTClaims {
    email?: string;
    preferred_username?: string;
    sub?: string;
}

declare global {
    interface Window {
        nativebridge?: {
            requestToken: () => Promise<string>;
            requestAlert: (options: { title: string; message: string; buttonText: string }) => Promise<void>;
            requestSaveLocalData: (options: { key: string; value: string }) => Promise<void>;
            requestGetLocalData: (options: { key: string }) => Promise<{ value: string | null }>;
        };
    }
}

const Bridge = {
    /**
     * Get authentication token from the native app
     * Decodes JWT to extract user email and ID from token claims
     *
     * @returns Object containing token and email
     * @throws Error if bridge is not available or token is missing
     */
    getToken: async () => {
        if (window.nativebridge?.requestToken) {
            const token = await window.nativebridge.requestToken();

            if (!token) {
                throw new Error("No token received from bridge");
            }

            // Decode JWT to extract email
            try {
                const claims = jwtDecode<JWTClaims>(token);

                return {
                    token: token,
                    email: claims.email || claims.preferred_username || claims.sub || "",
                };
            } catch (error) {
                console.error("Failed to decode JWT token:", error);
                // Return token without decoded claims if decoding fails
                return {
                    token: token,
                    email: "",
                };
            }
        }

        // Fallback for local development
        if (import.meta.env?.DEV) {
            console.warn("Using mock authentication token for local development");
            return {
                token: "mock-local-token",
                email: "dev@example.com",
            };
        }

        throw new Error("Bridge not available - must be run within the mobile app");
    },

    showAlert: async (title: string, message: string) => {
        if (window.nativebridge?.requestAlert) {
            return await window.nativebridge.requestAlert({
                title,
                message,
                buttonText: "OK",
            });
        }
        // Fallback to browser alert if bridge not available
        alert(`${title}\n\n${message}`);
    },

    /**
     * Generic helper to save local data via bridge
     */
    saveLocalData: async (key: string, value: unknown) => {
        const stringValue = JSON.stringify(value);
        if (window.nativebridge?.requestSaveLocalData) {
            await window.nativebridge.requestSaveLocalData({
                key: `resource-app:${key}`,
                value: stringValue,
            });
            return;
        }

        // Fallback to localStorage
        try {
            localStorage.setItem(`resource-app:${key}`, stringValue);
        } catch (e) {
            console.warn("Failed to save to localStorage:", e);
        }
    },

    /**
     * Generic helper to get local data via bridge
     */
    getLocalData: async <T>(key: string, defaultValue: T): Promise<T> => {
        if (window.nativebridge?.requestGetLocalData) {
            const result = await window.nativebridge.requestGetLocalData({
                key: `resource-app:${key}`,
            });

            if (result.value) {
                try {
                    return JSON.parse(result.value) as T;
                } catch (error) {
                    console.error(`Failed to parse saved data for ${key}:`, error);
                    return defaultValue;
                }
            }
            return defaultValue;
        }

        // Fallback to localStorage
        try {
            const stored = localStorage.getItem(`resource-app:${key}`);
            if (stored) {
                return JSON.parse(stored) as T;
            }
        } catch (e) {
            console.warn("Failed to load from localStorage:", e);
        }
        return defaultValue;
    }
};

export const bridge = Bridge;
