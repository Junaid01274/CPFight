import { useEffect, useState } from "react";

export default function useCountdown(endsAt, clockOffset = 0) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!endsAt) {
        return null;
    }

    return Math.max(0, Math.ceil((endsAt - (now + clockOffset)) / 1000));
}
