import { useState, useRef, useCallback } from "react";

export interface KeystrokeData {
  dwellTimes: number[];
  flightTimes: number[];
  keyCount: number;
}

export const useKeystroke = () => {
  const [telemetry, setTelemetry] = useState<KeystrokeData>({
    dwellTimes: [],
    flightTimes: [],
    keyCount: 0,
  });

  const keyDownTimes = useRef<Map<string, number>>(new Map());
  const lastKeyDownTime = useRef<number>(0);

  const resetKeystroke = useCallback(() => {
    keyDownTimes.current.clear();
    lastKeyDownTime.current = 0;
    setTelemetry({
      dwellTimes: [],
      flightTimes: [],
      keyCount: 0,
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Exclude modifiers and control keys
    if (e.key.length !== 1 && e.key !== "Backspace") return;

    const code = e.code;
    const now = performance.now();

    if (!keyDownTimes.current.has(code)) {
      keyDownTimes.current.set(code, now);
    }

    if (lastKeyDownTime.current > 0) {
      const flight = now - lastKeyDownTime.current;
      setTelemetry((prev) => ({
        ...prev,
        flightTimes: [...prev.flightTimes, flight].slice(-25),
      }));
    }

    lastKeyDownTime.current = now;
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const code = e.code;
    if (!keyDownTimes.current.has(code)) return;

    const pressTime = keyDownTimes.current.get(code)!;
    const releaseTime = performance.now();
    const dwell = releaseTime - pressTime;

    keyDownTimes.current.delete(code);

    setTelemetry((prev) => ({
      ...prev,
      dwellTimes: [...prev.dwellTimes, dwell].slice(-25),
      keyCount: prev.keyCount + 1,
    }));
  }, []);

  return {
    telemetry,
    handleKeyDown,
    handleKeyUp,
    resetKeystroke,
  };
};
