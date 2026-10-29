export function formatTime(seconds) {
    if (seconds === null || seconds === undefined) {
        return "00:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return String(minutes).padStart(2, "0") + ":" + String(remainingSeconds).padStart(2, "0");
}

const VERDICTS = {
    OK: "Accepted",
    WRONG_ANSWER: "Wrong answer",
    TIME_LIMIT_EXCEEDED: "Time limit exceeded",
    MEMORY_LIMIT_EXCEEDED: "Memory limit exceeded",
    RUNTIME_ERROR: "Runtime error",
    COMPILATION_ERROR: "Compilation error",
    TESTING: "Testing..."
};

export function verdictText(verdict) {
    if (!verdict) {
        return "No submission";
    }
    return VERDICTS[verdict] || verdict.toLowerCase().replaceAll("_", " ");
}

export function verdictClass(verdict) {
    if (!verdict) {
        return "";
    }
    if (verdict === "OK") {
        return "verdict-ok";
    }
    if (verdict === "TESTING") {
        return "verdict-testing";
    }
    return "verdict-bad";
}

export function ratingClass(rating) {
    if (!rating) return "rating-none";
    if (rating < 1200) return "rating-newbie";
    if (rating < 1400) return "rating-pupil";
    if (rating < 1600) return "rating-specialist";
    if (rating < 1900) return "rating-expert";
    if (rating < 2100) return "rating-cm";
    if (rating < 2400) return "rating-master";
    return "rating-gm";
}

const SESSION_KEY = "cfbattle-session";

export function saveSession(session) {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {} // storage can be blocked in private mode, the game still works without it
}

export function loadSession() {
    try {
        return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch {
        return null;
    }
}

export function clearSession() {
    try {
        sessionStorage.removeItem(SESSION_KEY);
    } catch {}
}

const VERIFICATION_KEY = "cfbattle-verification";

export function saveVerification(verification) {
    try {
        sessionStorage.setItem(VERIFICATION_KEY, JSON.stringify(verification));
    } catch {}
}

export function loadVerification() {
    try {
        const v = JSON.parse(sessionStorage.getItem(VERIFICATION_KEY));
        if (!v || v.expiresAt < Date.now() + (v.clockOffset || 0)) {
            return null;
        }
        return v;
    } catch {
        return null;
    }
}

export function clearVerification() {
    try {
        sessionStorage.removeItem(VERIFICATION_KEY);
    } catch {}
}

export function getSaved(key) {
    try {
        return localStorage.getItem(key) || "";
    } catch {
        return "";
    }
}

export function setSaved(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {}
}

export function getVerifyToken(handle) {
    return getSaved(`cfbattle-verified-${handle.toLowerCase()}`);
}

export function saveVerifyToken(handle, token) {
    setSaved(`cfbattle-verified-${handle.toLowerCase()}`, token);
}
